import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Pause, Play, Settings2, Sparkles, Terminal, Trash2 } from 'lucide-react';
import { DEFAULT_MODEL } from '../lib/gemini';

const STYLES = {
  system: { tag: 'SYS', cls: 'text-violet-300', tagCls: 'bg-violet-500/15 text-violet-300' },
  sensor: { tag: 'SENSE', cls: 'text-sky-300', tagCls: 'bg-sky-500/15 text-sky-300' },
  info: { tag: 'THINK', cls: 'text-slate-300', tagCls: 'bg-slate-500/20 text-slate-300' },
  warn: { tag: 'ALERT', cls: 'text-amber-300', tagCls: 'bg-amber-500/15 text-amber-300' },
  action: { tag: 'ACT', cls: 'text-cyan-200', tagCls: 'bg-cyan-500/15 text-cyan-300' },
  success: { tag: 'OK', cls: 'text-emerald-300', tagCls: 'bg-emerald-500/15 text-emerald-300' },
  critical: { tag: 'CRIT', cls: 'text-rose-300 font-semibold', tagCls: 'bg-rose-500/20 text-rose-300' },
  llm: { tag: 'GEMINI', cls: 'text-fuchsia-200', tagCls: 'bg-fuchsia-500/15 text-fuchsia-300' },
};

const iconBtn = 'rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-200';

function LlmSettings({ settings, onChange }) {
  return (
    <div className="grid gap-3 border-b border-slate-700/50 bg-grid-850/60 px-4 py-3 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-end" data-testid="llm-settings">
      <label className="flex flex-col gap-1">
        <span className="text-slate-400">Gemini API key</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={settings.apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value.trim() })}
          placeholder="Paste key from Google AI Studio"
          className="rounded-md border border-slate-700 bg-grid-950/80 px-2.5 py-1.5 font-mono text-slate-200 placeholder:text-slate-600 focus:border-fuchsia-400/60 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-slate-400">Model</span>
        <input
          value={settings.model}
          onChange={(e) => onChange({ model: e.target.value.trim() || DEFAULT_MODEL })}
          className="w-44 rounded-md border border-slate-700 bg-grid-950/80 px-2.5 py-1.5 font-mono text-slate-200 focus:border-fuchsia-400/60 focus:outline-none"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-slate-300">
        <input type="checkbox" checked={settings.auto} onChange={(e) => onChange({ auto: e.target.checked })} className="accent-fuchsia-400" />
        Auto-consult on re-plan
      </label>
      <p className="text-[11px] text-slate-500 sm:col-span-3">
        The key is kept in this browser&apos;s localStorage and sent only to Google&apos;s Gemini API. Gemini picks shed fractions; the rule policy
        clamps them to safe limits and tops up shedding if the import cap would be breached.{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-fuchsia-300 hover:underline">
          Get a key <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}

export default function AgentLog({ logs, busy, onClear, llm, llmSettings, planSource, onConsult, onUpdateSettings }) {
  const scrollRef = useRef(null);
  const [follow, setFollow] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const thinking = llm.status === 'thinking';

  useEffect(() => {
    const el = scrollRef.current;
    if (el && follow) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [logs, follow]);

  const consult = () => {
    if (!llmSettings.apiKey) setSettingsOpen(true);
    onConsult();
  };

  return (
    <section className="panel flex h-full min-h-[420px] flex-col overflow-hidden" aria-labelledby="agent-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 bg-grid-850/80 px-4 py-2.5">
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
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
              planSource === 'llm' ? 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200' : 'border-slate-600/60 text-slate-400'
            }`}
            data-testid="planner-badge"
          >
            planner: {planSource === 'llm' ? 'Gemini' : 'rules'}
          </span>
          <span className={`hidden items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] sm:flex ${busy || thinking ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${busy || thinking ? 'animate-ping bg-amber-300' : 'bg-emerald-400'}`} />
            {thinking ? 'gemini thinking…' : busy ? 'reasoning…' : 'monitoring'}
          </span>
          <button
            type="button"
            onClick={consult}
            disabled={thinking}
            className="flex items-center gap-1.5 rounded-md border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:cursor-wait disabled:opacity-60"
          >
            {thinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Consult Gemini
          </button>
          <button type="button" onClick={() => setSettingsOpen((o) => !o)} className={iconBtn} title="Gemini settings" aria-expanded={settingsOpen}>
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setFollow((f) => !f)} className={iconBtn} title={follow ? 'Pause auto-scroll' : 'Resume auto-scroll'}>
            {follow ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onClear} className={iconBtn} title="Clear log">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {settingsOpen && <LlmSettings settings={llmSettings} onChange={onUpdateSettings} />}
      {llm.status === 'error' && llm.error && (
        <p className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-[11px] text-amber-200">{llm.error}</p>
      )}
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
