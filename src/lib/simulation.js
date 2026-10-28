// Physical + economic model for the GridMind micro-grid.
// Everything here is pure so the UI can derive state synchronously from inputs.

export const CONFIG = {
  SOLAR_PEAK_KW: 150,
  DAYLIGHT_FACTOR: 0.94,
  PANEL_EFFICIENCY_PCT: 22.4,
  BATTERY_CAPACITY_KWH: 400,
  BATTERY_MAX_DISCHARGE_KW: 45,
  BATTERY_MAX_CHARGE_KW: 70,
  BATTERY_RESERVE_PCT: 20,
  BATTERY_HEALTH_PCT: 96.8,
  BATTERY_ROUND_TRIP: 0.9,
  BATTERY_LCOS_INR: 6.2, // levelized cost of stored energy (wear + replacement)
  GRID_IMPORT_CAP_KW: 15,
  TARIFF_PEAK_INR: 9.5,
  TARIFF_OFFPEAK_INR: 4.5,
  EXPORT_RATE_INR: 3.2,
  EMISSION_FACTOR_KG_PER_KWH: 0.716, // CEA India grid baseline
  SIM_MINUTES_PER_TICK: 1,
  TICK_MS: 1000,
};

export const APPLIANCES = [
  { id: 'hvac', name: 'HVAC Systems', base: 48, stress: 30, maxShed: 0.35 },
  { id: 'labs', name: 'Labs & Data Center', base: 30, stress: 8, maxShed: 0, critical: true },
  { id: 'ev', name: 'EV Charging Bay', base: 26, stress: 20, maxShed: 1 },
  { id: 'lighting', name: 'Smart Lighting', base: 16, stress: 4, maxShed: 0.4 },
  { id: 'pumps', name: 'Water Pumps', base: 10, stress: 3, maxShed: 1 },
  { id: 'kitchen', name: 'Cafeteria & Kitchen', base: 8, stress: 0, maxShed: 0.25 },
];

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

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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

