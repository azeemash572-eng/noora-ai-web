const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../core.js');

test('version is 2.1.0', () => {
  assert.equal(C.VERSION, '2.1.0');
  assert.equal(fs.readFileSync(__dirname + '/../VERSION', 'utf8').trim(), '2.1.0');
});

test('tool registry lists expected tools', async () => {
  const reg = C.createToolRegistry({});
  const ids = reg.list().map((t) => t.id).sort();
  for (const id of ['calculator', 'datetime', 'web', 'memory', 'device', 'files', 'image', 'video']) {
    assert.ok(ids.includes(id), 'missing ' + id);
  }
  const calc = await reg.run('calculator', { expr: '2+3*4' });
  assert.equal(calc.ok, true);
  assert.equal(calc.data, 14);
  const dt = await reg.run('datetime', {});
  assert.equal(dt.ok, true);
  assert.ok(dt.data.iso);
  const vid = await reg.run('video', { settings: {} });
  assert.equal(vid.ok, false);
  assert.ok(/no video provider|not configured/i.test(vid.message));
});

test('provider selection', () => {
  const free = C.selectAiProvider({ provider: C.PROVIDER_FREE });
  assert.equal(free.id, 'pollinations');
  const gem = C.selectAiProvider({
    provider: 'Google Gemini',
    apiKey: 'fake-key',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    chatModel: 'gemini-2.5-flash'
  });
  assert.equal(gem.id, 'openai-compat');
  assert.equal(gem.model, 'gemini-2.5-flash');
  const srv = C.selectAiProvider({ serverUrl: 'https://example.com', provider: C.PROVIDER_FREE });
  assert.equal(srv.id, 'server');
  const img = C.selectImageProvider({});
  assert.equal(img.id, 'pollinations');
  assert.ok(img.ops.includes('txt2img'));
  const vid = C.selectVideoProvider({});
  assert.equal(vid.ready, false);
});

test('conversation rename/delete/search helpers', () => {
  const list = [
    { id: 1, title: 'Lahore weather', project: '' },
    { id: 2, title: 'Gemini tips', project: 'work' },
    { id: 3, title: 'Urdu poem', project: '' }
  ];
  assert.equal(C.searchConversations(list, 'gemini').length, 1);
  assert.equal(C.searchConversations(list, 'work').length, 1);
  assert.equal(C.searchConversations(list, '').length, 3);
  const renamed = C.renameConversationRecord(list[0], '  New title  ');
  assert.equal(renamed.title, 'New title');
  assert.ok(renamed.updated);
  assert.equal(C.renameConversationRecord(list[0], '   '), null);
});

test('migration preserves Gemini key and old chats shape', () => {
  const saved = {
    provider: 'Google Gemini',
    apiKey: 'AIzaSyFAKE_TEST_KEY_NOT_REAL_123456',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    chatModel: 'gemini-2.5-flash',
    visionModel: 'gemini-2.5-flash',
    userName: 'Ayesha',
    ttsOn: true
  };
  const m = C.migrateSettings(saved, {
    provider: C.PROVIDER_FREE, baseUrl: '', apiKey: '', chatModel: '', visionModel: '',
    userName: '', serverUrl: '', videoProvider: '', videoApiKey: '', videoBaseUrl: ''
  });
  assert.equal(m.apiKey, saved.apiKey);
  assert.equal(m.provider, 'Google Gemini');
  assert.equal(m.chatModel, 'gemini-2.5-flash');
  assert.equal(m.userName, 'Ayesha');
  assert.equal(m.serverUrl, '');
  assert.ok(m.ttsProvider === 'browser' || m.ttsOn === true);
  // Old chat objects remain valid without forced schema wipe
  const chat = { id: 9, title: 'Old chat', created: 1, updated: 2, folderId: null };
  const r = C.renameConversationRecord(chat, 'Still here');
  assert.equal(r.id, 9);
  assert.equal(r.title, 'Still here');
});

test('streaming SSE parser', () => {
  const a = C.parseSSEChunk('data: {"choices":[{"delta":{"content":"Hel"}}]}\n');
  assert.equal(a.delta, 'Hel');
  const b = C.parseSSEChunk('data: [DONE]\n');
  assert.equal(b.done, true);
  let state = C.parseStreamBuffer('', 'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n');
  assert.equal(state.delta, 'lo');
  state = C.parseStreamBuffer(state.buffer, 'data: {"choices":[{"delta":{"content":"!"}}]}\n\ndata: [DONE]\n\n');
  assert.equal(state.delta, '!');
  assert.equal(state.done, true);
});

test('file validation', () => {
  assert.equal(C.validateUpload({ name: 'a.png', size: 100, type: 'image/png' }).ok, true);
  assert.equal(C.validateUpload({ name: 'a.exe', size: 100, type: 'application/x-msdownload' }).ok, false);
  assert.equal(C.validateUpload({ name: 'big.png', size: 20 * 1024 * 1024, type: 'image/png' }).ok, false);
});

test('system prompt auto language + personality preserved', () => {
  const sp = C.systemPrompt({ userName: 'Ayesha', tone: 'Warm & caring', languagePrompt: 'Roman Urdu', platform: 'web' });
  assert.ok(/Auto-detect|Roman Urdu|Punjabi|English/i.test(sp));
  assert.ok(/warm|affectionate|playful/i.test(sp));
  assert.ok(/never claim you have no restrictions/i.test(sp));
  assert.ok(/Do not mention filters/i.test(sp));
});

test('no hardcoded secrets in shipped sources', () => {
  for (const f of ['../core.js', '../app.js', '../index.html']) {
    const s = fs.readFileSync(__dirname + '/' + f, 'utf8');
    assert.ok(C.assertNoHardcodedSecrets(s), f);
  }
});
