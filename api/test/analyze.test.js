'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateRequest, normalizeResult, analyze, buildRequestBody, parseModels, DEFAULT_MODELS } = require('../lib/analyze');

const ENV = { GEMINI_API_KEY: 'test-key', FIREBASE_PROJECT_ID: 'demo-project' };
const TINY_JPEG = Buffer.from('not-a-real-jpeg-but-valid-base64').toString('base64');

const goodModelOutput = {
  is_food: true,
  meal_name: 'Chicken and rice',
  comment: 'About 150 g chicken and 200 g cooked rice.',
  confidence: 'high',
  items: [
    { name: 'Grilled chicken breast', grams: 150, kcal: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4, fiber_g: 0, sugar_g: 0 },
    { name: 'White rice', grams: 200, kcal: 260, protein_g: 5.4, carbs_g: 57, fat_g: 0.6, fiber_g: 0.8, sugar_g: 0 },
  ],
};

const geminiResponse = (output) => ({ status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] }) });
const errorResponse = (status, message = 'x') => ({ status, json: async () => ({ error: { message } }) });

test('validateRequest accepts note-only, image-only and data URLs', () => {
  assert.equal(validateRequest({ note: '2 eggs' }).ok, true);
  assert.equal(validateRequest({ image: TINY_JPEG }).value.mimeType, 'image/jpeg');
  const withDataUrl = validateRequest({ image: `data:image/png;base64,${TINY_JPEG}` });
  assert.equal(withDataUrl.value.mimeType, 'image/png');
  assert.equal(withDataUrl.value.image, TINY_JPEG);
});

test('validateRequest rejects bad input', () => {
  assert.equal(validateRequest(null).error, 'invalid_body');
  assert.equal(validateRequest({}).error, 'empty_input');
  assert.equal(validateRequest({ note: '   ' }).error, 'empty_input');
  assert.equal(validateRequest({ note: 'x'.repeat(601) }).error, 'note_too_long');
  assert.equal(validateRequest({ image: '***' }).error, 'invalid_image');
  assert.equal(validateRequest({ image: TINY_JPEG, mimeType: 'image/gif' }).error, 'unsupported_image_type');
  const tooBig = validateRequest({ image: 'A'.repeat(3_500_001) });
  assert.equal(tooBig.error, 'image_too_large');
  assert.equal(tooBig.status, 413);
});

test('validateRequest falls back to English for unknown languages', () => {
  assert.equal(validateRequest({ note: 'x', lang: 'fr' }).value.lang, 'en');
  assert.equal(validateRequest({ note: 'x', lang: 'ro' }).value.lang, 'ro');
});

test('normalizeResult sums totals and clamps garbage values', () => {
  const result = normalizeResult({
    ...goodModelOutput,
    items: [...goodModelOutput.items, { name: ' ', kcal: 5 }, null, { name: 'Weird', grams: -5, kcal: 'NaN', protein_g: 10, carbs_g: 20, fat_g: 5 }],
  });
  assert.equal(result.isFood, true);
  assert.equal(result.items.length, 3);
  assert.equal(result.items[2].grams, 0);
  assert.equal(result.items[2].kcal, 4 * 10 + 4 * 20 + 9 * 5);
  assert.equal(result.totals.kcal, 248 + 260 + 165);
  assert.equal(result.totals.protein, 61.9);
});

test('normalizeResult flags non-food and empty answers', () => {
  assert.equal(normalizeResult({ is_food: false, items: [] }).isFood, false);
  assert.equal(normalizeResult({ is_food: true, items: [] }).isFood, false);
  assert.equal(normalizeResult(null).isFood, false);
});

test('normalizeResult limits the number of items and falls back to the first item name', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ name: `Item ${i}`, grams: 1, kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0 }));
  const result = normalizeResult({ is_food: true, items: many, confidence: 'nonsense' });
  assert.equal(result.items.length, 12);
  assert.equal(result.name, 'Item 0');
  assert.equal(result.confidence, 'medium');
});

