const test = require('node:test');
const assert = require('node:assert/strict');
const { generateText } = require('../src/ai');

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function restore(env) {
  global.fetch = env.fetch;
  if (env.key !== undefined) process.env.OPENROUTER_API_KEY = env.key;
  else delete process.env.OPENROUTER_API_KEY;
  if (env.model !== undefined) process.env.OPENROUTER_MODEL = env.model;
  else delete process.env.OPENROUTER_MODEL;
}

function snapshot() {
  return {
    fetch: global.fetch,
    key: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
  };
}

test('generateText POSTs correct OpenRouter request and returns trimmed content', async () => {
  const env = snapshot();
  process.env.OPENROUTER_API_KEY = 'test-key';
  delete process.env.OPENROUTER_MODEL;
  let captured;
  global.fetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '  AI says hi\n' } }] }) };
  };
  try {
    const t = await generateText('hello');
    assert.equal(t, 'AI says hi');
    assert.equal(captured.url, API_URL);
    assert.equal(captured.opts.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(captured.opts.body);
    assert.equal(body.model, 'openrouter/free');
    assert.equal(body.messages[0].role, 'user');
    assert.equal(body.messages[0].content, 'hello');
    assert.equal(body.max_tokens, 400);
  } finally {
    restore(env);
  }
});

test('generateText returns null when OpenRouter responds non-OK', async () => {
  const env = snapshot();
  process.env.OPENROUTER_API_KEY = 'test-key';
  global.fetch = async () => ({ ok: false, status: 429 });
  try {
    assert.equal(await generateText('hi'), null);
  } finally {
    restore(env);
  }
});

test('generateText returns null when network throws', async () => {
  const env = snapshot();
  process.env.OPENROUTER_API_KEY = 'test-key';
  global.fetch = async () => {
    throw new Error('network down');
  };
  try {
    assert.equal(await generateText('hi'), null);
  } finally {
    restore(env);
  }
});