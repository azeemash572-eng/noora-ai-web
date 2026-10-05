# NOORA AI optional server proxy (Phase 1)

Static GitHub Pages / Android WebView keep working **without** this server (keys stay in the user's Settings / localStorage).

## Why

When you set **Server URL** in the app Settings, the client routes AI / TTS / image calls here so API keys can live in Replit Secrets / `process.env` instead of the browser.

## Run (local or Replit)

```bash
cd server
cp .env.example .env   # fill GEMINI_API_KEY etc. — never commit .env
npm install
npm start              # http://127.0.0.1:8787
```

Health: `GET /health` → `{ ok: true, version: "2.1.0" }`

AI without key: `POST /ai/chat` with no `GEMINI_API_KEY` / `OPENAI_API_KEY` → `401` JSON `{ error: "key missing" }` (honest).

Free image (no key): `GET /image/txt2img?prompt=sunset` proxies Pollinations.

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Liveness |
| POST | `/ai/chat` | OpenAI-compat proxy (Gemini/OpenAI env keys); supports `stream` |
| POST | `/voice/tts` | ElevenLabs or OpenAI TTS via env keys |
| GET | `/image/txt2img` | Pollinations proxy (no key) |
| POST | `/video/*` | `{ error: "no provider configured" }` |
| GET | `/tools` | Lists server-side tool ids |
| POST | `/files/validate` | Type/size check |

Do **not** deploy this repo's server to GitHub Pages (static only).