test('buildRequestBody puts the note in the prompt and the photo first', () => {
  const body = buildRequestBody({ image: TINY_JPEG, mimeType: 'image/jpeg', note: 'half "portion"', lang: 'ro' });
  assert.equal(body.contents[0].parts[0].inlineData.data, TINY_JPEG);
  assert.match(body.contents[0].parts[1].text, /half 'portion'/);
  assert.match(body.systemInstruction.parts[0].text, /Romanian/);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.equal(buildRequestBody({ image: null, note: 'x', lang: 'en' }, { thinking: false }).generationConfig.thinkingConfig, undefined);
});

test('parseModels uses defaults and ignores unsafe ids', () => {
  assert.deepEqual(parseModels(''), DEFAULT_MODELS);
  assert.deepEqual(parseModels('a-b, c.d ,../evil'), ['a-b', 'c.d']);
});

test('analyze returns normalized data from the first model', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, key: init.headers['x-goog-api-key'] });
    return geminiResponse(goodModelOutput);
  };
  const result = await analyze({ image: TINY_JPEG, mimeType: 'image/jpeg', note: '', lang: 'en' }, ENV, { fetchImpl });
  assert.equal(result.status, 200);
  assert.equal(result.body.totals.kcal, 508);
  assert.equal(result.body.model, DEFAULT_MODELS[0]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes(`/${DEFAULT_MODELS[0]}:generateContent`));
  assert.equal(calls[0].key, 'test-key');
});

test('analyze falls back to the next model on 429 and 503', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url.split('/models/')[1].split(':')[0]);
    if (seen.length === 1) return errorResponse(429);
    if (seen.length === 2) return errorResponse(503);
    return geminiResponse(goodModelOutput);
  };
  const result = await analyze({ image: null, note: 'x', lang: 'en' }, ENV, { fetchImpl });
  assert.equal(result.status, 200);
  assert.deepEqual(seen, DEFAULT_MODELS.slice(0, 3));
  assert.equal(result.body.model, DEFAULT_MODELS[2]);
});

test('analyze retries the same model without thinking when the level is rejected', async () => {
  const configs = [];
  const fetchImpl = async (url, init) => {
    configs.push(JSON.parse(init.body).generationConfig.thinkingConfig);
    return configs.length === 1 ? errorResponse(400, 'Thinking level not supported') : geminiResponse(goodModelOutput);
  };
  const result = await analyze({ image: null, note: 'x', lang: 'en' }, ENV, { fetchImpl });
  assert.equal(result.status, 200);
  assert.equal(result.body.model, DEFAULT_MODELS[0]);
  assert.deepEqual(configs, [{ thinkingLevel: 'low' }, undefined]);
});

test('analyze skips unusable output and reports busy when every model is rate limited', async () => {
  let n = 0;
  const garbage = { status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }) };
  const result = await analyze({ image: null, note: 'x', lang: 'en' }, ENV, { fetchImpl: async () => (n++ === 0 ? garbage : errorResponse(429)) });
  assert.equal(result.status, 429);
  assert.equal(result.body.error, 'ai_busy');
});

test('analyze maps blocked prompts, rejected input and outages', async () => {
  const blocked = await analyze({ image: null, note: 'x', lang: 'en' }, ENV, {
    fetchImpl: async () => ({ status: 200, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }),
  });
  assert.equal(blocked.status, 422);
  assert.equal(blocked.body.error, 'ai_blocked');

  const rejected = await analyze({ image: null, note: 'x', lang: 'en' }, ENV, { fetchImpl: async () => errorResponse(400, 'bad image') });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.error, 'ai_rejected_input');

  const down = await analyze({ image: null, note: 'x', lang: 'en' }, ENV, {
    fetchImpl: async () => {
      throw new Error('network');
    },
  });
  assert.equal(down.status, 502);
  assert.equal(down.body.error, 'ai_unavailable');
});

test('analyze stops trying when the time budget is exhausted', async () => {
  let clock = 0;
  let calls = 0;
  const result = await analyze({ image: null, note: 'x', lang: 'en' }, ENV, {
    now: () => clock,
    fetchImpl: async () => {
      calls++;
      clock += 20_000;
      return errorResponse(503);
    },
  });
  assert.equal(result.status, 502);
  assert.ok(calls <= 2, `expected at most 2 calls, got ${calls}`);
});
