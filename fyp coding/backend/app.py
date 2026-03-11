"""
Backend API: state and district property price + flood risk (placeholder).
Estimator API: filter by state, district, property type, floor area -> estimated price + 1-month prediction.
Serves predictions from output/predictions.json and frontend static files.
"""
import os
import json
import urllib.request
import urllib.error
import numpy as np
from flask import Flask, jsonify, request, send_from_directory, session

try:
    from curl_cffi import requests as _curl_requests
    _CURL_CFFI_AVAILABLE = True
except ImportError:
    _CURL_CFFI_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_groq_api_key():
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if key:
        return key
    path = os.path.join(BACKEND_DIR, "groq_api_key.txt")
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""


GROQ_API_KEY = _load_groq_api_key()
CHATBOT_SYSTEM_PROMPT = (
    "You are the EstateView assistant for a property intelligence platform in Malaysia. "
    "When users ask about current average price, predicted 1-month price, or flood risk for any area, "
    "answer using your general knowledge. Never say that you or EstateView lack data; always answer from your knowledge. "
    "IMPORTANT: Format your reply tidily. First line: 'For [area name]:' only (no dash or bullet after it). "
    "Then one line per item, each starting with a bullet and space, e.g. '• Current avg price: RM ...' on a new line. "
    "Use exactly: • Current avg price, • Predicted 1-month price (with % change), • Flood risk level. Keep under 60 words. "
    "Do NOT write long paragraphs, repeated explanations, or extra detail. No closing line about map/filter/estimator unless the user asks. "
    "Keep the whole reply under 60 words. Be brief."
)

# Admin accounts: (username, password)
ADMIN_ACCOUNTS = {
    "admin_wk": "weikang01",
    "admin_ys": "yeesyuen02",
    "admin_ps": "pengseung03",
}

PREDICTIONS_PATH = os.path.join(BASE_DIR, "output", "predictions.json")
AREA_SUMMARY_PATH = os.path.join(BASE_DIR, "output", "area_property_summary.json")
CLEANED_CSV = os.path.join(BASE_DIR, "data", "cleaned.csv")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
ESTIMATOR_MODEL_PATH = os.path.join(BASE_DIR, "models", "estimator_price.joblib")

app = Flask(__name__, static_folder=FRONTEND_DIR)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "estateview-public-comments-secret-change-in-production")
from flask_cors import CORS
CORS(app, supports_credentials=True)

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

    confidence_score = None
    if predicted_price_1month and predicted_price_1month > 0:
        confidence_score = round(85.0 + (2.0 if district else 0), 1)

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
        "confidence_score": confidence_score,
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


