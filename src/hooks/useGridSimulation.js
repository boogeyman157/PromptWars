import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG, buildAgentTrace, computeGrid, fmtClock, makeLog } from '../lib/simulation';
import { consultGemini, loadLlmSettings, saveLlmSettings } from '../lib/gemini';

const DEFAULTS = { cloud: 15, stress: false, soc: 72, hour: CONFIG.DEFAULT_HOUR, speed: 1, evQueue: 0 };
const MAX_LOGS = 250;
const AUTO_CONSULT_MIN_MS = 15000;
const EMPTY_TOTALS = { savings: 0, carbon: 0, energyShed: 0, minutes: 0 };
const LLM_IDLE = { status: 'idle', error: null, summary: null };

const bootLogs = () => [
  makeLog('system', 'GridMind Agent v3.0 online — autonomous dispatch mode engaged'),
  makeLog('system', 'Handshake OK: Node A (Solar PV 150 kWp) · Node B (Li-ion 400 kWh) · Node C (Campus Load)'),
  makeLog(
    'info',
    `Policy loaded: tiered load-shedding · import cap ${CONFIG.GRID_IMPORT_CAP_KW} kW (${CONFIG.GRID_IMPORT_CAP_OFFPEAK_KW} kW off-peak) · battery reserve ${CONFIG.BATTERY_RESERVE_PCT}%`,
  ),
];

