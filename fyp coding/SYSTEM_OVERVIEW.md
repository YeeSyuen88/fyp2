# EstateView – System Overview (for Moderation / Viva)

This document explains the **concept**, **data storage**, **implementation**, and **chatbot API** of the EstateView website so you can answer questions clearly during moderation.

---

## 1. What is EstateView?

**EstateView** is a **Malaysia property intelligence web application**. It helps users:

- **Map**: View property data (current average price, predicted 1‑month price, flood risk) by state and district on an interactive map.
- **Filter Property**: Filter listings by price range and property type; see which areas (state/district) match.
- **Get Estimation**: Get estimated price and 1‑month prediction for a chosen state, district, and property type (with optional floor area).
- **Public Community**: Post and read community posts, comment, and like (moderated by admin).
- **Private Feedback**: Send private feedback (rating + comment) to the admin email.
- **Chatbot**: Ask the assistant about current price, predicted 1‑month price, and flood risk for any area in Malaysia; answers are short and include the area name.

---

## 2. Technology Stack (High Level)

| Layer        | Technology |
|-------------|------------|
| **Frontend**| HTML, CSS, JavaScript; Leaflet.js for map; Chart.js for charts; multi-language (EN, MS, ZH) via `lang.js` |
| **Backend** | Python, Flask, Flask-CORS |
| **Data**    | JSON files, CSV files, SQLite (public community), optional ML model (joblib) |
| **Chatbot** | Groq API (LLM: Llama 3.1 8B Instant); `curl_cffi` for reliable HTTP when needed |

---

## 3. Database and Data Storage

The system uses **multiple data sources** (no single “main database”):

### 3.1 JSON files (map + estimator logic)

- **`output/predictions.json`**  
  - Pre-computed **state-level and district-level** property data.  
  - Used for: map sidebar list, map click (area detail), price history, and estimator’s 1‑month prediction.  
  - Structure: `state` and `district` keys; each entry has e.g. `current_price`, `predicted_price_1month`, and can include `flood_risk`.  
  - **Not a database** – read at startup/cache in memory for fast API responses.

- **`output/area_property_summary.json`**  
  - Built by `scripts/build_area_summary.py`.  
  - Used for: estimator form options (states, districts, property types) and floor area / room ranges per area and property type.  
  - **Not a database** – static JSON for dropdowns and validation.

### 3.2 CSV files (filter + price history)

- **`data/cleaned.csv`**  
  - Cleaned property listings (price, state, district, property type, etc.).  
  - Used for: **Filter Property** (filter by price and type, aggregate by state/district) and **price histogram**.  
  - Read on demand by the backend (no DB).

- **`data/state_daily.csv`** / **`data/district_daily.csv`**  
  - Time series of average price by state (and optionally district).  
  - Used for: **price trend chart** on the map when user selects an area.

### 3.3 SQLite (public community only)

- **`data/public_comments.db`**  
  - **This is the only real “database”** in the system.  
  - **Tables:**  
    - `posts`: id, author_name, area, category, title, content, created_at, likes.  
    - `post_likes`: post_id, user_fingerprint (to avoid duplicate likes).  
    - `comments`: id, post_id, author_name, content, created_at.  
  - **Used for:** Public Community – list posts, create post, like, comment, delete comment (admin).  
  - Created automatically on first use; no separate MySQL/PostgreSQL.

### 3.4 ML model (optional, for estimator)

- **`models/estimator_price.joblib`**  
  - Trained model (e.g. regression) for **price estimation** from state, district, property type, floor area (from `scripts/train_estimator.py`).  
  - Loaded with **joblib**; used if the estimator needs a per–floor-area estimate.  
  - The **1‑month prediction** shown in the estimator comes from **`predictions.json`** (state/district), not from this model.

### Summary for moderation

- **“What database do you use?”**  
  - **SQLite** for the **Public Community** (posts, comments, likes).  
  - **No relational database** for map, filter, or estimator – they use **JSON and CSV** (pre-processed data and cleaned listings).

- **“Where does the map get its data?”**  
  - **`output/predictions.json`** (current price, predicted 1‑month price, flood risk by state/district).

- **“Where does the filter get its data?”**  
  - **`data/cleaned.csv`** (filter by price and property type; backend aggregates by state/district and returns counts and average price).

---

## 4. Chatbot API (Groq)

### 4.1 What is it?

The chatbot uses **Groq’s cloud API** to run a **large language model (LLM)**. The model is **Llama 3.1 8B Instant**: it answers in natural language using its own knowledge (e.g. property prices, flood risk for Malaysian areas). The system does **not** reply from EstateView’s own dataset only; the LLM can answer for any area the user asks about.

### 4.2 How it is implemented

- **API endpoint:**  
  - `https://api.groq.com/openai/v1/chat/completions`  
  - Same style as OpenAI (POST, JSON body with `messages`, `model`, `max_tokens`, `temperature`).

- **Authentication:**  
  - API key is loaded from environment variable **`GROQ_API_KEY`** or from file **`backend/groq_api_key.txt`**.  
  - Sent in the header: `Authorization: Bearer <key>`.

