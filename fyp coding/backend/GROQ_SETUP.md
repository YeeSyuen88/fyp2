# Step-by-step: Set up Groq Chatbot API

Follow these steps to connect the EstateView chatbot to Groq so it can answer user questions.

---

## Step 1: Get a Groq API key (free)

1. Open your browser and go to **Groq Console**:  
   **https://console.groq.com**

2. Sign up or log in (email or GitHub). No credit card required for the free tier.

3. Go to **API Keys**:  
   **https://console.groq.com/keys**

4. Click **Create API Key**. Give it a name (e.g. "EstateView") and copy the key.  
   Keep it private; do not share or commit it to Git.

---

## Step 2: Add the key to your project

### Use a key file (recommended for development)

1. In the **`backend`** folder, create a file named **`groq_api_key.txt`**.

2. Open it and paste **only your API key** (one line, no spaces or quotes).

3. Save the file. The app will read the key from this file when it starts.

---

## Step 3: Start the backend and check connection

1. Open a terminal in your project folder.

2. Start the backend:
   ```powershell
   cd "c:\Users\yeesy\Downloads\fyp coding\fyp2\fyp coding"
   python backend/app.py
   ```

3. In the browser, go to:  
   **http://localhost:5000/api/chat/status**

4. You should see:
   ```json
   {
     "configured": true,
     "connected": true,
     "message": "Chatbot API is connected successfully."
   }
   ```
   - If `configured` is `false`, the key was not loaded. Check that `groq_api_key.txt` is in the **backend** folder and **restart** the server.
   - If `connected` is `false`, check your API key and internet connection.

---

## Step 4: Try the chatbot

1. Open your app: **http://localhost:5000**

2. Click the **chat icon** (bottom-right).

3. Type a question, e.g. “What is the capital of Malaysia?” or “How do I use the map?”  
   You should get a reply from the Groq-powered assistant.

---

## Troubleshooting

| Problem | What to do |
|--------|-------------|
| `configured: false` | Put your key in `backend/groq_api_key.txt` (one line). Restart: `python backend/app.py`. |
| `connected: false` | Check the key at https://console.groq.com/keys. Create a new key if needed. Ensure you have internet access. |
| “Sorry, the assistant could not get a response” | Check the terminal where the backend runs for error messages. Verify your Groq account and rate limits at https://console.groq.com. |
| Chat icon not showing | Hard refresh the page (Ctrl+F5). Ensure `chatbot.css` and `chatbot.js` are loaded (check browser dev tools Network tab). |

---

## Summary

- **Get key:** https://console.groq.com/keys  
- **Put key in:** `backend/groq_api_key.txt` (one line)  
- **Restart backend** after adding or changing the key.  
- **Check status:** http://localhost:5000/api/chat/status  
- **Use chatbot:** Click the chat icon on any page and ask a question.
