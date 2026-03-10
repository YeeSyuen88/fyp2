# Malaysia Property Price Prediction & Flood Risk Map (FYP)

Property price prediction (future 1 month) by **state** and **district**, with an interactive Malaysia map and a **Price & Area Info** page. Users can view current price, predicted 1-month price, price trend chart, and flood risk (placeholder until dataset is ready).

---

## Current progress

- **Data**: Preprocessing from `merged_high_quality_dataset.csv`; outputs `state_daily.csv` and `district_daily.csv` for time-series training.
- **Models**: State-level (weekly aggregation, Ridge) and district-level (daily, Ridge); predictions exported to `output/predictions.json`. MAPE evaluation (Good / Acceptable / Poor) in `output/accuracy_metrics.json`.
- **Map**: Leaflet map with Malaysia GeoJSON; switch between State and District layers; click to see current price, predicted 1-month price, price trend chart, and flood risk (placeholder).
- **Estimator / Area Info page**: User selects **state**, **district (optional)**, and **property type**; result shows **predicted future 1-month price**, **floor area range (sq ft)**, **number of rooms range**, and **flood risk**.
- **Name mapping**: GeoJSON names (e.g. Trengganu, Keluang) are mapped to dataset names (Terengganu, Kluang) in backend and frontend so all regions with data can display correctly.

---

## Project structure

| Path | Description |
|------|-------------|
| **data/** | `cleaned.csv`, `state_daily.csv`, `district_daily.csv` (from preprocess) |
| **scripts/** | `preprocess.py`, `train_lstm.py`, `train_estimator.py`, `build_area_summary.py` |
| **models/** | `lstm_state.joblib`, `lstm_district.joblib`, `estimator_price.joblib` (optional) |
| **output/** | `predictions.json`, `accuracy_metrics.json`, `area_property_summary.json` |
| **backend/** | Flask API; serves frontend and API routes |
| **frontend/** | Map (`index.html`, `app.js`), Price & Area Info (`estimator.html`, `estimator.js`) |

**Dataset (root):** `merged_high_quality_dataset.csv` — used for preprocessing, LSTM training, area summary, and (optionally) price estimator.

---

## Setup

```bash
pip install -r requirements.txt
pip install -r backend/requirements.txt
```

---

## Run pipeline

### 1. Preprocess

Drops irrelevant columns, handles missing values, aggregates by state×date and state×district×date.

```bash
python scripts/preprocess.py
```

Output: `data/cleaned.csv`, `data/state_daily.csv`, `data/district_daily.csv`.

### 2. Train prediction model

Trains state-level (weekly) and district-level (daily) models; evaluates RMSE, MSE, MAE, MAPE; writes predictions and metrics.

```bash
python scripts/train_lstm.py
```

Output: `output/predictions.json`, `output/accuracy_metrics.json`, `models/lstm_state.joblib`, `models/lstm_district.joblib`.

### 3. Build area summary (for estimator page)

Builds floor area and room ranges by state (and district) × property type from the same dataset.

```bash
python scripts/build_area_summary.py
```

Output: `output/area_property_summary.json` (options + ranges for dropdowns and result panel).

### 4. Start backend and open site

```bash
python backend/app.py
```

Then open:

- **Map:** http://127.0.0.1:5000/
- **Price & Area Info:** http://127.0.0.1:5000/estimator.html

**Map:** Choose “View by: State” or “District”, click a region to see current price, predicted 1-month price, price trend chart, and flood risk (placeholder).

**Estimator:** Select state, optional district, and property type → “Show Result” displays predicted 1-month price, floor area range (sq ft), number of rooms range, and flood risk.

---

## API (backend running)

| Endpoint | Description |
|----------|-------------|
| `GET /api/predictions` | Full state and district predictions |
| `GET /api/state/<name>` | Price and flood for a state (e.g. `/api/state/Selangor`) |
| `GET /api/district?state=...&district=...` | Price and flood for a district |
| `GET /api/states` | List of state names |
| `GET /api/districts?state=...` | List of district keys (optional filter by state) |
| `GET /api/price-history?state=...&district=...` | Daily average price series for chart |
| `GET /api/estimator/options` | States, property types, districts-by-state for estimator form |
| `POST /api/estimate` | Body: `{ "state", "district" (optional), "property_type" }` → predicted 1-month price, floor area range, rooms range, flood risk |

---

## Flood risk

`flood_risk` in the API and UI is `null` / “Data pending”. When the flood dataset is ready, integrate it in `backend/app.py` (e.g. load JSON or DB) and return it in the same response fields.

---

## Optional: price estimator model

For a regression model that estimates price from state, district, property type, and floor area (sq ft), run:

```bash
python scripts/train_estimator.py
```

This creates `models/estimator_price.joblib`. The current **Price & Area Info** page does not require it; it uses `predictions.json` and `area_property_summary.json` only.
