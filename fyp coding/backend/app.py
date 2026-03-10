"""
Backend API: state and district property price + flood risk (placeholder).
Estimator API: filter by state, district, property type, floor area -> estimated price + 1-month prediction.
Serves predictions from output/predictions.json and frontend static files.
"""
import os
import json
import numpy as np
from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREDICTIONS_PATH = os.path.join(BASE_DIR, "output", "predictions.json")
AREA_SUMMARY_PATH = os.path.join(BASE_DIR, "output", "area_property_summary.json")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
ESTIMATOR_MODEL_PATH = os.path.join(BASE_DIR, "models", "estimator_price.joblib")

app = Flask(__name__, static_folder=FRONTEND_DIR)
from flask_cors import CORS
CORS(app)

_data = None
_estimator_artifact = None
_area_summary = None

# Map GeoJSON/map state name -> our dataset state name (e.g. Trengganu on map = Terengganu in data)
STATE_NAME_MAP = {
    "Trengganu": "Terengganu",
    "Pulau Pinang": "Penang",
    "W.P. Kuala Lumpur": "Kuala Lumpur",
    "W.P. Labuan": "Labuan",
    "W.P. Putrajaya": "Putrajaya",
}
# Map GeoJSON/map district name -> our dataset district name (e.g. Keluang on map = Kluang in data)
DISTRICT_NAME_MAP = {
    "Keluang": "Kluang",
    "Kota Bahru": "Kota Bharu",
    "Kota Baru": "Kota Bharu",
    "Tanjong": "Tanjung",
    "Telok": "Teluk",
    "Pekan Nenas": "Pekan Nanas",
    # Johor
    "Johor Baharu": "Johor Bahru",
    "Kulaijaya": "Kulai",
    "Ledang": "Tangkak",
    # Kedah
    "Kota Setar": "Alor Setar",
    # Kelantan
    "Pasir Putih": "Pasir Puteh",
    "Kuala Krai": "Kuala Kerai",
    # Pahang
    "Lipis": "Kuala Lipis",
    # Perak
    "Larut and Matang": "Taiping",
    "Hilir Perak": "Teluk Intan",
    "Hulu Perak": "Gerik",
    "Perak Tengah": "Seri Iskandar",
    "Kinta": "Ipoh",
    "Kerian": "Parit Buntar",
    "Batang Padang": "Tapah",
    # Penang (Pulau Pinang)
    "Barat Daya": "Bayan Lepas",
    "Timur Laut": "George Town",
    "Seberang Perai Selatan": "Nibong Tebal",
    "Seberang Perai Tengah": "Bukit Mertajam",
    "Seberang Perai Utara": "Butterworth",
    # Sarawak
    "Meradong": "Maradong",
}


def load_predictions():
    global _data
    if _data is None and os.path.isfile(PREDICTIONS_PATH):
        with open(PREDICTIONS_PATH, "r", encoding="utf-8") as f:
            _data = json.load(f)
    return _data or {"state": {}, "district": {}, "metrics": {}}


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/predictions")
def predictions():
    """Return full predictions (state + district)."""
    data = load_predictions()
    return jsonify(data)


@app.route("/api/state/<name>")
def state(name):
    """Get price and flood risk for a state by name (e.g. Selangor, Penang)."""
    data = load_predictions()
    states = data.get("state", {})
    key = name.replace("%20", " ")
    key = STATE_NAME_MAP.get(key, key)
    if key not in states:
        return jsonify({"error": "State not found"}), 404
    out = states[key].copy()
    out["name"] = key
    out["flood_risk"] = out.get("flood_risk") or "Data pending"
    return jsonify(out)


