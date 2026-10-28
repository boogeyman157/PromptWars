import { Clock3, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import { CONFIG, fmtClock } from '../lib/simulation';

const PHASE_ICON = { dawn: Sunrise, day: Sun, dusk: Sunset, night: Moon };
const TARIFF_CLS = {
  peak: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
  normal: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  offpeak: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300',
};
const SPEED_LABELS = { 0: ['Pause', 'frozen'], 1: ['1×', '1 min/s'], 10: ['10×', '10 min/s'], 60: ['60×', '1 h/s'] };
const DAY_GRADIENT =
  'linear-gradient(90deg,#312e81 0%,#312e81 22%,#f59e0b 32%,#fde047 50%,#f59e0b 70%,#be123c 77%,#be123c 90%,#312e81 93%)';

export default function TimeControl({ hour, speed, onHourChange, onSpeedChange, grid }) {
  const Icon = PHASE_ICON[grid.phase.id];
  return (
    <section className="panel p-5" aria-labelledby="time-title">
      <h2 id="time-title" className="panel-title mb-4">
        <Clock3 className="h-4 w-4 text-indigo-300" /> 24h Simulation
      </h2>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-800/80">
            <Icon className={`h-7 w-7 transition-colors duration-500 ${grid.phase.id === 'night' ? 'text-indigo-300' : 'text-amber-300'}`} />
          </div>
          <div>
            <p className="font-mono text-2xl font-bold text-slate-100" data-testid="sim-clock">
              {fmtClock(hour)}
            </p>
            <p className="text-xs text-slate-500">
              {grid.phase.label} · daylight ×{grid.daylight.toFixed(2)}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors duration-500 ${TARIFF_CLS[grid.tariff.period]}`}>
          {grid.tariff.label} ₹{grid.tariff.rate}
        </span>
      </div>

      <label htmlFor="sim-hour" className="sr-only">
        Simulated time of day
      </label>
      <input
        id="sim-hour"
        type="range"
        min={0}
        max={23.75}
        step={0.25}
        value={Math.floor(hour * 4) / 4}
        onChange={(e) => onHourChange(Number(e.target.value))}
        className="weather-slider"
        style={{ background: DAY_GRADIENT }}
        aria-valuetext={fmtClock(hour)}
      />
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5" role="group" aria-label="Simulation speed">
        {CONFIG.SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => onSpeedChange(s)}
            className={`flex flex-col items-center rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition ${
              speed === s
                ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-200'
                : 'border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {SPEED_LABELS[s][0]}
            <span className="text-[9px] font-normal opacity-70">{SPEED_LABELS[s][1]}</span>
          </button>
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Import cap now</dt>
          <dd className="font-mono text-slate-200">{grid.importCap} kW</dd>
        </div>
        <div>
          <dt className="text-slate-500">Deferred EV queue</dt>
          <dd className="font-mono text-indigo-300">{grid.evQueueKWh.toFixed(1)} kWh</dd>
        </div>
      </dl>
    </section>
  );
}