export default function useGridSimulation() {
  const [cloud, setCloud] = useState(DEFAULTS.cloud);
  const [stress, setStress] = useState(DEFAULTS.stress);
  const [soc, setSoc] = useState(DEFAULTS.soc);
  const [hour, setHour] = useState(DEFAULTS.hour);
  const [speed, setSpeed] = useState(DEFAULTS.speed);
  const [evQueue, setEvQueue] = useState(DEFAULTS.evQueue);
  const [override, setOverride] = useState(null);
  const [noise, setNoise] = useState({ solar: 1, load: 1 });
  const [logs, setLogs] = useState(bootLogs);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [agentBusy, setAgentBusy] = useState(false);
  const [planNonce, setPlanNonce] = useState(0);
  const [llmSettings, setLlmSettings] = useState(loadLlmSettings);
  const [llm, setLlm] = useState(LLM_IDLE);

  const grid = useMemo(
    () => computeGrid({ cloud, stress, soc, hour, evQueueKWh: evQueue, override, noise }),
    [cloud, stress, soc, hour, evQueue, override, noise],
  );

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const settingsRef = useRef(llmSettings);
  settingsRef.current = llmSettings;
  const lastPlannedRef = useRef(null);
  const timersRef = useRef([]);
  const pendingRef = useRef([]);
  const reasonRef = useRef('boot');
  const abortRef = useRef(null);
  const lastConsultRef = useRef(0);
  const consultRef = useRef(null);

  const appendLogs = useCallback((entries) => setLogs((prev) => [...prev, ...entries].slice(-MAX_LOGS)), []);

  const flushPending = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const rest = pendingRef.current;
    pendingRef.current = [];
    if (rest.length) setLogs((prev) => [...prev, ...rest].slice(-MAX_LOGS));
  };

  const streamLogs = useCallback((entries) => {
    flushPending();
    pendingRef.current = [...entries];
    setAgentBusy(true);
    entries.forEach((entry, i) => {
      timersRef.current.push(
        setTimeout(() => {
          pendingRef.current = pendingRef.current.filter((e) => e !== entry);
          setLogs((prev) => [...prev, entry].slice(-MAX_LOGS));
          if (i === entries.length - 1) setAgentBusy(false);
        }, 70 * (i + 1)),
      );
    });
  }, []);

  // Physics tick: sim clock, battery SOC, EV queue, cumulative impact, sensor noise.
  useEffect(() => {
    const id = setInterval(() => {
      const mins = speedRef.current;
      if (!mins) return;
      const g = gridRef.current;
      const hours = mins / 60;
      setSoc((prev) => {
        const next = prev - ((g.batteryKW * hours) / CONFIG.BATTERY_CAPACITY_KWH) * 100;
        if (g.batteryKW > 0) return Math.max(CONFIG.BATTERY_RESERVE_PCT, next);
        return Math.min(100, next);
      });
      setEvQueue((q) => Math.max(0, q + (g.evShedKW - g.evNightKW) * hours));
      setHour((h) => (h + hours) % 24);
      setTotals((t) => ({
        savings: t.savings + g.costSavingsPerHr * hours,
        carbon: t.carbon + g.carbonOffsetPerHr * hours,
        energyShed: t.energyShed + g.shedKW * hours,
        minutes: t.minutes + mins,
      }));
      setNoise({ solar: 1 + (Math.random() - 0.5) * 0.03, load: 1 + (Math.random() - 0.5) * 0.02 });
    }, CONFIG.TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Agent reasoning: re-plan whenever the operating point (weather, stress, clock regime, battery) changes.
  useEffect(() => {
    const t = setTimeout(() => {
      const g = gridRef.current;
      const reason = reasonRef.current;
      streamLogs(buildAgentTrace(g, lastPlannedRef.current, reason));
      lastPlannedRef.current = g;
      reasonRef.current = 'clock';
      const s = settingsRef.current;
      const needsPlan = g.shedKW > 0.05 || g.status !== 'optimal';
      if (reason !== 'llm' && s.auto && s.apiKey && needsPlan && Date.now() - lastConsultRef.current > AUTO_CONSULT_MIN_MS) {
        consultRef.current?.('auto');
      }
    }, reasonRef.current === 'weather' ? 220 : 0);
    return () => clearTimeout(t);
  }, [cloud, stress, grid.sig, override, planNonce, streamLogs]);

  const batteryLocked = grid.batteryLocked;
  useEffect(() => {
    if (lastPlannedRef.current && batteryLocked !== lastPlannedRef.current.batteryLocked) {
      reasonRef.current = batteryLocked ? 'battery-reserve' : 'battery-recovered';
    }
  }, [batteryLocked]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
      abortRef.current?.abort();
    },
    [],
  );

  const cancelLlm = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setOverride(null);
    setLlm(LLM_IDLE);
  };

  const consult = useCallback(
    async (trigger = 'manual') => {
      const { apiKey, model } = settingsRef.current;
      if (!apiKey) {
        setLlm({ status: 'error', error: 'Add a Gemini API key in agent settings', summary: null });
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      lastConsultRef.current = Date.now();
      const g = gridRef.current;
      setLlm({ status: 'thinking', error: null, summary: null });
      appendLogs([
        makeLog('llm', `${trigger === 'auto' ? 'Auto-consulting' : 'Consulting'} Gemini (${model}) with live telemetry @ ${fmtClock(g.hour)}…`),
      ]);
      try {
        const plan = await consultGemini({ apiKey, model, grid: g, signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        const cur = gridRef.current;
        if (cur.regime !== g.regime) {
          appendLogs([makeLog('warn', 'Operating regime changed while Gemini was reasoning — plan discarded, rule policy retained')]);
          setLlm(LLM_IDLE);
          return;
        }
        const entries = plan.reasoning.map((t) => makeLog('llm', t));
        if (plan.summary) entries.push(makeLog('llm', `Plan: ${plan.summary}`));
        appendLogs(entries);
        reasonRef.current = 'llm';
        setOverride({ sig: cur.sig, shed: plan.shed });
        setLlm({ status: 'idle', error: null, summary: plan.summary });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        appendLogs([makeLog('warn', `Gemini unavailable (${e.message}) — continuing with rule-based policy`)]);
        setLlm({ status: 'error', error: e.message, summary: null });
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [appendLogs],
  );
  consultRef.current = consult;

  const updateCloud = useCallback((value) => {
    reasonRef.current = 'weather';
    cancelLlm();
    setCloud(value);
  }, []);

  const toggleStress = useCallback(() => {
    cancelLlm();
    setStress((s) => {
      reasonRef.current = s ? 'stress-off' : 'stress-on';
      return !s;
    });
  }, []);

  const jumpToHour = useCallback((value) => {
    reasonRef.current = 'time-jump';
    cancelLlm();
    setHour(value);
    setPlanNonce((n) => n + 1);
  }, []);

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    pendingRef.current = [];
    cancelLlm();
    reasonRef.current = 'reset';
    lastPlannedRef.current = null;
    setCloud(DEFAULTS.cloud);
    setStress(DEFAULTS.stress);
    setSoc(DEFAULTS.soc);
    setHour(DEFAULTS.hour);
    setSpeed(DEFAULTS.speed);
    setEvQueue(DEFAULTS.evQueue);
    setTotals(EMPTY_TOTALS);
    setAgentBusy(false);
    setLogs([makeLog('system', 'Manual reset — restoring default operating profile'), ...bootLogs()]);
    setPlanNonce((n) => n + 1);
  }, []);

  const clearLogs = useCallback(() => setLogs([makeLog('system', 'Log buffer cleared')]), []);

  const updateLlmSettings = useCallback((patch) => {
    setLlmSettings((s) => {
      const next = { ...s, ...patch };
      saveLlmSettings(next);
      return next;
    });
  }, []);

  return {
    grid,
    cloud,
    stress,
    soc,
    hour,
    speed,
    logs,
    totals,
    agentBusy,
    llm,
    llmSettings,
    setCloud: updateCloud,
    toggleStress,
    setHour: jumpToHour,
    setSpeed,
    reset,
    clearLogs,
    consult,
    updateLlmSettings,
  };
}
