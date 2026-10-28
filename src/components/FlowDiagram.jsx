import { BatteryCharging, Building2, BrainCircuit, Sun, UtilityPole } from 'lucide-react';

// Energy-flow schematic. Line width scales with power; dash direction shows flow direction.
function FlowLine({ d, kw, color, reverse, max = 150 }) {
  const active = kw > 0.5;
  const width = active ? 2 + Math.min(1, kw / max) * 6 : 1.5;
  return (
    <g>
      <path d={d} fill="none" stroke="#1e293b" strokeWidth={width + 4} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={active ? color : '#334155'}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={active ? '8 4' : '2 6'}
        className={active ? (reverse ? 'animate-flow-reverse' : 'animate-flow') : ''}
        style={{ filter: active ? `drop-shadow(0 0 4px ${color})` : 'none', transition: 'stroke-width 0.6s ease, stroke 0.6s ease' }}
      />
    </g>
  );
}

function NodeBadge({ x, y, icon: Icon, label, value, color }) {
  return (
    <foreignObject x={x - 60} y={y - 34} width="120" height="68">
      <div className="flex h-full flex-col items-center justify-center">
        <div className="grid h-9 w-9 place-items-center rounded-xl border bg-grid-900" style={{ borderColor: `${color}66`, boxShadow: `0 0 16px -4px ${color}` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="font-mono text-[11px] font-semibold text-slate-100">{value}</span>
      </div>
    </foreignObject>
  );
}

export default function FlowDiagram({ grid }) {
  const solarToHub = grid.solarKW;
  const battery = grid.batteryKW;
  const gridFlow = grid.gridKW;
  const hubToLoad = grid.optimizedLoad;
  const kw = (v) => `${Math.abs(v).toFixed(1)} kW`;

  return (
    <section className="panel p-5" aria-labelledby="flow-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="flow-title" className="panel-title">
          <BrainCircuit className="h-4 w-4 text-emerald-400" /> Live Power Flow
        </h2>
        <div className="flex gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-amber-400" />Solar</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-emerald-400" />Battery</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-sky-400" />Utility</span>
        </div>
      </div>
      <svg viewBox="0 0 640 230" className="mx-auto h-auto max-h-[280px] w-full" role="img" aria-label="Micro-grid power flow diagram">
        <FlowLine d="M 90 55 C 200 55, 220 115, 320 115" kw={solarToHub} color="#fbbf24" />
        <FlowLine d="M 90 175 C 200 175, 220 115, 320 115" kw={Math.abs(battery)} color="#34d399" reverse={battery < 0} />
        <FlowLine d="M 550 175 C 440 175, 420 115, 320 115" kw={Math.abs(gridFlow)} color="#38bdf8" reverse={gridFlow < 0} />
        <FlowLine d="M 320 115 C 420 115, 440 55, 550 55" kw={hubToLoad} color="#22d3ee" />

        <circle cx="320" cy="115" r="30" fill="#0a1222" stroke={grid.status === 'critical' ? '#fb7185' : '#34d399'} strokeWidth="2" style={{ transition: 'stroke 0.5s' }} />
        <circle cx="320" cy="115" r="38" fill="none" stroke={grid.status === 'critical' ? '#fb7185' : '#34d399'} strokeOpacity="0.25" strokeWidth="1" className="origin-center animate-pulse" />
        <foreignObject x="296" y="91" width="48" height="48">
          <div className="grid h-full place-items-center">
            <BrainCircuit className={`h-7 w-7 ${grid.status === 'critical' ? 'text-rose-300' : 'text-emerald-300'}`} />
          </div>
        </foreignObject>
        <text x="320" y="168" textAnchor="middle" className="fill-slate-400 font-mono" fontSize="10">GridMind AI Bus</text>

        <NodeBadge x={70} y={55} icon={Sun} label="Solar" value={kw(solarToHub)} color="#fbbf24" />
        <NodeBadge x={70} y={175} icon={BatteryCharging} label={battery < -0.5 ? 'Charging' : battery > 0.5 ? 'Discharging' : 'Battery'} value={kw(battery)} color="#34d399" />
        <NodeBadge x={570} y={55} icon={Building2} label="Campus Load" value={kw(hubToLoad)} color="#22d3ee" />
        <NodeBadge x={570} y={175} icon={UtilityPole} label={gridFlow < -0.5 ? 'Exporting' : 'Utility Grid'} value={kw(gridFlow)} color="#38bdf8" />
      </svg>
    </section>
  );
}
