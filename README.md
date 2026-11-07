# CAVDOME

Debate evidence workspace. Card Cut, Highlights Only, Flow, Card Library, speech and prep timers, and a break calculator.

Card Cut runs on the server with no API keys: it opens the article, scores passages against your argument and returns a card with a tag, cite, underlining and highlighting. Highlights Only reads a carded case PDF in the browser (using pdf.js) and keeps only the tags, evidence names and highlighted text.

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
| `CA_BUNDLE` | Path to a certificate file, only needed on networks that inspect HTTPS traffic. |
| `PORT` | Port to listen on (default 8000). |

## Notes

- Some publishers block automated readers. Card Cut accepts pasted text for those sites.
- Flow, Library and settings are stored in each visitor's browser.
- The homepage reviews are placeholders. Replace them in `static/js/app.js` (`REVIEWS`) with real quotes before launch.
