# 2026 annual flood risk overlay

The file `flood_risk_2026_annual.json` is optional. When present, `scripts/fetch_flood_risk.py` merges it on top of the current snapshot from Public Infobanjir.

- **Keys**: Same as `flood_risk.json` — state name (e.g. `"Sarawak"`) or `"State|District"` (e.g. `"Sarawak|Sibu"`).
- **Values**: Risk string (e.g. `"High (2026 frequent floods)"`, `"Medium (2026 flood events)"`).

Use this to reflect **full-year 2026** flood occurrence (e.g. from JPS bulletins or news) for states/districts that had many floods but the live snapshot has few or no stations. The website will then show the merged result.

To disable 2026 overlay, remove or rename this file and run the fetch script again.
