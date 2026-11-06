# CAVDOME

Debate evidence workspace. Card Search, Card Cut, Block Generator, Caselist, Flow, Card Library, speech and prep timers, and a break calculator.

Searching and card cutting run on the server with no AI and no API keys. The server searches DuckDuckGo (with Bing as a fallback), opens the articles, scores passages against your claim, and returns cut cards with tags, cites, underlining and highlighting.

## Run it on your computer

Needs Python 3.9 or newer. There's nothing to install.

```bash
python3 server.py
```

Then open http://localhost:8000

## Put it on the internet (Render, free tier)

1. Put this folder in a GitHub repository.
2. On https://render.com choose **New → Web Service** and pick the repository.
3. Render reads `render.yaml`. If it asks, use:
   - Runtime: Python
   - Build command: `pip install -r requirements.txt`
   - Start command: `python3 server.py`
4. Deploy. Render gives you a `https://…onrender.com` address. You can attach your own domain in Render's settings.

Railway, Fly.io and any VPS work the same way: run `python3 server.py` and set `PORT`.

## Optional settings (environment variables)

| Variable | What it does |
|---|---|
| `SERPER_API_KEY` | Uses Google results through serper.dev instead of DuckDuckGo. |
| `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` | Uses Google Programmable Search instead. |
| `OPENCASELIST_USERNAME` + `OPENCASELIST_PASSWORD` | A Tabroom login so the Caselist tab can read openCaselist. Without it, Caselist shows a setup notice. |
| `CA_BUNDLE` | Path to a certificate file, only needed on networks that inspect HTTPS traffic. |
| `PORT` | Port to listen on (default 8000). |

## Notes

- Some publishers block automated readers. CAVDOME skips them and uses the next result. Card Cut accepts pasted text for those sites.
- Flow, Library and settings are stored in each visitor's browser.
- The homepage reviews are placeholders. Replace them in `static/js/app.js` (`REVIEWS`) with real quotes before launch.
- The Caselist connector has not been tested against a real openCaselist login.
