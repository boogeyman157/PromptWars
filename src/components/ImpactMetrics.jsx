import { BrainCircuit, IndianRupee, Leaf, TrendingDown } from 'lucide-react';
import useAnimatedNumber from '../hooks/useAnimatedNumber';
import { CONFIG } from '../lib/simulation';

const inr = (v, d = 0) => v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

function Metric({ icon: Icon, label, value, format, unit, prefix, sub, accent, glow, progress }) {
  const v = useAnimatedNumber(value);
  return (
    <div className={`panel overflow-hidden p-5 hover:-translate-y-0.5 ${glow}`}>
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl ${accent.bg}`} />
      <div className="mb-3 flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${accent.iconBg}`}>
          <Icon className={`h-4 w-4 ${accent.text}`} />
        </div>
        <span className="stat-label">{label}</span>
      </div>
      <p className={`font-mono text-3xl font-bold tracking-tight ${accent.text}`}>
        {prefix}
        {format(v)}
        <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>
      </p>
      {progress != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full transition-all duration-700 ${accent.bar}`} style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export default function ImpactMetrics({ grid, totals }) {
  return (
    <section aria-labelledby="impact-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 id="impact-title" className="panel-title">
          <Leaf className="h-4 w-4 text-emerald-400" /> Live Impact Metrics
        </h2>
        <p className="font-mono text-[11px] text-slate-500">
          vs. unmanaged grid-only campus · {grid.tariff.label} tariff ₹{grid.tariff.rate}/kWh · {CONFIG.EMISSION_FACTOR_KG_PER_KWH} kg CO₂/kWh · session {totals.minutes} sim-min
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={IndianRupee}
          label="Hourly Cost Savings"
          value={grid.costSavingsPerHr}
          format={(v) => inr(v)}
          prefix="₹"
          unit="/hr"
          sub={<>Session total: <span className="font-mono text-slate-300">₹{inr(totals.savings, 2)}</span></>}
          accent={{ text: 'text-emerald-300', bg: 'bg-emerald-400', iconBg: 'bg-emerald-400/15' }}
          glow="hover:shadow-glow-green"
        />
        <Metric
          icon={Leaf}
          label="Carbon Offset"
          value={grid.carbonOffsetPerHr}
          format={(v) => v.toFixed(1)}
          unit="kg CO₂/hr"
          sub={<>Session total: <span className="font-mono text-slate-300">{totals.carbon.toFixed(2)} kg CO₂</span></>}
          accent={{ text: 'text-teal-300', bg: 'bg-teal-400', iconBg: 'bg-teal-400/15' }}
          glow="hover:shadow-glow-green"
        />
        <Metric
          icon={TrendingDown}
          label="Grid Dependency Reduction"
          value={grid.gridDependencyReduction}
          format={(v) => v.toFixed(1)}
          unit="%"
          progress={grid.gridDependencyReduction}
          sub={<>Utility import: <span className="font-mono text-slate-300">{grid.gridImport.toFixed(1)} kW</span> of {grid.rawLoad.toFixed(1)} kW demand</>}
          accent={{ text: 'text-sky-300', bg: 'bg-sky-400', iconBg: 'bg-sky-400/15', bar: 'bg-gradient-to-r from-sky-500 to-emerald-400' }}
          glow="hover:shadow-glow-blue"
        />
        <Metric
          icon={BrainCircuit}
          label="AI Agent Contribution"
          value={grid.agentSavingsPerHr}
          format={(v) => inr(v)}
          prefix="₹"
          unit="/hr"
          sub={<>{grid.actions.length} active actions · <span className="font-mono text-slate-300">{totals.energyShed.toFixed(1)} kWh</span> load optimized</>}
          accent={{ text: 'text-violet-300', bg: 'bg-violet-400', iconBg: 'bg-violet-400/15' }}
          glow="hover:shadow-glow-blue"
        />
      </div>
    </section>
  );
}