export function computeGrid({ cloud, stress, soc, noise = { solar: 1, load: 1 } }) {
  const c = clamp(cloud, 0, 100) / 100;
  const irradiance = 1 - 0.88 * Math.pow(c, 1.15);
  const solarKW = CONFIG.SOLAR_PEAK_KW * CONFIG.DAYLIGHT_FACTOR * irradiance * noise.solar;
  const solarEfficiency = CONFIG.PANEL_EFFICIENCY_PCT * (1 - 0.22 * c) * (0.99 + 0.01 * noise.solar);

  const appliances = APPLIANCES.map((a) => ({
    ...a,
    demand: (a.base + (stress ? a.stress : 0)) * noise.load,
    shedFrac: 0,
  }));
  const byId = Object.fromEntries(appliances.map((a) => [a.id, a]));
  const rawLoad = appliances.reduce((s, a) => s + a.demand, 0);

  const batteryLocked = soc <= CONFIG.BATTERY_RESERVE_PCT;
  const batteryFull = soc >= 99.9;
  const batteryAvailKW = batteryLocked ? 0 : CONFIG.BATTERY_MAX_DISCHARGE_KW;

  const deficit = rawLoad - solarKW;
  let need = deficit - batteryAvailKW - CONFIG.GRID_IMPORT_CAP_KW;

  for (const tier of SHED_TIERS) {
    if (need <= 0.05) break;
    const a = byId[tier.id];
    const room = a.demand * (tier.upTo - a.shedFrac);
    if (room <= 0) continue;
    const take = Math.min(room, need);
    let frac = a.shedFrac + take / a.demand;
    if (STEPPED.has(a.id)) frac = Math.min(tier.upTo, Math.ceil(frac * 20 - 1e-9) / 20);
    need -= (frac - a.shedFrac) * a.demand;
    a.shedFrac = frac;
  }

  appliances.forEach((a) => {
    a.shedKW = a.demand * a.shedFrac;
    a.active = a.demand - a.shedKW;
  });

  const shedKW = appliances.reduce((s, a) => s + a.shedKW, 0);
  const deferredKW = byId.ev.shedKW + byId.pumps.shedKW;
  const optimizedLoad = rawLoad - shedKW;
  const net = optimizedLoad - solarKW;

  let batteryKW = 0; // + discharge, - charge
  let gridKW = 0; // + import, - export
  if (net > 0) {
    batteryKW = Math.min(net, batteryAvailKW);
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
    .filter((a) => a.shedFrac > 0.001)
    .map((a) => ({ id: a.id, frac: a.shedFrac, kw: a.shedKW, text: describeAction(a.id, a.shedFrac, a.shedKW) }));

  // Impact vs. an unmanaged, grid-only campus drawing the full raw demand at peak tariff.
  const baselineCost = rawLoad * CONFIG.TARIFF_PEAK_INR;
  const batteryDischarge = Math.max(0, batteryKW);
  const actualCost =
    gridImport * CONFIG.TARIFF_PEAK_INR +
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
  const agentSavingsPerHr = Math.max(
    0,
    (passiveImport - gridImport) * CONFIG.TARIFF_PEAK_INR - deferredKW * CONFIG.TARIFF_OFFPEAK_INR,
  );

  let status = 'optimal';
  if (gridImport > CONFIG.GRID_IMPORT_CAP_KW + 0.5) status = 'critical';
  else if (shedKW > 0.05 || batteryLocked) status = 'balancing';

  return {
    cloud,
    stress,
    soc,
    irradiance,
    solarKW,
    solarEfficiency,
    appliances,
    rawLoad,
    optimizedLoad,
    shedKW,
    deferredKW,
    deficit,
    batteryKW,
    batteryAvailKW,
    batteryLocked,
    gridKW,
    gridImport,
    gridExport,
    actions,
    status,
    costSavingsPerHr,
    carbonOffsetPerHr,
    gridDependencyReduction,
    agentSavingsPerHr,
  };
}

const ts = () => new Date().toLocaleTimeString('en-IN', { hour12: false });

let logSeq = 0;
export const makeLog = (type, text) => ({ id: ++logSeq, time: ts(), type, text });

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
  } else {
    L.push(['success', `Surplus detected: +${Math.round(-grid.deficit)} kW`]);
  }

  const prevIds = new Set((prev?.actions ?? []).map((a) => a.id));
  const curIds = new Set(grid.actions.map((a) => a.id));
  const prevById = Object.fromEntries((prev?.actions ?? []).map((a) => [a.id, a]));

  grid.actions.forEach((a) => {
    const old = prevById[a.id];
    if (!old || Math.abs(old.frac - a.frac) > 0.02 || reason !== 'weather') {
      L.push(['action', `Executing action: ${a.text}`]);
    }
  });
  prevIds.forEach((id) => {
    if (!curIds.has(id)) {
      const label = {
        hvac: 'HVAC units restored to 100% comfort setpoint',
        ev: 'EV charging queue resumed — deferral cancelled',
        pumps: 'Water pumps returned to normal schedule',
        lighting: 'Lighting restored to full brightness',
        kitchen: 'Cafeteria appliance staggering released',
      }[id];
      L.push(['success', `Restoring load: ${label}`]);
    }
  });

  if (grid.batteryKW > 0.5) L.push(['action', `Dispatching battery: ${f(grid.batteryKW)} kW discharge`]);
  else if (grid.batteryKW < -0.5) L.push(['action', `Routing surplus to storage: charging at ${f(-grid.batteryKW)} kW`]);

  if (grid.gridExport > 0.5) L.push(['success', `Exporting ${f(grid.gridExport)} kW to utility at ₹${CONFIG.EXPORT_RATE_INR}/kWh`]);

  if (grid.status === 'critical') {
    L.push(['critical', `Grid import ${f(grid.gridImport)} kW exceeds ${CONFIG.GRID_IMPORT_CAP_KW} kW contract cap — flexible load exhausted, requesting utility demand-response`]);
  } else {
    if (grid.gridImport > 0.5) L.push(['info', `Utility import held at ${f(grid.gridImport)} kW (cap ${CONFIG.GRID_IMPORT_CAP_KW} kW)`]);
    L.push(['success', `Grid balanced. Savings ₹${Math.round(grid.costSavingsPerHr).toLocaleString('en-IN')}/hr · autonomous mode holding.`]);
  }

  return L.map(([type, text]) => makeLog(type, text));
}
