# GridMind: 60-second demo script

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Open the dashboard at noon, clear sky. | "GridMind is an AI agent that runs a campus micro-grid: 150 kW of solar, a 400 kWh battery and about 110 kW of campus load. Right now solar covers everything and the surplus is charging the battery." |
| 0:08 | Drag **Weather Shock** to 100% (or click *Storm*). | "A monsoon front hits and solar collapses from 127 to 17 kW. The agent catches the 92 kW deficit instantly." Point at the terminal: *Deficit detected*, *Throttling HVAC by 15%*, *Deferring EV charging queue to 2:00 AM*. |
| 0:18 | Toggle **Grid Stress Test**. | "Now add a heatwave and an EV fleet surge: another 65 kW. The agent sheds in tiers and protects the labs. When flexible load runs out, it flags the cap breach and requests demand-response." Status turns red. |
| 0:28 | Turn stress off, pause the clock, click **Consult Gemini**. | "We can hand planning to Gemini. It reads the live telemetry, explains its reasoning and picks what to shed. Our rule engine stays on as a guardrail and tops up if Gemini under-sheds." Planner badge switches to *Gemini*. |
| 0:40 | Clear the weather, set the time slider to 17:00 and the speed to **60×**. | "Now a whole day. The sun sets and the 18:00 peak tariff begins. The battery covers the peak while the chart shows demand, solar and grid import." |
| 0:50 | Let it reach 02:00 (or drag the slider there). | "At 2 AM the EV energy we deferred during the storm charges on cheap off-peak power. Nothing was lost, it just moved in time." |
| 0:56 | Point at the impact metrics. | "Every rupee saved, every kilogram of CO₂ avoided and the drop in grid dependency is computed live. That's GridMind." |

Tips
- Click **Reset** before you start. It restores 12:00, 15% cloud and 72% battery.
- Without a Gemini key, the demo still works: just skip the 0:28 step. The rule-based agent runs everything else.