- **Request payload:**  
  - **System message:** A fixed **system prompt** (`CHATBOT_SYSTEM_PROMPT`) that tells the model to:  
    - Act as EstateView assistant for Malaysia property.  
    - Answer with **short** replies (e.g. bullet points, under ~60 words).  
    - Always show the **area name** (e.g. “For Padang Terap, Kedah:”) and give: current avg price (RM), predicted 1‑month price (RM and % change), flood risk.  
    - Not say “we don’t have data” – answer from the model’s knowledge.  
  - **User message:** The user’s question (e.g. “What is the Current avg price, Predicted 1 month and Flood risk data for the Padang Terap, Kedah?”).  
  - **Model:** `llama-3.1-8b-instant`.  
  - **max_tokens:** 220 (keeps replies short).  
  - **temperature:** 0.7.

- **Response:**  
  - Backend reads `choices[0].message.content` and returns it to the frontend as the chatbot reply.

### 4.3 Why “curl_cffi”?

- Groq’s API is behind **Cloudflare**. Standard Python `urllib` (or some `requests` setups) can get **HTTP 403 (error 1010)** because of TLS fingerprinting.  
- **`curl_cffi`** is used to send requests with a **browser-like TLS fingerprint** (e.g. Chrome). So the backend uses **`curl_cffi`** when available to call Groq; if not installed, it falls back to `urllib` (which may fail in some networks).

### 4.4 Backend endpoints for chatbot

- **`GET /api/chat/status`**  
  - Checks if the API key is set and if a test call to Groq succeeds.  
  - Returns `configured`, `connected`, and optional `error` for debugging.

- **`POST /api/chat`**  
  - Body: `{ "message": "user question" }`.  
  - Backend calls `_groq_reply(question)`, then returns `{ "reply": "..." }` to the frontend.

### Summary for moderation

- **“What API does the chatbot use?”**  
  - **Groq API** (Llama 3.1 8B Instant), via the OpenAI-compatible chat completions endpoint.

- **“Where do the chatbot answers come from?”**  
  - From the **LLM’s own knowledge**, not only from EstateView’s JSON/CSV. The system prompt tells the model to answer for any Malaysian area with current price, 1‑month prediction, and flood risk in short form.

- **“Why use curl_cffi?”**  
  - To avoid **Cloudflare 403 (1010)** by using a browser-like TLS fingerprint when calling Groq’s API.

---

## 5. Implementation Summary (Flow)

1. **Map**  
   - Frontend loads **predictions** from `/api/predictions` (from `predictions.json`).  
   - Map uses **Leaflet** + GeoJSON (states/districts). Clicking an area requests `/api/area-data?state=...&district=...` and shows current price, 1‑month prediction, flood risk, and price trend (from `state_daily.csv` / `district_daily.csv`).  
   - “Ask chatbot” from a no-data area opens the chatbot and sends a pre-filled question including the area name.

2. **Filter**  
   - User sets price range and property type.  
   - Frontend calls `/api/filter-results?min_price=...&max_price=...&property_type=...`.  
   - Backend reads **cleaned.csv**, filters, aggregates by state/district, returns list with avg price and count.

3. **Estimator**  
   - User selects state, district (optional), property type.  
   - Options come from **area_property_summary.json** (or estimator joblib options).  
   - Frontend calls **`POST /api/estimate`** with state, district, property_type.  
   - Backend uses **predictions.json** for 1‑month prediction and **area_property_summary.json** for floor area/room ranges; optional **joblib** model for finer price estimate.

4. **Public Community**  
   - All persistent data in **SQLite** (`public_comments.db`): posts, comments, likes.  
   - REST API: list posts, create post, like, list/add/delete comments (admin delete).

5. **Private Feedback**  
   - Form sends rating + comment to **`POST /api/feedback`**.  
   - Backend sends email (e.g. SMTP to a fixed address); no database storage.

6. **Chatbot**  
   - User types (or “Ask chatbot” sends) a question.  
   - Frontend calls **`POST /api/chat`** with `{ "message": "..." }`.  
   - Backend sends system prompt + user message to **Groq**, returns the model’s reply.

---

## 6. Short Answers for Common Moderation Questions

| Question | Short answer |
|----------|--------------|
| What is EstateView? | A Malaysia property intelligence web app: map (prices, predictions, flood risk), filter by price/type, price estimator, public community, private feedback, and a chatbot for property/flood Q&A. |
| What database do you use? | **SQLite** for the Public Community (posts, comments, likes). Map, filter, and estimator use **JSON and CSV** (predictions.json, cleaned.csv, area_property_summary.json, state/district daily CSVs). |
| Where does the map get its data? | From **output/predictions.json** (and price history from state_daily.csv / district_daily.csv). |
| What is the chatbot API? | **Groq API** (Llama 3.1 8B Instant). We send a system prompt + user question and get a short text reply (current price, 1‑month prediction, flood risk for the asked area). |
| Do chatbot answers come from your database? | No. They come from the **LLM’s knowledge**. Our system prompt only shapes the format (short, with area name and three bullet points). |
| Why curl_cffi? | Groq’s API is behind Cloudflare; normal Python HTTP can get 403. curl_cffi uses a browser-like TLS fingerprint so the request is accepted. |

You can use this document as your main reference when explaining the concept, database, and chatbot during moderation.
