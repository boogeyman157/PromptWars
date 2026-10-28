import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Terminal, Trash2 } from 'lucide-react';

const STYLES = {
  system: { tag: 'SYS', cls: 'text-violet-300', tagCls: 'bg-violet-500/15 text-violet-300' },
  sensor: { tag: 'SENSE', cls: 'text-sky-300', tagCls: 'bg-sky-500/15 text-sky-300' },
  info: { tag: 'THINK', cls: 'text-slate-300', tagCls: 'bg-slate-500/20 text-slate-300' },
  warn: { tag: 'ALERT', cls: 'text-amber-300', tagCls: 'bg-amber-500/15 text-amber-300' },
  action: { tag: 'ACT', cls: 'text-cyan-200', tagCls: 'bg-cyan-500/15 text-cyan-300' },
  success: { tag: 'OK', cls: 'text-emerald-300', tagCls: 'bg-emerald-500/15 text-emerald-300' },
  critical: { tag: 'CRIT', cls: 'text-rose-300 font-semibold', tagCls: 'bg-rose-500/20 text-rose-300' },
};

export default function AgentLog({ logs, busy, onClear }) {
  const scrollRef = useRef(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && follow) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [logs, follow]);

  return (
    <section className="panel flex h-full min-h-[420px] flex-col overflow-hidden" aria-labelledby="agent-title">
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-grid-850/80 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <h2 id="agent-title" className="panel-title">
            <Terminal className="h-4 w-4 text-emerald-400" /> AI Optimization Agent
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] sm:flex ${busy ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${busy ? 'animate-ping bg-amber-300' : 'bg-emerald-400'}`} />
            {busy ? 'reasoning…' : 'monitoring'}
          </span>
          <button type="button" onClick={() => setFollow((f) => !f)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-200" title={follow ? 'Pause auto-scroll' : 'Resume auto-scroll'}>
            {follow ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onClear} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-200" title="Clear log">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="terminal-scroll flex-1 overflow-y-auto bg-[#03070f]/90 p-4 font-mono text-[12px] leading-relaxed" role="log" aria-live="polite" style={{ maxHeight: 460 }}>
        {logs.map((l) => {
          const s = STYLES[l.type] ?? STYLES.info;
          return (
            <div key={l.id} className="flex animate-fade-in-up gap-2 py-0.5">
              <span className="shrink-0 text-slate-600">{l.time}</span>
              <span className={`w-12 shrink-0 rounded px-1 text-center text-[10px] leading-5 ${s.tagCls}`}>{s.tag}</span>
              <span className={`min-w-0 break-words ${s.cls}`}>{l.text}</span>
            </div>
          );
        })}
        <div className="caret mt-1 text-slate-500">gridmind@microgrid:~$</div>
      </div>
    </section>
  );
}
