import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG, buildAgentTrace, computeGrid, makeLog } from '../lib/simulation';

const DEFAULTS = { cloud: 15, stress: false, soc: 72 };
const MAX_LOGS = 250;
const EMPTY_TOTALS = { savings: 0, carbon: 0, energyShed: 0, minutes: 0 };

const bootLogs = () => [
  makeLog('system', 'GridMind Agent v2.4 online — autonomous dispatch mode engaged'),
  makeLog('system', 'Handshake OK: Node A (Solar PV 150 kWp) · Node B (Li-ion 400 kWh) · Node C (Campus Load)'),
  makeLog('info', `Policy loaded: tiered load-shedding · grid import cap ${CONFIG.GRID_IMPORT_CAP_KW} kW · battery reserve ${CONFIG.BATTERY_RESERVE_PCT}%`),
];

export default function useGridSimulation() {
  const [cloud, setCloud] = useState(DEFAULTS.cloud);
  const [stress, setStress] = useState(DEFAULTS.stress);
  const [soc, setSoc] = useState(DEFAULTS.soc);
  const [noise, setNoise] = useState({ solar: 1, load: 1 });
  const [logs, setLogs] = useState(bootLogs);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [agentBusy, setAgentBusy] = useState(false);
  const [planNonce, setPlanNonce] = useState(0);

  const grid = useMemo(() => computeGrid({ cloud, stress, soc, noise }), [cloud, stress, soc, noise]);

  const gridRef = useRef(grid);
  gridRef.current = grid;
  const lastPlannedRef = useRef(null);
  const timersRef = useRef([]);
  const reasonRef = useRef('boot');

  const pendingRef = useRef([]);

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

  // Physics tick: battery state of charge, cumulative impact, sensor noise.
  useEffect(() => {
    const id = setInterval(() => {
      const g = gridRef.current;
      const hours = CONFIG.SIM_MINUTES_PER_TICK / 60;
      setSoc((prev) => {
        const next = prev - ((g.batteryKW * hours) / CONFIG.BATTERY_CAPACITY_KWH) * 100;
        if (g.batteryKW > 0) return Math.max(CONFIG.BATTERY_RESERVE_PCT, next);
        return Math.min(100, next);
      });
      setTotals((t) => ({
        savings: t.savings + g.costSavingsPerHr * hours,
        carbon: t.carbon + g.carbonOffsetPerHr * hours,
        energyShed: t.energyShed + g.shedKW * hours,
        minutes: t.minutes + CONFIG.SIM_MINUTES_PER_TICK,
      }));
      setNoise({ solar: 1 + (Math.random() - 0.5) * 0.03, load: 1 + (Math.random() - 0.5) * 0.02 });
    }, CONFIG.TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Agent reasoning: re-plan when weather, stress or battery availability changes.
  const batteryLocked = grid.batteryLocked;
  useEffect(() => {
    const t = setTimeout(() => {
      const g = gridRef.current;
      streamLogs(buildAgentTrace(g, lastPlannedRef.current, reasonRef.current));
      lastPlannedRef.current = g;
    }, reasonRef.current === 'weather' ? 220 : 0);
    return () => clearTimeout(t);
  }, [cloud, stress, batteryLocked, planNonce, streamLogs]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  const updateCloud = useCallback((value) => {
    reasonRef.current = 'weather';
    setCloud(value);
  }, []);

  const toggleStress = useCallback(() => {
    setStress((s) => {
      reasonRef.current = s ? 'stress-off' : 'stress-on';
      return !s;
    });
  }, []);

  useEffect(() => {
    if (lastPlannedRef.current && batteryLocked !== lastPlannedRef.current.batteryLocked) {
      reasonRef.current = batteryLocked ? 'battery-reserve' : 'battery-recovered';
    }
  }, [batteryLocked]);

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    pendingRef.current = [];
    reasonRef.current = 'reset';
    lastPlannedRef.current = null;
    setCloud(DEFAULTS.cloud);
    setStress(DEFAULTS.stress);
    setSoc(DEFAULTS.soc);
    setTotals(EMPTY_TOTALS);
    setAgentBusy(false);
    setLogs([makeLog('system', 'Manual reset — restoring default operating profile'), ...bootLogs()]);
    setPlanNonce((n) => n + 1);
  }, []);

  const clearLogs = useCallback(() => setLogs([makeLog('system', 'Log buffer cleared')]), []);

  return { grid, cloud, stress, soc, logs, totals, agentBusy, setCloud: updateCloud, toggleStress, reset, clearLogs };
}
