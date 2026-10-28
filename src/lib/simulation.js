// Physical + economic model for the GridMind micro-grid.
// Everything here is pure so the UI can derive state synchronously from inputs.

export const CONFIG = {
  SOLAR_PEAK_KW: 150,
  SOLAR_DERATE: 0.94, // soiling, inverter and temperature losses
  SUNRISE_H: 6,
  SUNSET_H: 18.5,
  PANEL_EFFICIENCY_PCT: 22.4,
  BATTERY_CAPACITY_KWH: 400,
  BATTERY_MAX_DISCHARGE_KW: 45,
  BATTERY_MAX_CHARGE_KW: 70,
  BATTERY_RESERVE_PCT: 20,
  BATTERY_HEALTH_PCT: 96.8,
  BATTERY_ROUND_TRIP: 0.9,
  BATTERY_LCOS_INR: 6.2, // levelized cost of stored energy (wear + replacement)
  GRID_IMPORT_CAP_KW: 15, // contract demand cap, 06:00–22:00
  GRID_IMPORT_CAP_OFFPEAK_KW: 60, // relaxed cap in the 22:00–06:00 off-peak window
  CRITICAL_MARGIN_KW: 2.5, // tolerance for sensor jitter before flagging a cap breach
  TARIFF_PEAK_INR: 9.5, // 18:00–22:00
  TARIFF_NORMAL_INR: 7.0, // 06:00–18:00
  TARIFF_OFFPEAK_INR: 4.5, // 22:00–06:00
  EXPORT_RATE_INR: 3.2,
  EV_NIGHT_START_H: 2,
  EV_NIGHT_END_H: 6,
  EV_NIGHT_MAX_KW: 30,
  EMISSION_FACTOR_KG_PER_KWH: 0.716, // CEA India grid baseline
  DEFAULT_HOUR: 12,
  SPEEDS: [0, 1, 10, 60], // simulated minutes per real second
  TICK_MS: 1000,
};

// `base` is each appliance's peak demand; PROFILES scale it by hour of day.
export const APPLIANCES = [
  { id: 'hvac', name: 'HVAC Systems', base: 48, stress: 30, maxShed: 0.35 },
  { id: 'labs', name: 'Labs & Data Center', base: 30, stress: 8, maxShed: 0, critical: true },
  { id: 'ev', name: 'EV Charging Bay', base: 26, stress: 20, maxShed: 1 },
  { id: 'lighting', name: 'Smart Lighting', base: 16, stress: 4, maxShed: 0.4 },
  { id: 'pumps', name: 'Water Pumps', base: 10, stress: 3, maxShed: 1 },
  { id: 'kitchen', name: 'Cafeteria & Kitchen', base: 8, stress: 0, maxShed: 0.25 },
];

const bell = (h, center, width) => {
  let d = Math.abs(h - center) % 24;
  if (d > 12) d = 24 - d;
  return Math.exp(-0.5 * (d / width) ** 2);
};

export const PROFILES = {
  hvac: (h) => 0.2 + 0.8 * bell(h, 14.5, 4),
  labs: (h) => 0.6 + 0.4 * bell(h, 13, 4.5),
  ev: (h) => 0.05 + 0.95 * bell(h, 11, 3),
  lighting: (h) => 0.25 + 0.75 * Math.max(bell(h, 20, 2.5), bell(h, 6.5, 1)),
  pumps: (h) => 0.3 + 0.7 * bell(h, 7, 2),
  kitchen: (h) => 0.1 + 0.9 * Math.min(1, bell(h, 8, 1) + bell(h, 13, 1.2) + bell(h, 19.5, 1.2)),
};

// Tiered load-shedding policy, applied in order until the deficit is covered.
// `upTo` is the cumulative shed fraction for that appliance after the tier.
const SHED_TIERS = [
  { id: 'hvac', upTo: 0.15 },
  { id: 'ev', upTo: 1 },
  { id: 'pumps', upTo: 1 },
  { id: 'hvac', upTo: 0.35 },
  { id: 'lighting', upTo: 0.4 },
  { id: 'kitchen', upTo: 0.25 },
];

const STEPPED = new Set(['hvac', 'lighting', 'kitchen']);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrapHour = (h) => ((h % 24) + 24) % 24;

