# GridMind: AI-Driven Micro-Grid Energy Distribution & Conservation Assistant

Single-page React + Tailwind CSS dashboard that simulates a campus micro-grid (solar PV, battery storage, campus load) with an autonomous AI agent that balances supply and demand in real time.

## Features
- **Live schematic** — Node A (solar), Node B (battery), Node C (campus load with per-appliance breakdown) plus an animated power-flow diagram.
- **Control panel** — Weather Shock slider (0–100% cloud cover, with presets) and a Grid Stress Test toggle (+65 kW heatwave / EV surge).
- **AI Optimization Agent log** — terminal that streams the agent's reasoning: deficit detection, tiered load-shedding (HVAC throttling, EV deferral to 2:00 AM, pump rescheduling, lighting dimming), battery dispatch, load restoration and export.
- **Impact metrics** — hourly cost savings (₹), carbon offset (kg CO₂), grid dependency reduction (%) and the agent's own contribution, plus session totals.
- Fully reactive: every control instantly updates the schematic, log and metrics. Responsive layout, smooth transitions.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Model
All logic lives in `src/lib/simulation.js` (pure functions). Key assumptions: 150 kWp array, 400 kWh battery (60 kW discharge, 20% reserve), 10 kW grid import cap, ₹9.5/kWh peak and ₹4.5/kWh off-peak tariffs, 0.716 kg CO₂/kWh (CEA India grid baseline). Savings and offsets are measured against an unmanaged campus drawing its full demand from the grid.

Tech: React 18, Vite 5, Tailwind CSS 3, lucide-react.
