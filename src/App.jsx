import AgentLog from './components/AgentLog';
import ControlPanel from './components/ControlPanel';
import FlowDiagram from './components/FlowDiagram';
import Header from './components/Header';
import ImpactMetrics from './components/ImpactMetrics';
import { BatteryCard, LoadCard, SolarCard } from './components/NodeCards';
import useGridSimulation from './hooks/useGridSimulation';
import { Network } from 'lucide-react';

export default function App() {
  const { grid, cloud, stress, soc, logs, totals, agentBusy, setCloud, toggleStress, reset, clearLogs } = useGridSimulation();

  return (
    <div className="min-h-screen">
      <Header status={grid.status} onReset={reset} />

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-4 xl:col-span-3">
            <ControlPanel cloud={cloud} onCloudChange={setCloud} stress={stress} onToggleStress={toggleStress} grid={grid} />
          </aside>

          <div className="space-y-6 lg:col-span-8 xl:col-span-9">
            <section aria-labelledby="schematic-title">
              <h2 id="schematic-title" className="panel-title mb-3">
                <Network className="h-4 w-4 text-sky-400" /> Micro-Grid Live Schematic
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <SolarCard grid={grid} />
                <BatteryCard grid={grid} soc={soc} />
                <div className="md:col-span-2 2xl:col-span-1">
                  <LoadCard grid={grid} />
                </div>
              </div>
            </section>
            <FlowDiagram grid={grid} />
          </div>
        </div>

        <AgentLog logs={logs} busy={agentBusy} onClear={clearLogs} />

        <ImpactMetrics grid={grid} totals={totals} />

        <footer className="pb-4 pt-2 text-center text-[11px] text-slate-600">
          GridMind · Simulated micro-grid digital twin for sustainability research · All values computed live in-browser
        </footer>
      </main>
    </div>
  );
}
