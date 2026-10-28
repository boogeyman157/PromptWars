import { fmtClock } from '../lib/simulation';
import { Activity, AlertTriangle, BrainCircuit, RotateCcw, ShieldCheck, Zap } from 'lucide-react';

const STATUS = {
  optimal: {
    label: 'Optimal',
    sub: 'Autonomous Mode Active',
    icon: ShieldCheck,
    cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300 shadow-glow-green',
    dot: 'bg-emerald-400',
  },
  balancing: {
    label: 'Load Balancing',
    sub: 'Autonomous Mode Active',
    icon: Activity,
    cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-glow-amber',
    dot: 'bg-amber-400',
  },
  critical: {
    label: 'Critical Deficit',
    sub: 'Demand-Response Requested',
    icon: AlertTriangle,
    cls: 'border-rose-400/40 bg-rose-500/10 text-rose-300 shadow-glow-red',
    dot: 'bg-rose-400',
  },
};

export default function Header({ status, onReset, hour, tariff }) {
  const s = STATUS[status];
  const Icon = s.icon;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-grid-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-glow-green">
            <Zap className="h-6 w-6 text-grid-950" strokeWidth={2.5} fill="currentColor" />
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-grid-950">
              <BrainCircuit className="h-3 w-3 text-sky-300" />
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">GridMind</span>
            </h1>
            <p className="truncate text-[11px] text-slate-400 sm:text-xs">
              AI-Driven Micro-Grid Energy Distribution &amp; Conservation Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-500 ${s.cls}`}
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${s.dot}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
            </span>
            <Icon className="hidden h-4 w-4 sm:block" />
            <span>
              {s.label}
              <span className="hidden font-medium opacity-80 md:inline"> / {s.sub}</span>
            </span>
          </div>

          <div className="hidden rounded-lg border border-slate-700/60 bg-grid-900/70 px-3 py-1.5 font-mono text-xs text-slate-300 lg:block">
            SIM {fmtClock(hour)} · {tariff.label} ₹{tariff.rate}/kWh
          </div>

          <button
            type="button"
            onClick={onReset}
            className="group flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-400/60 hover:bg-sky-500/10 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title="Reset simulation to defaults"
          >
            <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-180" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