@app.route("/api/district")
def district():
    """Get price for a district. Query: state, district (e.g. ?state=Selangor&district=Puchong).
    If state has no districts (e.g. Perlis), GeoJSON may show 'Perlis, Perlis'; use state-level data."""
    state_name = request.args.get("state", "").strip()
    district_name = request.args.get("district", "").strip()
    if not state_name or not district_name:
        return jsonify({"error": "Missing state or district"}), 400
    data = load_predictions()
    districts = data.get("district", {})
    states = data.get("state", {})
    state_for_data = STATE_NAME_MAP.get(state_name, state_name)
    district_for_data = DISTRICT_NAME_MAP.get(district_name, district_name)
    key = f"{state_for_data}|{district_for_data}"
    if key not in districts:
        key = f"{state_for_data}|{district_name}"
    if key not in districts:
        key = f"{state_name}|{district_for_data}"
    if key not in districts:
        key = f"{state_name}|{district_name}"
    if key not in districts:
        # e.g. Perlis has no districts; map shows "Perlis, Perlis" -> use state-level data
        if state_for_data == district_for_data or state_name == district_name:
            if state_for_data in states:
                out = states[state_for_data].copy()
                out["state"] = state_name
                out["district"] = district_name
                out["flood_risk"] = out.get("flood_risk") or "Data pending"
                return jsonify(out)
        return jsonify({"error": "District not found"}), 404
    out = districts[key].copy()
    out["state"] = state_name
    out["district"] = district_name
    out["flood_risk"] = out.get("flood_risk") or "Data pending"
    return jsonify(out)


@app.route("/api/states")
def states_list():
    """List all state names for map layer."""
    data = load_predictions()
    return jsonify(list(data.get("state", {}).keys()))


@app.route("/api/districts")
def districts_list():
    """List all districts as { state|district }. Optional ?state=Selangor to filter."""
    data = load_predictions()
    districts = data.get("district", {})
    state_filter = request.args.get("state", "").strip()
    state_filter = STATE_NAME_MAP.get(state_filter, state_filter)
    if state_filter:
        keys = [k for k in districts if k.startswith(state_filter + "|")]
    else:
        keys = list(districts.keys())
    return jsonify(keys)


STATE_DAILY_PATH = os.path.join(BASE_DIR, "data", "state_daily.csv")
DISTRICT_DAILY_PATH = os.path.join(BASE_DIR, "data", "district_daily.csv")


def load_estimator():
    """Load price estimator model (state, district, property_type, floor_area_sqft -> price)."""
    global _estimator_artifact
    if _estimator_artifact is None and os.path.isfile(ESTIMATOR_MODEL_PATH):
        import joblib
        _estimator_artifact = joblib.load(ESTIMATOR_MODEL_PATH)
    return _estimator_artifact


def load_area_summary():
    """Load area + property summary (options and ranges). Run scripts/build_area_summary.py to generate."""
    global _area_summary
    if _area_summary is None and os.path.isfile(AREA_SUMMARY_PATH):
        with open(AREA_SUMMARY_PATH, "r", encoding="utf-8") as f:
            _area_summary = json.load(f)
    return _area_summary


@app.route("/api/estimator/options")
def estimator_options():
    """Return states, property types, and districts-by-state for the estimator form dropdowns."""
    summary = load_area_summary()
    if summary and "options" in summary:
        return jsonify(summary["options"])
    art = load_estimator()
    if not art or "options" not in art:
        return jsonify({"error": "Run scripts/build_area_summary.py or scripts/train_estimator.py first."}), 503
    return jsonify(art["options"])


