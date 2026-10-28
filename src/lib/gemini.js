// Browser-side Gemini client for the LLM dispatch planner.
// The API key never leaves this browser except in the request to Google.
import { APPLIANCES, CONFIG, clamp, fmtClock } from './simulation';

const STORAGE_KEY = 'gridmind.gemini';
export const DEFAULT_MODEL = 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 25000;
const ENV_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export function loadLlmSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { apiKey: s.apiKey || ENV_KEY, model: s.model || DEFAULT_MODEL, auto: Boolean(s.auto) };
  } catch {
    return { apiKey: ENV_KEY, model: DEFAULT_MODEL, auto: false };
  }
}

export function saveLlmSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, apiKey: s.apiKey === ENV_KEY ? '' : s.apiKey }));
  } catch {
    /* storage unavailable (private mode) — settings stay in memory */
  }
}

const SHEDDABLE = APPLIANCES.filter((a) => !a.critical).map((a) => a.id);

const SYSTEM_PROMPT = `You are GridMind, the autonomous energy-dispatch agent of a campus micro-grid in India.
Each request contains live telemetry as JSON. Choose how much flexible load to shed so utility import stays within the contract cap, while minimising comfort impact, cost (INR) and CO2.
Physics you do not control: after your shedding, solar is used first, then battery discharge (up to available_discharge_kw; during off-peak the grid is used first up to the cap), then grid import.
Rules:
- required_shed_kw is the minimum total shedding (kW) that keeps import within the cap. Shedding far beyond it needlessly hurts comfort; shedding less breaches the cap and a rule-based guardrail will top it up.
- shed values are fractions of each appliance's demand_kw, between 0 and its max_shed. Critical loads (labs) are never shed.
- EV and water-pump shedding defers the energy to the 02:00 off-peak window (cheap, no comfort loss). HVAC, lighting and kitchen shedding curtails comfort.
- Think about time of day, tariff window, battery SOC, and the coming evening peak (18:00-22:00, highest tariff).
Respond with JSON only: {"summary": string under 120 chars, "reasoning": 3-5 short first-person strings under 140 chars each, "shed": {${SHEDDABLE.map((id) => `"${id}": number`).join(', ')}}}`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    reasoning: { type: 'ARRAY', items: { type: 'STRING' } },
    shed: {
      type: 'OBJECT',
      properties: Object.fromEntries(SHEDDABLE.map((id) => [id, { type: 'NUMBER' }])),
      required: SHEDDABLE,
    },
  },
  required: ['summary', 'reasoning', 'shed'],
};

const r1 = (v) => Math.round(v * 10) / 10;

export function buildTelemetry(g) {
  return {
    time: fmtClock(g.hour),
    phase: g.phase.label,
    tariff: { window: g.tariff.label, inr_per_kwh: g.tariff.rate, offpeak_inr_per_kwh: CONFIG.TARIFF_OFFPEAK_INR },
    cloud_cover_pct: g.cloud,
    stress_test_active: g.stress,
    solar_kw: r1(g.solarKW),
    demand_kw: r1(g.rawLoad),
    battery: {
      soc_pct: r1(g.soc),
      capacity_kwh: CONFIG.BATTERY_CAPACITY_KWH,
      reserve_pct: CONFIG.BATTERY_RESERVE_PCT,
      available_discharge_kw: g.batteryAvailKW,
      reserve_locked: g.batteryLocked,
    },
    import_cap_kw: g.importCap,
    required_shed_kw: r1(g.requiredShedKW),
    ev_deferred_queue_kwh: r1(g.evQueueKWh),
    appliances: g.appliances.map((a) => ({
      id: a.id,
      name: a.name,
      demand_kw: r1(a.demand - a.scheduled),
      max_shed: a.maxShed,
      critical: Boolean(a.critical),
    })),
  };
}

export function sanitizePlan(raw) {
  const shed = {};
  APPLIANCES.forEach((a) => {
    shed[a.id] = a.critical ? 0 : clamp(Number(raw?.shed?.[a.id]) || 0, 0, a.maxShed);
  });
  const reasoning = (Array.isArray(raw?.reasoning) ? raw.reasoning : [])
    .filter((s) => typeof s === 'string' && s.trim())
    .slice(0, 5)
    .map((s) => s.trim().slice(0, 200));
  return { summary: String(raw?.summary ?? '').slice(0, 160), reasoning, shed };
}

export async function consultGemini({ apiKey, model, grid, signal }) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(buildTelemetry(grid)) }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error?.message) msg = body.error.message.slice(0, 140);
      } catch {
        /* non-JSON error body */
      }
      throw new Error(msg);
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text) throw new Error('empty response from model');
    return sanitizePlan(JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, '')));
  } catch (e) {
    if (e.name === 'AbortError' && !signal?.aborted) throw new Error('request timed out');
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
