import { Cloud, CloudLightning, CloudSun, Flame, Gauge, SlidersHorizontal, Sun, Zap } from 'lucide-react';

const PRESETS = [
  { label: 'Clear', value: 0, icon: Sun },
  { label: 'Partly', value: 35, icon: CloudSun },
  { label: 'Overcast', value: 70, icon: Cloud },
  { label: 'Storm', value: 100, icon: CloudLightning },
];

function weatherFor(cloud) {
  if (cloud < 20) return { label: 'Clear Skies', icon: Sun, color: 'text-amber-300' };
  if (cloud < 50) return { label: 'Partly Cloudy', icon: CloudSun, color: 'text-yellow-200' };
  if (cloud < 80) return { label: 'Heavy Overcast', icon: Cloud, color: 'text-slate-300' };
  return { label: 'Monsoon Storm Front', icon: CloudLightning, color: 'text-sky-300' };
}

export default function ControlPanel({ cloud, onCloudChange, stress, onToggleStress, grid }) {
  const w = weatherFor(cloud);
  const WIcon = w.icon;
  const supply = grid.solarKW + grid.batteryAvailKW + grid.importCap;
  const coverage = Math.min(100, (supply / grid.rawLoad) * 100);

  return (
    <section className="panel flex h-full flex-col gap-5 p-5" aria-labelledby="control-title">
      <h2 id="control-title" className="panel-title">
        <SlidersHorizontal className="h-4 w-4 text-sky-400" /> Control Panel
      </h2>

      {/* Weather shock */}
      <div className="rounded-xl border border-slate-700/50 bg-grid-850/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <label htmlFor="weather" className="text-sm font-semibold text-slate-200">
            Weather Shock
          </label>
          <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-mono text-sm font-bold text-sky-300">{cloud}%</span>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-800/80 transition-colors duration-500">
            <WIcon className={`h-7 w-7 transition-all duration-500 ${w.color}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{w.label}</p>
            <p className="text-xs text-slate-500">Cloud cover · irradiance ×{grid.irradiance.toFixed(2)}</p>
          </div>
        </div>
        <input
          id="weather"
          type="range"
          min={0}
          max={100}
          step={1}
          value={cloud}
          onChange={(e) => onCloudChange(Number(e.target.value))}
          className="weather-slider"
          style={{
            background: `linear-gradient(90deg, #fbbf24 0%, #38bdf8 ${cloud}%, #1e293b ${cloud}%)`,
          }}
          aria-valuetext={`${cloud}% cloud cover`}
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {PRESETS.map(({ label, value, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => onCloudChange(value)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition ${
                cloud === value
                  ? 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                  : 'border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stress test */}
      <div
        className={`rounded-xl border p-4 transition-all duration-500 ${
          stress ? 'border-rose-500/50 bg-rose-500/10 shadow-glow-red' : 'border-slate-700/50 bg-grid-850/80'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">Grid Stress Test</span>
          <button
            type="button"
            role="switch"
            aria-checked={stress}
            aria-label="Toggle grid stress test"
            onClick={onToggleStress}
            className={`relative h-6 w-11 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              stress ? 'bg-rose-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                stress ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-slate-400">
          Simulates a heatwave HVAC spike and EV fleet arrival surge (+65 kW).
        </p>
        <button
          type="button"
          onClick={onToggleStress}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            stress
              ? 'animate-pulse bg-rose-500 text-white hover:bg-rose-400'
              : 'border border-rose-500/50 text-rose-300 hover:bg-rose-500/15'
          }`}
        >
          {stress ? <Flame className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          {stress ? 'Stress Test Running — Stop' : 'Trigger Grid Stress Test'}
        </button>
      </div>

      {/* Supply coverage */}
      <div className="rounded-xl border border-slate-700/50 bg-grid-850/80 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <Gauge className="h-4 w-4 text-emerald-400" /> Supply Coverage
          </span>
          <span className="font-mono text-sm font-bold text-emerald-300">{coverage.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              coverage >= 100 ? 'bg-emerald-400' : coverage > 75 ? 'bg-amber-400' : 'bg-rose-500'
            }`}
            style={{ width: `${coverage}%` }}
          />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-slate-500">Raw demand</dt>
            <dd className="font-mono text-slate-200">{grid.rawLoad.toFixed(1)} kW</dd>
          </div>
          <div>
            <dt className="text-slate-500">Load shed by AI</dt>
            <dd className="font-mono text-amber-300">{grid.shedKW.toFixed(1)} kW</dd>
          </div>
          <div>
            <dt className="text-slate-500">Grid import</dt>
            <dd className="font-mono text-sky-300">{grid.gridImport.toFixed(1)} kW</dd>
          </div>
          <div>
            <dt className="text-slate-500">Import cap</dt>
            <dd className="font-mono text-slate-200">{grid.importCap} kW</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