@app.route("/api/estimate", methods=["POST"])
def estimate():
    """
    Area + property type lookup: state, district (optional), property_type.
    Returns: predicted_price_1month, floor_area_range_sqft (min/max), rooms_range (min/max), flood_risk.
    """
    summary = load_area_summary()
    if not summary:
        return jsonify({"error": "Run scripts/build_area_summary.py first."}), 503
    body = request.get_json() or {}
    state = (body.get("state") or "").strip()
    district = (body.get("district") or "").strip()
    property_type = (body.get("property_type") or "").strip()
    if not state or not property_type:
        return jsonify({"error": "Missing state or property_type."}), 400

    # Predicted 1-month price from predictions.json (state or state|district)
    predictions_data = load_predictions()
    state_key = STATE_NAME_MAP.get(state, state)
    district_key = f"{state_key}|{DISTRICT_NAME_MAP.get(district, district)}" if district else None
    predicted_price_1month = None
    if district and district_key and district_key in predictions_data.get("district", {}):
        d = predictions_data["district"][district_key]
        predicted_price_1month = d.get("predicted_price_1month") or d.get("current_price")
    if predicted_price_1month is None and state_key in predictions_data.get("state", {}):
        s = predictions_data["state"][state_key]
        predicted_price_1month = s.get("predicted_price_1month") or s.get("current_price")
    if predicted_price_1month is None:
        predicted_price_1month = 0

    # Ranges: from area summary by state+property or state+district+property
    by_state = summary.get("by_state_property", {})
    by_state_district = summary.get("by_state_district_property", {})
    range_entry = None
    if district and state in by_state_district and district in by_state_district[state]:
        range_entry = by_state_district[state][district].get(property_type)
    if range_entry is None and state in by_state:
        range_entry = by_state[state].get(property_type)
    floor_area_range_sqft = {"min": None, "max": None}
    rooms_range = {"min": None, "max": None}
    if range_entry:
        floor_area_range_sqft = {
            "min": range_entry.get("floor_area_sqft_min"),
            "max": range_entry.get("floor_area_sqft_max"),
        }
        rooms_range = {
            "min": range_entry.get("bedrooms_min"),
            "max": range_entry.get("bedrooms_max"),
        }

    return jsonify({
        "predicted_price_1month": round(float(predicted_price_1month), 2),
        "floor_area_range_sqft": floor_area_range_sqft,
        "rooms_range": rooms_range,
        "flood_risk": None,
    })


@app.route("/api/price-history")
def price_history():
    """Return daily avg price series for a state or state+district. Query: state=Johor or state=Johor&district=Kluang."""
    import csv
    state_name = request.args.get("state", "").strip()
    district_name = request.args.get("district", "").strip()
    if not state_name:
        return jsonify({"error": "Missing state"}), 400
    state_key = STATE_NAME_MAP.get(state_name, state_name)
    district_for_data = DISTRICT_NAME_MAP.get(district_name, district_name) if district_name else None

    if not district_for_data:
        if not os.path.isfile(STATE_DAILY_PATH):
            return jsonify({"error": "Data not found"}), 404
        rows = []
        with open(STATE_DAILY_PATH, "r", encoding="utf-8") as f:
            r = csv.DictReader(f)
            for row in r:
                if row.get("state") == state_key:
                    rows.append({"date": row["date"], "avg_price": float(row["avg_price"])})
        rows.sort(key=lambda x: x["date"])
        return jsonify({"dates": [r["date"] for r in rows], "prices": [r["avg_price"] for r in rows]})

    if not os.path.isfile(DISTRICT_DAILY_PATH):
        return jsonify({"error": "Data not found"}), 404
    rows = []
    with open(DISTRICT_DAILY_PATH, "r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            if row.get("state") == state_key and row.get("district_text") == district_for_data:
                rows.append({"date": row["date"], "avg_price": float(row["avg_price"])})
    if not rows and state_key == district_for_data:
        # e.g. Perlis: no districts, use state-level series
        with open(STATE_DAILY_PATH, "r", encoding="utf-8") as f:
            r = csv.DictReader(f)
            for row in r:
                if row.get("state") == state_key:
                    rows.append({"date": row["date"], "avg_price": float(row["avg_price"])})
    rows.sort(key=lambda x: x["date"])
    return jsonify({"dates": [r["date"] for r in rows], "prices": [r["avg_price"] for r in rows]})


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def frontend_static(path):
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
