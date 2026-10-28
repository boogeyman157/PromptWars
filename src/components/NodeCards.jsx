import { AirVent, BatteryCharging, Building2, CarFront, Cpu, Droplets, Lightbulb, Sun, UtensilsCrossed } from 'lucide-react';
import useAnimatedNumber from '../hooks/useAnimatedNumber';
import { CONFIG } from '../lib/simulation';

const APPLIANCE_ICONS = { hvac: AirVent, labs: Cpu, ev: CarFront, lighting: Lightbulb, pumps: Droplets, kitchen: UtensilsCrossed };

const TONES = {
  green: { ring: 'hover:border-emerald-400/50 hover:shadow-glow-green', icon: 'bg-emerald-400/15 text-emerald-300', text: 'text-emerald-300' },
  blue: { ring: 'hover:border-sky-400/50 hover:shadow-glow-blue', icon: 'bg-sky-400/15 text-sky-300', text: 'text-sky-300' },
  amber: { ring: 'hover:border-amber-400/50 hover:shadow-glow-amber', icon: 'bg-amber-400/15 text-amber-300', text: 'text-amber-300' },
};

function Num({ value, decimals = 1 }) {
  const v = useAnimatedNumber(value);
  return <>{v.toFixed(decimals)}</>;
}

function StatusPill({ tone, children }) {
  const cls = {
    good: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
    warn: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
    bad: 'bg-rose-500/10 text-rose-300 border-rose-400/30',
    info: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  }[tone];
  const dot = { good: 'bg-emerald-400', warn: 'bg-amber-400', bad: 'bg-rose-400', info: 'bg-sky-400' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors duration-500 ${cls}`}>
      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${dot}`} />
      {children}
    </span>
  );
}

