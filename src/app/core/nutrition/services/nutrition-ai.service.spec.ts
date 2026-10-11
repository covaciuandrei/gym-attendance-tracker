import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';
import { AiError, NutritionAiService, mapFailure } from './nutrition-ai.service';

describe('mapFailure', () => {
  it('maps authentication problems', () => {
    expect(mapFailure(401, 'unauthorized')).toBe('unauthorized');
    expect(mapFailure(403, 'email_not_verified')).toBe('forbidden');
    expect(mapFailure(403, 'not_allowed')).toBe('forbidden');
  });

  it('distinguishes the kinds of 429', () => {
    expect(mapFailure(429, 'too_many_attempts')).toBe('too_many_attempts');
    expect(mapFailure(429, 'rate_limited')).toBe('rate_limited');
    expect(mapFailure(429, 'ai_busy')).toBe('busy');
    expect(mapFailure(429, undefined)).toBe('busy');
  });

  it('maps server and input problems', () => {
    expect(mapFailure(503, 'not_configured')).toBe('not_configured');
    expect(mapFailure(503, 'auth_unavailable')).toBe('unavailable');
    expect(mapFailure(503, 'access_unavailable')).toBe('unavailable');
    expect(mapFailure(413, 'image_too_large')).toBe('too_large');
    expect(mapFailure(422, 'ai_blocked')).toBe('blocked');
    expect(mapFailure(422, 'ai_rejected_input')).toBe('rejected');
    expect(mapFailure(400, 'empty_input')).toBe('invalid_input');
    expect(mapFailure(502, 'ai_unavailable')).toBe('unavailable');
    expect(mapFailure(404, undefined)).toBe('unavailable');
  });

  it('treats a failing or missing server as unavailable, not as an unknown problem', () => {
    // The dev server proxy answers 500 with no body while the local API is not running.
    expect(mapFailure(500, undefined)).toBe('unavailable');
    expect(mapFailure(504, undefined)).toBe('unavailable');
    // A gateway error page is not our API saying it is unconfigured.
    expect(mapFailure(503, undefined)).toBe('unavailable');
  });

  it('keeps "unknown" for answers it does not recognise', () => {
    expect(mapFailure(302, undefined)).toBe('unknown');
    expect(mapFailure(418, undefined)).toBe('unknown');
  });
});

describe('NutritionAiService.analyze', () => {
  let service: NutritionAiService;
  let fetchSpy: jasmine.Spy;
  let getIdToken: jasmine.Spy;
  const input = { note: 'iaurt 200g', lang: 'en' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const failure = async () => (await service.analyze(input).catch((error: unknown) => error)) as AiError;

  beforeEach(() => {
    getIdToken = jasmine.createSpy('getIdToken').and.resolveTo('the-token');
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { getFirebaseAuth: () => ({ currentUser: { getIdToken } }) } }],
    });
    service = TestBed.inject(NutritionAiService);
    fetchSpy = spyOn(window, 'fetch');
    spyOn(console, 'warn');
  });

  it('sends the note with the signed-in user token and returns the estimate', async () => {
    fetchSpy.and.resolveTo(reply(200, { isFood: true, name: 'Yogurt', items: [{ name: 'Yogurt' }], confidence: 'high', comment: '' }));

    const result = await service.analyze(input);

    expect(result.items.length).toBe(1);
    const [url, init] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe('/api/analyze');
    expect(init.headers['x-firebase-token']).toBe('the-token');
    expect(JSON.parse(init.body)).toEqual({ note: 'iaurt 200g', lang: 'en' });
  });

  it('tries once more with a fresh token when the first one is refused', async () => {
    fetchSpy.and.returnValues(Promise.resolve(reply(401, { error: 'unauthorized' })), Promise.resolve(reply(200, { items: [] })));

    await service.analyze(input);

    expect(getIdToken.calls.allArgs()).toEqual([[false], [true]]);
  });

  it('reports a missing API (the dev proxy answers 500 with no body) as unavailable, and says why in the console', async () => {
    fetchSpy.and.resolveTo(new Response('', { status: 500 }));

    const error = await failure();

    expect(error).toEqual(jasmine.any(AiError));
    expect(error.code).toBe('unavailable');
    expect(error.detail).toBe('HTTP 500');
    expect(console.warn).toHaveBeenCalled();
  });

  it('keeps the error code the API sent, without the console hint', async () => {
    fetchSpy.and.resolveTo(reply(403, { error: 'not_allowed' }));

    const error = await failure();

    expect(error.code).toBe('forbidden');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('reports a network failure with its reason', async () => {
    fetchSpy.and.rejectWith(new TypeError('Load failed'));

    const error = await failure();

    expect(error.code).toBe('network');
    expect(error.detail).toBe('Load failed');
  });

  it('does not trust an answer that is not an estimate', async () => {
    fetchSpy.and.resolveTo(reply(200, { surprise: true }));

    const error = await failure();

    expect(error.code).toBe('unknown');
    expect(error.detail).toBe('unexpected answer');
  });
});