export function fmtClock(hour) {
  const m = Math.floor(wrapHour(hour) * 60 + 1e-6);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function tariffAt(hour) {
  const h = wrapHour(hour);
  if (h >= 18 && h < 22) return { period: 'peak', label: 'Peak', rate: CONFIG.TARIFF_PEAK_INR };
  if (h >= 22 || h < 6) return { period: 'offpeak', label: 'Off-peak', rate: CONFIG.TARIFF_OFFPEAK_INR };
  return { period: 'normal', label: 'Standard', rate: CONFIG.TARIFF_NORMAL_INR };
}

export function daylightAt(hour) {
  const h = wrapHour(hour);
  if (h <= CONFIG.SUNRISE_H || h >= CONFIG.SUNSET_H) return 0;
  return Math.sin((Math.PI * (h - CONFIG.SUNRISE_H)) / (CONFIG.SUNSET_H - CONFIG.SUNRISE_H));
}

export function phaseAt(hour) {
  const h = wrapHour(hour);
  if (h >= 5.5 && h < 8) return { id: 'dawn', label: 'Sunrise' };
  if (h >= 8 && h < 17) return { id: 'day', label: 'Daytime' };
  if (h >= 17 && h < 19.5) return { id: 'dusk', label: 'Sunset' };
  return { id: 'night', label: 'Night' };
}

export function describeAction(id, frac, kw) {
  const pct = Math.round(frac * 100);
  const k = kw.toFixed(1);
  switch (id) {
    case 'hvac':
      return `Throttling HVAC units by ${pct}% (setpoint +${(pct / 10).toFixed(1)}°C, -${k} kW)`;
    case 'ev':
      return frac >= 0.999
        ? `Deferring EV charging queue to 2:00 AM (-${k} kW)`
        : `Deferring ${pct}% of EV charging queue to 2:00 AM (-${k} kW)`;
    case 'pumps':
      return frac >= 0.999
        ? `Rescheduling water pumps to off-peak window (-${k} kW)`
        : `Rescheduling ${pct}% of water pumping to off-peak (-${k} kW)`;
    case 'lighting':
      return `Dimming non-critical lighting by ${pct}% (-${k} kW)`;
    case 'kitchen':
      return `Staggering cafeteria appliance cycles by ${pct}% (-${k} kW)`;
    default:
      return `Shedding ${k} kW from ${id}`;
  }
}

export function computeGrid({
  cloud,
  stress,
  soc,
  hour = CONFIG.DEFAULT_HOUR,
  evQueueKWh = 0,
  override = null,
  noise = { solar: 1, load: 1 },
}) {
  const h = wrapHour(hour);
  const tariff = tariffAt(h);
  const phase = phaseAt(h);
  const importCap = tariff.period === 'offpeak' ? CONFIG.GRID_IMPORT_CAP_OFFPEAK_KW : CONFIG.GRID_IMPORT_CAP_KW;
  const daylight = daylightAt(h);

  const c = clamp(cloud, 0, 100) / 100;
  const irradiance = 1 - 0.88 * Math.pow(c, 1.15);
  const solarKW = CONFIG.SOLAR_PEAK_KW * CONFIG.SOLAR_DERATE * daylight * irradiance * noise.solar;
  const solarEfficiency =
    daylight > 0
      ? CONFIG.PANEL_EFFICIENCY_PCT * (1 - 0.22 * c) * (0.9 + 0.1 * Math.min(1, daylight * 1.5)) * (0.99 + 0.01 * noise.solar)
      : 0;

  const appliances = APPLIANCES.map((a) => ({
    ...a,
    demand: (a.base * PROFILES[a.id](h) + (stress ? a.stress : 0)) * noise.load,
    scheduled: 0,
    shedFrac: 0,
  }));
  const byId = Object.fromEntries(appliances.map((a) => [a.id, a]));
  const baseLoad = appliances.reduce((s, a) => s + a.demand, 0);

  // Deferred EV energy is replayed in the off-peak window using spare import headroom.
  const inEvWindow = h >= CONFIG.EV_NIGHT_START_H && h < CONFIG.EV_NIGHT_END_H;
  const evNightKW =
    inEvWindow && evQueueKWh > 0.05
      ? clamp(Math.min(CONFIG.EV_NIGHT_MAX_KW, evQueueKWh, importCap - (baseLoad - solarKW)), 0, CONFIG.EV_NIGHT_MAX_KW)
      : 0;
  byId.ev.demand += evNightKW;
  byId.ev.scheduled = evNightKW;
  const rawLoad = baseLoad + evNightKW;

  const batteryLocked = soc <= CONFIG.BATTERY_RESERVE_PCT;
  const batteryFull = soc >= 99.9;
  const batteryAvailKW = batteryLocked ? 0 : CONFIG.BATTERY_MAX_DISCHARGE_KW;

  const deficit = rawLoad - solarKW;
  const requiredShedKW = Math.max(0, deficit - batteryAvailKW - importCap);
  const regime = `${tariff.period}|${phase.id}`;
  // Coarse operating-point signature: the agent re-plans whenever it changes.
  const sig = [regime, evNightKW > 0.5 ? 'ev' : '', Math.round(baseLoad / 15), Math.round(solarKW / 25), batteryLocked ? 'L' : ''].join('|');

  const flex = (a) => a.demand - a.scheduled;
  let need = requiredShedKW;
  const planSource = override && override.sig === sig ? 'llm' : 'rules';
  if (planSource === 'llm') {
    appliances.forEach((a) => {
      a.shedFrac = a.critical ? 0 : clamp(Number(override.shed?.[a.id]) || 0, 0, a.maxShed);
      need -= a.shedFrac * flex(a);
    });
  }

  // Rule policy; on top of an LLM plan it acts as a safety guardrail.
  let guardrailKW = 0;
  for (const tier of SHED_TIERS) {
    if (need <= 0.05) break;
    const a = byId[tier.id];
    const fa = flex(a);
    const room = fa * (tier.upTo - a.shedFrac);
    if (room <= 0 || fa <= 0) continue;
    let frac = a.shedFrac + Math.min(room, need) / fa;
    if (STEPPED.has(a.id)) frac = Math.min(tier.upTo, Math.ceil(frac * 20 - 1e-9) / 20);
    const added = (frac - a.shedFrac) * fa;
    need -= added;
    guardrailKW += added;
    a.shedFrac = frac;
  }
  if (planSource === 'rules') guardrailKW = 0;

  appliances.forEach((a) => {
    a.shedKW = flex(a) * a.shedFrac;
    a.active = a.demand - a.shedKW;
  });

  const shedKW = appliances.reduce((s, a) => s + a.shedKW, 0);
  const deferredKW = byId.ev.shedKW + byId.pumps.shedKW;
  const optimizedLoad = rawLoad - shedKW;
  const net = optimizedLoad - solarKW;

  let batteryKW = 0; // + discharge, - charge
  let gridKW = 0; // + import, - export
  if (net > 0) {
    // Off-peak energy is cheaper than battery wear: buy grid first, keep the battery for the evening peak.
    const gridFirst = tariff.period === 'offpeak' ? Math.min(net, importCap) : 0;
    batteryKW = Math.min(net - gridFirst, batteryAvailKW);
    gridKW = net - batteryKW;
  } else {
    const surplus = -net;
    const charge = batteryFull ? 0 : Math.min(surplus, CONFIG.BATTERY_MAX_CHARGE_KW);
    batteryKW = -charge;
    gridKW = -(surplus - charge);
  }

  const gridImport = Math.max(0, gridKW);
  const gridExport = Math.max(0, -gridKW);

  const actions = appliances
    .filter((a) => a.shedFrac > 0.001 && a.shedKW > 0.05)
    .map((a) => ({ id: a.id, frac: a.shedFrac, kw: a.shedKW, text: describeAction(a.id, a.shedFrac, a.shedKW) }));

  // Impact vs. an unmanaged, grid-only campus drawing the full raw demand at the current tariff.
  // Replayed EV energy was already costed (at off-peak) when it was deferred, so it is excluded here.
  const rate = tariff.rate;
  const baselineCost = (rawLoad - evNightKW) * rate;
  const batteryDischarge = Math.max(0, batteryKW);
  const actualCost =
    (gridImport - Math.min(evNightKW, gridImport)) * rate +
    deferredKW * CONFIG.TARIFF_OFFPEAK_INR +
    batteryDischarge * CONFIG.BATTERY_LCOS_INR -
    gridExport * CONFIG.EXPORT_RATE_INR;
  const costSavingsPerHr = baselineCost - actualCost;
  const solarConsumed = Math.min(solarKW, optimizedLoad);
  const conservedKW = shedKW - deferredKW;
  const carbonOffsetPerHr =
    (solarConsumed + gridExport + conservedKW + batteryDischarge * CONFIG.BATTERY_ROUND_TRIP) *
    CONFIG.EMISSION_FACTOR_KG_PER_KWH;
  const gridDependencyReduction = rawLoad > 0 ? clamp((1 - gridImport / rawLoad) * 100, 0, 100) : 100;

  // What the agent itself contributes over a passive solar+battery system.
  const passiveImport = Math.max(0, deficit - batteryAvailKW);
  const agentSavingsPerHr = Math.max(0, (passiveImport - gridImport) * rate - deferredKW * CONFIG.TARIFF_OFFPEAK_INR);

  let status = 'optimal';
  if (gridImport > importCap + CONFIG.CRITICAL_MARGIN_KW) status = 'critical';
  else if (shedKW > 0.05 || batteryLocked) status = 'balancing';

  return {
    cloud,
    stress,
    soc,
    hour: h,
    tariff,
    phase,
    daylight,
    importCap,
    irradiance,
    solarKW,
    solarEfficiency,
    appliances,
    rawLoad,
    optimizedLoad,
    shedKW,
    requiredShedKW,
    deferredKW,
    deficit,
    batteryKW,
    batteryAvailKW,
    batteryLocked,
    gridKW,
    gridImport,
    gridExport,
    evNightKW,
    evShedKW: byId.ev.shedKW,
    evQueueKWh,
    actions,
    planSource,
    guardrailKW,
    regime,
    sig,
    status,
    costSavingsPerHr,
    carbonOffsetPerHr,
    gridDependencyReduction,
    agentSavingsPerHr,
  };
}

// 24h outlook at the current weather/stress, sampled every 30 minutes.
export function forecastDay({ cloud, stress, evQueueKWh = 0, soc = 60 }) {
  return Array.from({ length: 49 }, (_, i) => {
    const hour = i / 2;
    const g = computeGrid({ cloud, stress, soc, hour, evQueueKWh });
    return {
      hour,
      solar: g.solarKW,
      demand: g.rawLoad,
      load: g.optimizedLoad,
      grid: g.gridImport,
      period: g.tariff.period,
    };
  });
}

const ts = () => new Date().toLocaleTimeString('en-IN', { hour12: false });

let logSeq = 0;
export const makeLog = (type, text) => ({ id: ++logSeq, time: ts(), type, text });

const RESTORE_LABELS = {
  hvac: 'HVAC units restored to 100% comfort setpoint',
  ev: 'EV charging queue resumed — deferral cancelled',
  pumps: 'Water pumps returned to normal schedule',
  lighting: 'Lighting restored to full brightness',
  kitchen: 'Cafeteria appliance staggering released',
};

function clockEvents(grid, prev) {
  const L = [];
  const t = fmtClock(grid.hour);
  if (!prev || prev.tariff.period !== grid.tariff.period) {
    L.push(['sensor', `[${t}] Tariff window → ${grid.tariff.label} (₹${grid.tariff.rate}/kWh)`]);
    if (grid.tariff.period === 'peak') L.push(['info', 'Evening peak: prioritising battery dispatch and flexible load to avoid ₹9.5 imports']);
    if (grid.tariff.period === 'offpeak') L.push(['info', `Off-peak: import cap relaxed to ${grid.importCap} kW — buying cheap grid energy, preserving battery for tomorrow`]);
    if (grid.tariff.period === 'normal') L.push(['info', `Standard tariff: contract cap back to ${grid.importCap} kW`]);
  }
  if (prev && prev.phase.id !== grid.phase.id) {
    const msg = {
      dawn: 'Sunrise — PV array energising, irradiance ramping up',
      day: 'Full daylight — solar is now the primary supply',
      dusk: 'Sunset approaching — solar output tapering, pre-positioning battery',
      night: 'Night — PV offline, running on storage and off-peak grid',
    }[grid.phase.id];
    L.push(['sensor', `[${t}] ${msg}`]);
  }
  const evOn = grid.evNightKW > 0.5;
  const evWas = (prev?.evNightKW ?? 0) > 0.5;
  if (evOn && !evWas) {
    L.push(['action', `Executing deferred EV queue at off-peak ₹${CONFIG.TARIFF_OFFPEAK_INR}/kWh: charging ${grid.evNightKW.toFixed(1)} kW (${grid.evQueueKWh.toFixed(1)} kWh pending)`]);
  } else if (!evOn && evWas) {
    L.push(
      grid.evQueueKWh < 0.5
        ? ['success', 'Deferred EV queue fully charged at off-peak rates']
        : ['info', `Off-peak window closed — ${grid.evQueueKWh.toFixed(1)} kWh of EV charging carried to next window`],
    );
  }
  if (!L.length) L.push(['sensor', `[${t}] Demand profile shift: campus ${grid.rawLoad.toFixed(1)} kW, solar ${grid.solarKW.toFixed(1)} kW`]);
  return L;
}

// Turn a state transition into the agent's reasoning trace.
export function buildAgentTrace(grid, prev, reason) {
  const L = [];
  const f = (n) => n.toFixed(1);

  if (reason === 'weather') {
    L.push(['sensor', `Weather telemetry: cloud cover ${prev ? `${prev.cloud}% → ` : ''}${grid.cloud}% | irradiance factor ${grid.irradiance.toFixed(2)}`]);
  } else if (reason === 'stress-on') {
    L.push(['critical', 'GRID STRESS TEST INITIATED — simulating heatwave + EV fleet surge (+65 kW demand)']);
  } else if (reason === 'stress-off') {
    L.push(['system', 'Stress test concluded. Campus demand returning to nominal profile.']);
  } else if (reason === 'battery-reserve') {
    L.push(['warn', `Battery SOC hit ${CONFIG.BATTERY_RESERVE_PCT}% reserve floor — discharge locked to protect cell health`]);
  } else if (reason === 'battery-recovered') {
    L.push(['system', 'Battery recovered above reserve floor — dispatch capacity restored']);
  } else if (reason === 'time-jump') {
    L.push(['sensor', `Clock set to ${fmtClock(grid.hour)} · ${grid.phase.label} · ${grid.tariff.label} tariff ₹${grid.tariff.rate}/kWh`]);
  } else if (reason === 'clock') {
    L.push(...clockEvents(grid, prev));
  } else if (reason === 'llm') {
    L.push(['llm', 'Applying Gemini dispatch plan — rule policy standing by as safety guardrail']);
  }

  L.push(['info', `Analyzing balance: solar ${f(grid.solarKW)} kW vs demand ${f(grid.rawLoad)} kW`]);

  if (grid.deficit > 0.5) {
    L.push(['warn', `Deficit detected: -${Math.round(grid.deficit)} kW`]);
    L.push([
      'info',
      grid.batteryLocked
        ? 'Battery dispatch unavailable (reserve lock). Re-planning with load flexibility only.'
        : `Battery dispatch headroom: ${grid.batteryAvailKW} kW (SOC ${grid.soc.toFixed(0)}%)`,
    ]);
    if (grid.tariff.period === 'offpeak' && grid.gridImport > 0.5 && grid.batteryKW < 0.5) {
      L.push(['info', `Off-peak arbitrage: serving deficit from grid at ₹${CONFIG.TARIFF_OFFPEAK_INR}/kWh, holding battery for the next peak`]);
    }
  } else {
    L.push(['success', `Surplus detected: +${Math.round(-grid.deficit)} kW`]);
  }

  const incremental = reason === 'weather' || reason === 'clock';
  const prevById = Object.fromEntries((prev?.actions ?? []).map((a) => [a.id, a]));
  const curIds = new Set(grid.actions.map((a) => a.id));
  const verb = grid.planSource === 'llm' ? 'Executing Gemini action' : 'Executing action';

  grid.actions.forEach((a) => {
    const old = prevById[a.id];
    if (!incremental || !old || Math.abs(old.frac - a.frac) > 0.02) L.push(['action', `${verb}: ${a.text}`]);
  });
  Object.keys(prevById).forEach((id) => {
    if (!curIds.has(id)) L.push(['success', `Restoring load: ${RESTORE_LABELS[id]}`]);
  });
  if (grid.guardrailKW > 0.5) {
    L.push(['warn', `Guardrail top-up: rule policy added ${f(grid.guardrailKW)} kW of shedding to honour the ${grid.importCap} kW cap`]);
  }

  if (grid.batteryKW > 0.5) L.push(['action', `Dispatching battery: ${f(grid.batteryKW)} kW discharge`]);
  else if (grid.batteryKW < -0.5) L.push(['action', `Routing surplus to storage: charging at ${f(-grid.batteryKW)} kW`]);

  if (grid.gridExport > 0.5) L.push(['success', `Exporting ${f(grid.gridExport)} kW to utility at ₹${CONFIG.EXPORT_RATE_INR}/kWh`]);

  if (grid.status === 'critical') {
    L.push(['critical', `Grid import ${f(grid.gridImport)} kW exceeds ${grid.importCap} kW contract cap — flexible load exhausted, requesting utility demand-response`]);
  } else {
    if (grid.gridImport > 0.5) L.push(['info', `Utility import held at ${f(grid.gridImport)} kW (cap ${grid.importCap} kW, ₹${grid.tariff.rate}/kWh)`]);
    L.push(['success', `Grid balanced. Savings ₹${Math.round(grid.costSavingsPerHr).toLocaleString('en-IN')}/hr · autonomous mode holding.`]);
  }

  return L.map(([type, text]) => makeLog(type, text));
}
