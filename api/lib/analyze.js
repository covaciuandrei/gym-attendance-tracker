'use strict';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'];

const LIMITS = {
  maxImageBase64: 3_500_000,
  maxNote: 600,
  maxItems: 12,
  attemptTimeoutMs: 20_000,
  // SWA managed functions time out at ~45 s, so stop trying new models before that.
  totalBudgetMs: 38_000,
};

const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LANGUAGE_NAMES = { en: 'English', ro: 'Romanian' };

const nutrient = { type: 'NUMBER' };

// `comment` comes before `items` on purpose: the model writes its portion assumptions first, then the numbers.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  propertyOrdering: ['is_food', 'meal_name', 'comment', 'items', 'confidence'],
  properties: {
    is_food: { type: 'BOOLEAN' },
    meal_name: { type: 'STRING' },
    comment: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        propertyOrdering: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g'],
        properties: {
          name: { type: 'STRING' },
          grams: nutrient,
          kcal: nutrient,
          protein_g: nutrient,
          carbs_g: nutrient,
          fat_g: nutrient,
          fiber_g: nutrient,
          sugar_g: nutrient,
        },
        required: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g'],
      },
    },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
  },
  required: ['is_food', 'meal_name', 'comment', 'items', 'confidence'],
};

function buildSystemPrompt(languageName) {
  return `You are a precise nutrition analyst for a personal food diary app. You receive a photo of a meal and/or a short text note from the user and must estimate its nutrition.

Rules:
- Identify every distinct food and drink item (1-8 items). Split composite dishes into their main components only when it improves accuracy.
- Estimate the edible portion of each item in grams (millilitres for drinks, 1 ml = 1 g). Use visual cues: plate or bowl size (a standard dinner plate is about 26 cm), cutlery, packaging, hands, food depth.
- The user's note is the source of truth. If it states quantities, brands, cooking methods or what was eaten (for example "only half", "200 g", "with 2 tbsp oil"), apply it over what you infer from the photo. If there is no photo, rely entirely on the note.
- Account for hidden calories: cooking oil, butter, sauces, dressings, sugar in drinks, cheese, breading.
- If a nutrition label or a recognisable packaged product is visible, use its values scaled to the portion.
- For each item give kcal, protein_g, carbs_g, fat_g, fiber_g and sugar_g for that portion (not per 100 g). Calories must be consistent with the macros (kcal is about 4*protein + 4*carbs + 9*fat, plus 7 per gram of alcohol).
- Typical Romanian and Eastern European dishes are expected (sarmale, mamaliga, mici, ciorba, papanasi, cozonac, etc.).
- Always give your best estimate and never ask questions. Use confidence "low" only when the portion or ingredients are really unclear.
- If the input contains no food or drink at all, return is_food=false and an empty items array.
- Write item names, the meal name and the comment in ${languageName}. The comment is one short sentence with your key portion assumptions.
Return only JSON that matches the schema.`;
}

function fail(error, message, status = 400) {
  return { ok: false, status, error, message };
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('invalid_body', 'Request body must be a JSON object.');
  }

  const lang = Object.hasOwn(LANGUAGE_NAMES, body.lang) ? body.lang : 'en';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > LIMITS.maxNote) {
    return fail('note_too_long', `The note can have at most ${LIMITS.maxNote} characters.`);
  }

  let image = null;
  let mimeType = 'image/jpeg';
  if (body.image !== undefined && body.image !== null && body.image !== '') {
    if (typeof body.image !== 'string') return fail('invalid_image', 'The image must be a base64 string.');
    let data = body.image;
    const dataUrl = /^data:([\w/+.-]+);base64,/.exec(data);
    if (dataUrl) {
      mimeType = dataUrl[1];
      data = data.slice(dataUrl[0].length);
    } else if (typeof body.mimeType === 'string') {
      mimeType = body.mimeType;
    }
    if (!MIME_TYPES.has(mimeType)) return fail('unsupported_image_type', 'Use a JPEG, PNG or WebP image.');
    if (data.length > LIMITS.maxImageBase64) return fail('image_too_large', 'The image is too large.', 413);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return fail('invalid_image', 'The image is not valid base64.');
    image = data;
  }

  if (!image && !note) return fail('empty_input', 'Send a photo, a note, or both.');
  return { ok: true, value: { image, mimeType, note, lang } };
}

function buildRequestBody({ image, mimeType, note, lang }, { thinking = true } = {}) {
  const parts = [];
  if (image) parts.push({ inlineData: { mimeType, data: image } });
  parts.push({
    text: note
      ? `User note (source of truth about what was eaten): "${note.replace(/"/g, "'")}"`
      : 'No note from the user. Analyse the photo.',
  });

  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
  };
  if (thinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' };

  return {
    systemInstruction: { parts: [{ text: buildSystemPrompt(LANGUAGE_NAMES[lang]) }] },
    contents: [{ role: 'user', parts }],
    generationConfig,
  };
}