@app.route("/api/filter-results")
def filter_results():
    """
    Filter listings by price range and property type; return areas (state + district) with avg_price and count.
    Query: min_price=0&max_price=5000000&property_type=Condominium,Terraced%20House
    """
    import csv
    if not os.path.isfile(CLEANED_CSV):
        return jsonify({"error": "Data not found. Run scripts/preprocess.py first."}), 503
    try:
        min_price = float(request.args.get("min_price", 0) or 0)
    except ValueError:
        min_price = 0
    try:
        max_price = float(request.args.get("max_price", 50000000) or 50000000)
    except ValueError:
        max_price = 50000000
    if min_price > max_price:
        min_price, max_price = max_price, min_price
    types_param = (request.args.get("property_type") or "").strip()
    property_types = [t.strip() for t in types_param.split(",") if t.strip()]
    agg = {}
    pt_col = "property_type"
    with open(CLEANED_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames and pt_col not in reader.fieldnames:
            pt_col = "property_type_group" if "property_type_group" in (reader.fieldnames or []) else None
        for row in reader:
            try:
                p = float(row.get("price") or 0)
            except (ValueError, TypeError):
                continue
            if not (min_price <= p <= max_price):
                continue
            state = (row.get("state") or "").strip()
            district = (row.get("district_text") or "").strip()
            if not state:
                continue
            if not district:
                district = state
            pt = (row.get(pt_col) or "Other").strip() if pt_col else "Other"
            if property_types and pt not in property_types:
                continue
            key = state + "|" + district
            if key not in agg:
                agg[key] = {"state": state, "district": district, "prices": []}
            agg[key]["prices"].append(p)
    out = []
    for k, v in agg.items():
        prices = v["prices"]
        out.append({
            "state": v["state"],
            "district": v["district"],
            "avg_price": round(sum(prices) / len(prices), 2),
            "count": len(prices),
        })
    out.sort(key=lambda x: (x["state"], x["district"]))
    return jsonify({"results": out})


@app.route("/api/price-histogram")
def price_histogram():
    """
    Return price distribution for histogram: buckets with min, max, count.
    Optional: property_type=Type1,Type2 to filter by property type.
    """
    import csv
    if not os.path.isfile(CLEANED_CSV):
        return jsonify({"error": "Data not found. Run scripts/preprocess.py first."}), 503
    types_param = (request.args.get("property_type") or "").strip()
    property_types = [t.strip() for t in types_param.split(",") if t.strip()]
    pt_col = "property_type"
    prices = []
    with open(CLEANED_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames and pt_col not in (reader.fieldnames or []):
            pt_col = "property_type_group" if "property_type_group" in (reader.fieldnames or []) else None
        for row in reader:
            try:
                p = float(row.get("price") or 0)
            except (ValueError, TypeError):
                continue
            if p <= 0:
                continue
            if property_types and pt_col:
                pt = (row.get(pt_col) or "Other").strip()
                if pt not in property_types:
                    continue
            prices.append(p)
    if not prices:
        return jsonify({"buckets": [], "priceMin": 0, "priceMax": 5000000})
    try:
        price_min = float(request.args.get("price_min", 0))
        price_max = float(request.args.get("price_max", 5000000))
        num_buckets = int(request.args.get("num_buckets", 50))
    except (TypeError, ValueError):
        price_min, price_max, num_buckets = 0, 5000000, 50
    num_buckets = max(10, min(100, num_buckets))
    if price_max <= price_min:
        price_max = price_min + 1
    step = (price_max - price_min) / num_buckets
    buckets = []
    for i in range(num_buckets):
        lo = price_min + i * step
        hi = price_min + (i + 1) * step
        count = sum(1 for p in prices if lo <= p < hi) if i < num_buckets - 1 else sum(1 for p in prices if lo <= p <= hi)
        buckets.append({"min": round(lo, 0), "max": round(hi, 0), "count": count})
    return jsonify({"buckets": buckets, "priceMin": round(price_min, 0), "priceMax": round(price_max, 0)})


FEEDBACK_TO_EMAIL = "yeesyuen647@gmail.com"


def send_feedback_email(rating, comment):
    """Send feedback to FEEDBACK_TO_EMAIL via SMTP. Uses env: MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    server = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    port = int(os.environ.get("MAIL_PORT", "587"))
    username = os.environ.get("MAIL_USERNAME", "").strip()
    password = os.environ.get("MAIL_PASSWORD", "").strip()
    if not username or not password:
        return False, "Email not configured. Set MAIL_USERNAME and MAIL_PASSWORD (e.g. Gmail app password)."

    rating_str = "No rating" if not rating else "{} / 5".format(rating)
    body = "EstateView Private Feedback\n\n"
    body += "Rating: {}\n\n".format(rating_str)
    body += "Comment:\n{}".format(comment or "(none)")

    msg = MIMEMultipart()
    msg["Subject"] = "EstateView Private Feedback"
    msg["From"] = username
    msg["To"] = FEEDBACK_TO_EMAIL
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(server, port) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            smtp.sendmail(username, [FEEDBACK_TO_EMAIL], msg.as_string())
        return True, None
    except Exception as e:
        err_msg = str(e)
        print("[Feedback] Send failed: {}".format(err_msg), flush=True)
        return False, err_msg


@app.route("/api/feedback", methods=["POST"])
def feedback():
    """Accept private feedback (rating, comment) and send to FEEDBACK_TO_EMAIL."""
    body = request.get_json() or {}
    rating = body.get("rating")  # 0 or 1-5
    comment = (body.get("comment") or "").strip()
    if len(comment) < 10:
        return jsonify({"error": "Comment must be at least 10 characters."}), 400
    ok, err = send_feedback_email(rating, comment)
    if not ok:
        print("[Feedback] Error: {}".format(err), flush=True)
        return jsonify({"error": err or "Failed to send email."}), 503
    print("[Feedback] Sent to {}.".format(FEEDBACK_TO_EMAIL), flush=True)
    return jsonify({"success": True, "message": "Feedback sent."})


# ----- Public comments (community feed) - SQLite -----
PUBLIC_DB_PATH = os.path.join(BASE_DIR, "data", "public_comments.db")


def _get_db():
    import sqlite3
    os.makedirs(os.path.dirname(PUBLIC_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(PUBLIC_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_public_db():
    conn = _get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_name TEXT NOT NULL,
                area TEXT NOT NULL,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                likes INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS post_likes (
                post_id INTEGER NOT NULL,
                user_fingerprint TEXT NOT NULL,
                PRIMARY KEY (post_id, user_fingerprint),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                author_name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )
        """)
        conn.commit()
    finally:
        conn.close()


@app.route("/api/public-posts", methods=["GET"])
def public_posts_list():
    """List posts. Query: category=..., search=..., state=..., fingerprint=..., limit=10, offset=0"""
    _init_public_db()
    category = (request.args.get("category") or "All").strip()
    search = (request.args.get("search") or "").strip()
    state = (request.args.get("state") or "").strip()
    fingerprint = (request.args.get("fingerprint") or "").strip()
    try:
        limit = max(1, min(50, int(request.args.get("limit", 10))))
    except (TypeError, ValueError):
        limit = 10
    try:
        offset = max(0, int(request.args.get("offset", 0)))
    except (TypeError, ValueError):
        offset = 0
    conn = _get_db()
    try:
        base_sql = """SELECT p.id, p.author_name, p.area, p.category, p.title, p.content, p.created_at, p.likes,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count
            FROM posts p"""
        params = []
        where_parts = []
        if category and category != "All":
            where_parts.append("p.category = ?")
            params.append(category)
        if state:
            where_parts.append("(p.area = ? OR p.area LIKE ?)")
            params.extend([state, state + ",%"])
        if search:
            where_parts.append("(p.title LIKE ? OR p.content LIKE ? OR p.area LIKE ?)")
            params.extend(["%{}%".format(search), "%{}%".format(search), "%{}%".format(search)])
        where_clause = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""
        count_sql = "SELECT COUNT(*) AS total FROM posts p" + where_clause
        cur = conn.execute(count_sql, params)
        total = cur.fetchone()[0]
        sql = base_sql + where_clause + " ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
        params_with_limit = params + [limit, offset]
        cur = conn.execute(sql, params_with_limit)
        rows = cur.fetchall()
        out = []
        for row in rows:
            d = dict(zip(row.keys(), row))
            like_count = d.pop("like_count", None)
            if like_count is not None:
                d["likes"] = like_count
            d["comment_count"] = d.pop("comment_count", 0)
            if fingerprint:
                cur2 = conn.execute(
                    "SELECT 1 FROM post_likes WHERE post_id = ? AND user_fingerprint = ?",
                    (d["id"], fingerprint),
                )
                d["liked"] = cur2.fetchone() is not None
            else:
                d["liked"] = False
            out.append(d)
        return jsonify({
            "posts": out,
            "total": total,
            "has_more": (offset + len(out)) < total,
        })
    finally:
        conn.close()


@app.route("/api/public-posts", methods=["POST"])
def public_posts_create():
    """Create a new post. Body: author_name, area, category, title, content."""
    _init_public_db()
    body = request.get_json() or {}
    author_name = (body.get("author_name") or "").strip() or "Anonymous"
    area = (body.get("area") or "").strip() or "General"
    category = (body.get("category") or "General").strip() or "General"
    title = (body.get("title") or "").strip()
    content = (body.get("content") or "").strip()
    if not title:
        return jsonify({"error": "Title is required."}), 400
    from datetime import datetime
    created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    conn = _get_db()
    try:
        cur = conn.execute(
            "INSERT INTO posts (author_name, area, category, title, content, created_at, likes) VALUES (?, ?, ?, ?, ?, ?, 0)",
            (author_name, area, category, title, content, created_at),
        )
        conn.commit()
        post_id = cur.lastrowid
        return jsonify({"id": post_id, "author_name": author_name, "area": area, "category": category, "title": title, "content": content, "created_at": created_at, "likes": 0})
    finally:
        conn.close()


@app.route("/api/public-posts/<int:post_id>/like", methods=["POST"])
def public_post_like(post_id):
    """Toggle like. Body: { user_fingerprint }. Returns { likes, liked }."""
    _init_public_db()
    body = request.get_json() or {}
    fingerprint = (body.get("user_fingerprint") or "").strip()
    if not fingerprint:
        return jsonify({"error": "user_fingerprint required."}), 400
    conn = _get_db()
    try:
        cur = conn.execute("SELECT id FROM posts WHERE id = ?", (post_id,))
        if cur.fetchone() is None:
            return jsonify({"error": "Post not found."}), 404
        cur = conn.execute(
            "SELECT 1 FROM post_likes WHERE post_id = ? AND user_fingerprint = ?",
            (post_id, fingerprint),
        )
        exists = cur.fetchone() is not None
        if exists:
            conn.execute(
                "DELETE FROM post_likes WHERE post_id = ? AND user_fingerprint = ?",
                (post_id, fingerprint),
            )
            conn.execute("UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?", (post_id,))
            liked = False
        else:
            conn.execute(
                "INSERT INTO post_likes (post_id, user_fingerprint) VALUES (?, ?)",
                (post_id, fingerprint),
            )
            conn.execute("UPDATE posts SET likes = likes + 1 WHERE id = ?", (post_id,))
            liked = True
        conn.commit()
        cur = conn.execute("SELECT likes FROM posts WHERE id = ?", (post_id,))
        row = cur.fetchone()
        likes = row[0] if row else 0
        return jsonify({"likes": likes, "liked": liked})
    finally:
        conn.close()


@app.route("/api/public-posts/<int:post_id>/comments", methods=["GET"])
def public_post_comments_list(post_id):
    """List comments for a post."""
    _init_public_db()
    conn = _get_db()
    try:
        cur = conn.execute(
            "SELECT id, post_id, author_name, content, created_at FROM comments WHERE post_id = ? ORDER BY created_at ASC",
            (post_id,),
        )
        rows = cur.fetchall()
        out = [dict(zip(row.keys(), row)) for row in rows]
        return jsonify({"comments": out})
    finally:
        conn.close()


@app.route("/api/public-posts/<int:post_id>/comments", methods=["POST"])
def public_post_comment_create(post_id):
    """Add a comment. Body: author_name, content."""
    _init_public_db()
    body = request.get_json() or {}
    author_name = (body.get("author_name") or "").strip() or "Anonymous"
    content = (body.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Content is required."}), 400
    conn = _get_db()
    try:
        cur = conn.execute("SELECT id FROM posts WHERE id = ?", (post_id,))
        if cur.fetchone() is None:
            return jsonify({"error": "Post not found."}), 404
        from datetime import datetime
        created_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        cur = conn.execute(
            "INSERT INTO comments (post_id, author_name, content, created_at) VALUES (?, ?, ?, ?)",
            (post_id, author_name, content, created_at),
        )
        conn.commit()
        cid = cur.lastrowid
        return jsonify({"id": cid, "post_id": post_id, "author_name": author_name, "content": content, "created_at": created_at})
    finally:
        conn.close()


def _require_admin():
    if not session.get("admin"):
        return jsonify({"error": "Unauthorized. Admin login required."}), 401
    return None


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    """Login with username and password. Body: username, password."""
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "").strip()
    if username and password and ADMIN_ACCOUNTS.get(username) == password:
        session["admin"] = True
        return jsonify({"success": True, "message": "Logged in."})
    return jsonify({"error": "Invalid username or password."}), 401


@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.pop("admin", None)
    return jsonify({"success": True})


@app.route("/api/admin/me")
def admin_me():
    return jsonify({"admin": session.get("admin", False)})


@app.route("/api/public-posts/<int:post_id>", methods=["DELETE"])
def public_post_delete(post_id):
    err = _require_admin()
    if err:
        return err
    _init_public_db()
    conn = _get_db()
    try:
        cur = conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Post not found."}), 404
        return jsonify({"success": True})
    finally:
        conn.close()


@app.route("/api/public-posts/<int:post_id>/comments/<int:comment_id>", methods=["DELETE"])
def public_comment_delete(post_id, comment_id):
    err = _require_admin()
    if err:
        return err
    _init_public_db()
    conn = _get_db()
    try:
        cur = conn.execute(
            "DELETE FROM comments WHERE id = ? AND post_id = ?",
            (comment_id, post_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Comment not found."}), 404
        return jsonify({"success": True})
    finally:
        conn.close()


def _groq_reply(question, return_error=False):
    """Call Groq chat completions API. Returns reply text or None on failure.
    If return_error=True, returns (reply_or_None, error_message_or_None)."""
    if not GROQ_API_KEY or not question:
        out = (None, "No API key or empty question" if return_error else None)
        return out if return_error else None
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": CHATBOT_SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ],
        "max_tokens": 220,
        "temperature": 0.7,
    }
    try:
        if _CURL_CFFI_AVAILABLE:
            r = _curl_requests.post(
                url,
                json=payload,
                headers={"Authorization": "Bearer " + GROQ_API_KEY},
                impersonate="chrome120",
                timeout=30,
            )
            if r.status_code != 200:
                err = f"HTTP {r.status_code}: {(r.text or '')[:300]}"
                print("[Groq API]", err)
                return (None, err) if return_error else None
            out = r.json()
        else:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": "Bearer " + GROQ_API_KEY,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                out = json.loads(resp.read().decode("utf-8"))
        choices = out.get("choices") or []
        if not choices:
            err = "Empty choices in response"
            if return_error:
                return None, err
            return None
        msg = choices[0].get("message") or {}
        text = (msg.get("content") or "").strip()
        return (text, None) if return_error else text
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        err = f"HTTP {e.code}: {body[:300]}"
        print("[Groq API] HTTPError", e.code, body[:400])
        return (None, err) if return_error else None
    except Exception as e:
        err = f"{type(e).__name__}: {str(e)}"
        print("[Groq API] Error:", err)
        return (None, err) if return_error else None


@app.route("/api/chat/status", methods=["GET"])
def chat_status():
    """Check if chatbot API (Groq) is configured and connection works."""
    if not GROQ_API_KEY:
        key_path = os.path.join(BACKEND_DIR, "groq_api_key.txt")
        return jsonify({
            "configured": False,
            "connected": False,
            "message": "GROQ_API_KEY is not set. Set it in your environment or add groq_api_key.txt in the backend folder.",
            "key_file_path": key_path,
            "key_file_exists": os.path.isfile(key_path),
        })
    test_reply, test_error = _groq_reply("Reply with exactly: OK", return_error=True)
    if test_reply:
        return jsonify({
            "configured": True,
            "connected": True,
            "message": "Chatbot API is connected successfully.",
        })
    return jsonify({
        "configured": True,
        "connected": False,
        "message": "API key is set but the connection failed. Check your key and network.",
        "error": test_error,
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """Chatbot: body.message -> reply from Groq API."""
    body = request.get_json(silent=True) or {}
    q = (body.get("message") or "").strip()
    if not q:
        return jsonify({"reply": "Please type a question."})
    reply = _groq_reply(q)
    if reply:
        return jsonify({"reply": reply})
    return jsonify({"reply": "Sorry, the assistant could not get a response. Please try again."})


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def frontend_static(path):
    return send_from_directory(FRONTEND_DIR, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
