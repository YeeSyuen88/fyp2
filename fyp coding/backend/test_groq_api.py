"""
Test Groq API directly. Run this to see if your key works.
  python backend/test_groq_api.py
"""
import os
import json
import urllib.request
import urllib.error

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
key_path = os.path.join(BACKEND_DIR, "groq_api_key.txt")
key = os.environ.get("GROQ_API_KEY", "").strip()
if not key and os.path.isfile(key_path):
    with open(key_path, "r", encoding="utf-8") as f:
        key = f.read().strip()

if not key:
    print("ERROR: No API key. Put your key in backend/groq_api_key.txt or set GROQ_API_KEY.")
    exit(1)

url = "https://api.groq.com/openai/v1/chat/completions"
payload = {
    "model": "llama-3.1-8b-instant",
    "messages": [
        {"role": "user", "content": "Say hello in one short sentence."}
    ],
    "max_tokens": 64,
}
print("Sending request to Groq...")
try:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    text = (out.get("choices") or [{}])[0].get("message", {}).get("content", "")
    print("SUCCESS. Reply:", text.strip() or "(empty)")
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    print("HTTP ERROR", e.code)
    print("Body:", body[:500])
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