function parseModels(value) {
  const models = String(value || '')
    .split(',')
    .map((m) => m.trim())
    .filter((m) => /^[\w.-]+$/.test(m));
  return models.length ? models : DEFAULT_MODELS;
}

const toNumber = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round1 = (n) => Math.round(n * 10) / 10;

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) return null;

  const protein = round1(clamp(toNumber(raw.protein_g), 0, 500));
  const carbs = round1(clamp(toNumber(raw.carbs_g), 0, 800));
  const fat = round1(clamp(toNumber(raw.fat_g), 0, 500));
  const fiber = round1(clamp(toNumber(raw.fiber_g), 0, 200));
  const sugar = round1(clamp(toNumber(raw.sugar_g), 0, 800));
  let kcal = Math.round(clamp(toNumber(raw.kcal), 0, 5000));
  if (kcal === 0 && (protein || carbs || fat)) kcal = Math.round(4 * protein + 4 * carbs + 9 * fat);

  return { name, grams: Math.round(clamp(toNumber(raw.grams), 0, 5000)), kcal, protein, carbs, fat, fiber, sugar };
}

function sumTotals(items) {
  const total = items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
      fiber: acc.fiber + i.fiber,
      sugar: acc.sugar + i.sugar,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
  );
  return {
    kcal: Math.round(total.kcal),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
    fiber: round1(total.fiber),
    sugar: round1(total.sugar),
  };
}

function normalizeResult(raw) {
  const rawItems = Array.isArray(raw?.items) ? raw.items : [];
  const items = rawItems.slice(0, LIMITS.maxItems).map(normalizeItem).filter(Boolean);
  const isFood = raw?.is_food !== false && items.length > 0;
  const confidence = ['low', 'medium', 'high'].includes(raw?.confidence) ? raw.confidence : 'medium';
  const comment = String(raw?.comment ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const name = String(raw?.meal_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || items[0]?.name || '';

  if (!isFood) {
    return { isFood: false, name: '', items: [], totals: sumTotals([]), confidence, comment };
  }
  return { isFood: true, name, items, totals: sumTotals(items), confidence, comment };
}

function extractText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => typeof p?.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
}

function parseModelJson(text) {
  if (!text) return null;
  const candidates = [text, text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')];
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object') return value;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function callModel(model, payload, apiKey, fetchImpl, timeoutMs) {
  const res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function failure(sawRateLimit, lastStatus) {
  if (sawRateLimit) return { status: 429, body: { error: 'ai_busy' } };
  if (lastStatus === 400) return { status: 422, body: { error: 'ai_rejected_input' } };
  return { status: 502, body: { error: 'ai_unavailable' } };
}

/**
 * Tries each model in order. Moves to the next one on rate limits, outages, timeouts or malformed output.
 * Upstream error messages are never returned to the client.
 */
async function analyze(input, env, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const now = deps.now || Date.now;
  const log = deps.log || (() => {});
  const apiKey = env.GEMINI_API_KEY;
  const startedAt = now();

  let sawRateLimit = false;
  let lastStatus = 0;

  for (const model of parseModels(env.GEMINI_MODELS)) {
    for (const thinking of [true, false]) {
      const remaining = LIMITS.totalBudgetMs - (now() - startedAt);
      if (remaining < 2500) return failure(sawRateLimit, lastStatus);

      let attempt;
      try {
        attempt = await callModel(model, buildRequestBody(input, { thinking }), apiKey, fetchImpl, Math.min(remaining, LIMITS.attemptTimeoutMs));
      } catch (err) {
        log(`analyze: ${model} request failed (${err?.name || 'error'})`);
        lastStatus = 0;
        break;
      }

      const { status, json } = attempt;
      lastStatus = status;

      if (status === 200) {
        if (json?.promptFeedback?.blockReason) return { status: 422, body: { error: 'ai_blocked' } };
        const parsed = parseModelJson(extractText(json));
        if (parsed) {
          log(`analyze: ${model} ok in ${now() - startedAt} ms`);
          return { status: 200, body: { ...normalizeResult(parsed), model } };
        }
        log(`analyze: ${model} returned unusable output`);
        break;
      }

      const upstreamMessage = String(json?.error?.message || '');
      if (status === 400 && thinking && /thinking/i.test(upstreamMessage)) continue;

      if (status === 429) sawRateLimit = true;
      log(`analyze: ${model} -> HTTP ${status}`);
      break;
    }
  }

  return failure(sawRateLimit, lastStatus);
}

module.exports = {
  DEFAULT_MODELS,
  LIMITS,
  RESPONSE_SCHEMA,
  validateRequest,
  buildRequestBody,
  buildSystemPrompt,
  normalizeResult,
  parseModels,
  analyze,
};
