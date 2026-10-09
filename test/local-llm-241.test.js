// 2.4.1 Phase 2: on-device LLM contract (download URL, size, offline-only hook docs). No real model / no device.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');

test('VERSION is 2.4.2', () => assert.equal(C.VERSION, '2.4.2'));

test('shouldSkipCloudAi still gates cloud when offline (local LLM is a separate offline fallback)', () => {
  assert.equal(C.shouldSkipCloudAi({ netMode: 'online' }, true), false);
  assert.equal(C.shouldSkipCloudAi({ netMode: 'auto' }, false), true);
});

test('Settings HTML exposes on-device AI card with size warning and cancel', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /id="localLlmCard"/);
  assert.match(html, /~0\.5 GB/);
  assert.match(html, /btnLocalLlmDownload/);
  assert.match(html, /btnLocalLlmCancel/);
  assert.match(html, /Qwen2\.5-0\.5B/);
  assert.match(html, /not inside the APK|not bundled/i);
});

test('app.js offlineHandle tries local LLM only after offlineReply fails', () => {
  const js = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert.match(js, /tryLocalLlmChat/);
  assert.match(js, /localChat/);
  assert.match(js, /on-device Qwen/);
  // online cloud chain must not call localChat
  const chatFn = js.slice(js.indexOf('async chat(messages'), js.indexOf('const toolRegistry'));
  assert.ok(!/localChat/.test(chatFn), 'AI.chat online path must not invoke localChat');
});

test('Kotlin LocalLlm points at HF q8 .task (~521MB) and never bundles it', () => {
  const kt = fs.readFileSync('/workspace/noora-ai/app/src/main/java/com/nura/assistant/LocalLlm.kt', 'utf8');
  assert.match(kt, /Qwen2\.5-0\.5B-Instruct_multi-prefill-seq_q8_ekv1280\.task/);
  assert.match(kt, /huggingface\.co\/litert-community\/Qwen2\.5-0\.5B-Instruct/);
  assert.match(kt, /MODEL_BYTES = 547_000_000L/);
  assert.match(kt, /Apache-2\.0/);
  assert.ok(!/assets\/.*\.task/.test(kt));
});
