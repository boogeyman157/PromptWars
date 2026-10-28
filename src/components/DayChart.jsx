import { useMemo } from 'react';
import { LineChart } from 'lucide-react';
import { fmtClock, forecastDay } from '../lib/simulation';

const W = 720;
const H = 220;
const PL = 34;
const PR = 10;
const PT = 12;
const PB = 22;

const BANDS = [
  { from: 0, to: 6, fill: 'rgba(99,102,241,0.08)', label: 'off-peak' },
  { from: 18, to: 22, fill: 'rgba(244,63,94,0.09)', label: 'peak' },
  { from: 22, to: 24, fill: 'rgba(99,102,241,0.08)', label: 'off-peak' },
];

const SERIES = [
  { key: 'demand', label: 'Raw demand', stroke: '#94a3b8', dash: '5 4' },
  { key: 'load', label: 'AI-optimized load', stroke: '#38bdf8' },
  { key: 'grid', label: 'Grid import', stroke: '#fb7185' },
];

export default function DayChart({ grid }) {
  const queue = Math.round(grid.evQueueKWh);
  const data = useMemo(
    () => forecastDay({ cloud: grid.cloud, stress: grid.stress, evQueueKWh: queue }),
    [grid.cloud, grid.stress, queue],
  );

  const max = Math.max(20, Math.ceil(Math.max(...data.map((d) => Math.max(d.demand, d.solar))) / 20) * 20);
  const x = (h) => PL + (h / 24) * (W - PL - PR);
  const y = (v) => PT + (1 - v / max) * (H - PT - PB);
  const path = (k) => data.map((d, i) => `${i ? 'L' : 'M'}${x(d.hour).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const solarArea = `${path('solar')} L${x(24)},${y(0)} L${x(0)},${y(0)} Z`;

  const slots = data.slice(0, -1);
  const kwh = (k) => slots.reduce((s, d) => s + d[k] * 0.5, 0);
  const demandKWh = kwh('demand');
  const gridKWh = kwh('grid');
  const selfSufficiency = demandKWh > 0 ? (1 - gridKWh / demandKWh) * 100 : 100;
  const nowX = x(grid.hour);

  return (
    <section className="panel p-5" aria-labelledby="forecast-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="forecast-title" className="panel-title">
          <LineChart className="h-4 w-4 text-indigo-300" /> 24h Energy Outlook
        </h2>
        <div className="flex flex-wrap gap-3 font-mono text-[11px] text-slate-400">
          <span>
            Solar <span className="text-amber-300">{kwh('solar').toFixed(0)} kWh</span>
          </span>
          <span>
            Grid <span className="text-rose-300">{gridKWh.toFixed(0)} kWh</span>
          </span>
          <span>
            Self-sufficiency <span className="text-emerald-300">{selfSufficiency.toFixed(0)}%</span>
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="24 hour forecast of solar generation, demand and grid import">
        <defs>
          <linearGradient id="solarFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {BANDS.map((b) => (
          <rect key={b.from} x={x(b.from)} y={PT} width={x(b.to) - x(b.from)} height={H - PT - PB} fill={b.fill} />
        ))}
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
            <text x={PL - 6} y={y(v) + 3} textAnchor="end" className="fill-slate-500 font-mono" fontSize="10">
              {v}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={x(h)} y={H - 6} textAnchor="middle" className="fill-slate-500 font-mono" fontSize="10">
            {String(h).padStart(2, '0')}:00
          </text>
        ))}
        <path d={solarArea} fill="url(#solarFill)" stroke="#fbbf24" strokeWidth="1.5" className="transition-all duration-700" />
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" />
        ))}
        <line x1={nowX} x2={nowX} y1={PT} y2={H - PB} stroke="#e2e8f0" strokeOpacity="0.5" strokeDasharray="2 3" />
        <circle cx={nowX} cy={y(grid.solarKW)} r="3.5" fill="#fbbf24" />
        <circle cx={nowX} cy={y(grid.optimizedLoad)} r="3.5" fill="#38bdf8" />
        <circle cx={nowX} cy={y(grid.gridImport)} r="3.5" fill="#fb7185" />
        <text x={Math.min(nowX + 5, W - 40)} y={PT + 10} className="fill-slate-300 font-mono" fontSize="10">
          {fmtClock(grid.hour)}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-amber-400/60" /> Solar
        </span>
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3" style={{ background: s.stroke }} /> {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-rose-500/30" /> Peak tariff
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-indigo-500/30" /> Off-peak
        </span>
      </div>
    </section>
  );
}