function NodeCard({ tone, node, title, icon: Icon, status, children }) {
  const t = TONES[tone];
  return (
    <article className={`panel group flex flex-col p-5 ${t.ring}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{node}</p>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          </div>
        </div>
        {status}
      </div>
      {children}
    </article>
  );
}

function Bar({ pct, className }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function SolarCard({ grid }) {
  const outputPct = (grid.solarKW / CONFIG.SOLAR_PEAK_KW) * 100;
  const status =
    outputPct > 65 ? <StatusPill tone="good">Peak Generation</StatusPill> : outputPct > 30 ? <StatusPill tone="warn">Reduced Output</StatusPill> : <StatusPill tone="bad">Low Irradiance</StatusPill>;
  return (
    <NodeCard tone="amber" node="Node A" title="Solar Generation" icon={Sun} status={status}>
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="font-mono text-4xl font-bold tracking-tight text-amber-200">
          <Num value={grid.solarKW * 1000} decimals={0} />
        </span>
        <span className="text-sm text-slate-400">W</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        <Num value={grid.solarKW} /> kW of {CONFIG.SOLAR_PEAK_KW} kWp array capacity
      </p>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="stat-label">Array Output</span>
            <span className="font-mono text-slate-300"><Num value={outputPct} decimals={0} />%</span>
          </div>
          <Bar pct={outputPct} className="bg-gradient-to-r from-amber-500 to-yellow-300" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-grid-850/80 p-2.5">
            <p className="stat-label">Efficiency</p>
            <p className="font-mono text-lg font-semibold text-slate-100"><Num value={grid.solarEfficiency} />%</p>
          </div>
          <div className="rounded-lg bg-grid-850/80 p-2.5">
            <p className="stat-label">Irradiance</p>
            <p className="font-mono text-lg font-semibold text-slate-100"><Num value={grid.irradiance * 1000} decimals={0} /><span className="text-xs text-slate-500"> W/m²</span></p>
          </div>
        </div>
      </div>
    </NodeCard>
  );
}

export function BatteryCard({ grid, soc }) {
  const stored = (soc / 100) * CONFIG.BATTERY_CAPACITY_KWH;
  const discharging = grid.batteryKW > 0.5;
  const charging = grid.batteryKW < -0.5;
  const status = grid.batteryLocked ? (
    <StatusPill tone="bad">Reserve Lock</StatusPill>
  ) : discharging ? (
    <StatusPill tone="warn">Discharging</StatusPill>
  ) : charging ? (
    <StatusPill tone="good">Charging</StatusPill>
  ) : (
    <StatusPill tone="info">Standby</StatusPill>
  );
  const fill = soc > 50 ? 'from-emerald-500 to-emerald-300' : soc > 25 ? 'from-amber-500 to-amber-300' : 'from-rose-600 to-rose-400';
  const minsToReserve = discharging ? ((soc - CONFIG.BATTERY_RESERVE_PCT) / 100) * CONFIG.BATTERY_CAPACITY_KWH / grid.batteryKW * 60 : null;

  return (
    <NodeCard tone="green" node="Node B" title="Battery Storage" icon={BatteryCharging} status={status}>
      <div className="mb-4 flex items-center gap-4">
        <div className="relative h-16 flex-1 rounded-xl border-2 border-slate-600 p-1">
          <div className="absolute -right-2 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r bg-slate-600" />
          <div className={`relative h-full overflow-hidden rounded-lg bg-gradient-to-r transition-all duration-700 ${fill}`} style={{ width: `${soc}%` }}>
            {(charging || discharging) && (
              <div className={`absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent ${discharging ? 'rotate-180' : ''}`} />
            )}
          </div>
          <div className="absolute left-0 top-1/2 h-full border-l border-dashed border-rose-400/60" style={{ left: `${CONFIG.BATTERY_RESERVE_PCT}%`, transform: 'translateY(-50%)' }} title="Reserve floor" />
          <span className="absolute inset-0 grid place-items-center font-mono text-xl font-bold text-white drop-shadow">
            <span><Num value={soc} />%</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-grid-850/80 p-2.5">
          <p className="stat-label">Stored</p>
          <p className="font-mono text-lg font-semibold text-slate-100"><Num value={stored} decimals={0} /><span className="text-xs text-slate-500"> / {CONFIG.BATTERY_CAPACITY_KWH} kWh</span></p>
        </div>
        <div className="rounded-lg bg-grid-850/80 p-2.5">
          <p className="stat-label">Flow</p>
          <p className={`font-mono text-lg font-semibold ${discharging ? 'text-amber-300' : charging ? 'text-emerald-300' : 'text-slate-300'}`}>
            {discharging ? '−' : charging ? '+' : ''}<Num value={Math.abs(grid.batteryKW)} /><span className="text-xs text-slate-500"> kW</span>
          </p>
        </div>
        <div className="rounded-lg bg-grid-850/80 p-2.5">
          <p className="stat-label">Health</p>
          <p className="font-mono text-lg font-semibold text-emerald-300">{CONFIG.BATTERY_HEALTH_PCT}%</p>
        </div>
        <div className="rounded-lg bg-grid-850/80 p-2.5">
          <p className="stat-label">{discharging ? 'To Reserve' : 'Reserve'}</p>
          <p className="font-mono text-lg font-semibold text-slate-100">
            {minsToReserve != null ? `${Math.max(0, Math.round(minsToReserve))} min` : `${CONFIG.BATTERY_RESERVE_PCT}%`}
          </p>
        </div>
      </div>
    </NodeCard>
  );
}

export function LoadCard({ grid }) {
  const status = grid.shedKW > 0.05 ? <StatusPill tone="warn">AI Shedding</StatusPill> : <StatusPill tone="good">Nominal</StatusPill>;
  const maxDemand = Math.max(...grid.appliances.map((a) => a.demand));
  return (
    <NodeCard tone="blue" node="Node C" title="Campus Load" icon={Building2} status={status}>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-bold tracking-tight text-sky-200"><Num value={grid.optimizedLoad} /></span>
        <span className="text-sm text-slate-400">kW active</span>
      </div>
      <p className="mb-3 min-h-4 text-xs text-slate-500">
        {grid.shedKW > 0.05 ? (
          <>
            Raw demand <span className="font-mono text-slate-400 line-through">{grid.rawLoad.toFixed(1)} kW</span> ·{' '}
            <span className="text-amber-300">−{grid.shedKW.toFixed(1)} kW optimized</span>
          </>
        ) : (
          'All appliances running at full capacity'
        )}
      </p>
      <ul className="space-y-2">
        {grid.appliances.map((a) => {
          const Icon = APPLIANCE_ICONS[a.id];
          const shedPct = Math.round(a.shedFrac * 100);
          const deferrable = a.id === 'ev' || a.id === 'pumps';
          return (
            <li key={a.id} className="text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-300">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{a.name}</span>
                  {a.critical && <span className="rounded bg-slate-700/70 px-1 text-[9px] uppercase text-slate-400">critical</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {shedPct > 0 && (
                    <span className="animate-fade-in-up rounded bg-amber-400/15 px-1.5 font-mono text-[10px] text-amber-300">
                      {deferrable && shedPct >= 100 ? 'deferred' : `−${shedPct}%`}
                    </span>
                  )}
                  <span className="w-14 text-right font-mono text-slate-200">{a.active.toFixed(1)} kW</span>
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400/30 transition-all duration-700" style={{ width: `${(a.demand / maxDemand) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all duration-700" style={{ width: `${(a.active / maxDemand) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </NodeCard>
  );
}
