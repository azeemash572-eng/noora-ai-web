#!/usr/bin/env bash
# Live CORS check of every endpoint the page calls, sent with a browser-style Origin header.
O="${ORIGIN:-https://ayesha.github.io}"
row() { # name method url [data]
  local name="$1" m="$2" u="$3" d="$4" h b
  if [ "$m" = POST ]; then
    b=$(curl -s -m 60 -D /tmp/h.txt -o /tmp/b.bin -w '%{http_code} %{content_type}' -H "Origin: $O" -H 'Content-Type: application/json' -d "$d" "$u")
  else
    b=$(curl -s -m 60 -D /tmp/h.txt -o /tmp/b.bin -w '%{http_code} %{content_type}' -H "Origin: $O" "$u")
  fi
  h=$(grep -i '^access-control-allow-origin' /tmp/h.txt | tr -d '\r' | cut -d' ' -f2-)
  printf '%-26s %s  ACAO=%s\n    sample: %s\n' "$name" "$b" "${h:-NONE}" "$(head -c 260 /tmp/b.bin | tr '\n\r' '  ' | LC_ALL=C sed 's/[^[:print:]]/./g')"
}
pre() { # preflight
  local name="$1" u="$2"
  local s=$(curl -s -m 30 -o /dev/null -D /tmp/h.txt -w '%{http_code}' -X OPTIONS -H "Origin: $O" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,authorization' "$u")
  printf '%-26s preflight %s  ACAO=%s  allow-headers=%s\n' "$name" "$s" "$(grep -i '^access-control-allow-origin' /tmp/h.txt | tr -d '\r' | cut -d' ' -f2-)" "$(grep -i '^access-control-allow-headers' /tmp/h.txt | tr -d '\r' | cut -d' ' -f2- | head -c 60)"
}
echo "Origin: $O   $(date -u)"
row "rss2json (Google News)" GET "https://api.rss2json.com/v1/api.json?rss_url=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("https://news.google.com/rss/search?q=Pakistan&hl=en-PK&gl=PK&ceid=PK:en",safe=""))')"
row "news.google.com direct" GET "https://news.google.com/rss/search?q=Pakistan&hl=en-PK&gl=PK&ceid=PK:en"
row "Wikipedia en" GET "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=founder%20pakistan"
row "Wikipedia ur" GET "https://ur.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=%D9%84%D8%A7%DB%81%D9%88%D8%B1"
row "open.er-api.com" GET "https://open.er-api.com/v6/latest/USD"
row "gold-api.com XAU" GET "https://api.gold-api.com/price/XAU"
row "gold-api.com XAG" GET "https://api.gold-api.com/price/XAG"
row "Coinbase BTC" GET "https://api.coinbase.com/v2/prices/BTC-USD/spot"
row "Open-Meteo geocoding" GET "https://geocoding-api.open-meteo.com/v1/search?count=1&name=Lahore"
row "Open-Meteo forecast" GET "https://api.open-meteo.com/v1/forecast?latitude=31.558&longitude=74.35&current=temperature_2m,weather_code&timezone=auto"
row "text.pollinations /openai" POST "https://text.pollinations.ai/openai" '{"model":"openai","messages":[{"role":"user","content":"Reply with exactly: NOORA OK"}],"referrer":"noora-ai-web"}'
row "text.pollinations POST /" POST "https://text.pollinations.ai/" '{"model":"openai","messages":[{"role":"user","content":"Reply with exactly: NOORA OK"}],"referrer":"noora-ai-web"}'
row "gen.pollinations (no key)" POST "https://gen.pollinations.ai/v1/chat/completions" '{"model":"openai","messages":[{"role":"user","content":"Reply with exactly: NOORA OK"}]}'
row "image.pollinations" GET "https://image.pollinations.ai/prompt/red%20rose?width=256&height=256&nologo=true&seed=7&referrer=noora-ai-web"
pre "text.pollinations /openai" "https://text.pollinations.ai/openai"
pre "gen.pollinations" "https://gen.pollinations.ai/v1/chat/completions"
pre "OpenAI (user key)" "https://api.openai.com/v1/chat/completions"
pre "Gemini (user key)" "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
pre "Groq (user key)" "https://api.groq.com/openai/v1/chat/completions"
pre "OpenRouter (user key)" "https://openrouter.ai/api/v1/chat/completions"
