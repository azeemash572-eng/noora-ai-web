# NOORA AI optional server proxy (Phase 1)

Static GitHub Pages / Android WebView keep working **without** this server (keys stay in the user's Settings / localStorage).

## Why

When you set **Server URL** in the app Settings, the client routes AI / TTS / image calls here so API keys can live in Replit Secrets / `process.env` instead of the browser.

## Run (local or Replit)

```bash
cd server
cp .env.example .env          # fill GEMINI_API_KEY etc. — never commit .env
cp package.json.example package.json
npm install
npm start                     # http://127.0.0.1:8787
```

(`package.json` is named `package.json.example` in git so GitHub Pages does not try to npm-install this folder.)

Health: `GET /health` → `{ ok: true, version: "2.1.0" }`

AI without key: `POST /ai/chat` → `401` `{ error: "key missing" }`.

Free image: `GET /image/txt2img?prompt=sunset` proxies Pollinations (upstream may rate-limit).

Do **not** deploy this server to GitHub Pages (static only).
