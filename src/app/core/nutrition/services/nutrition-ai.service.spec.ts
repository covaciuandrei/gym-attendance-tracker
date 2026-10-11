import { mapFailure } from './nutrition-ai.service';

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
    expect(mapFailure(500, undefined)).toBe('unknown');
  });
});
