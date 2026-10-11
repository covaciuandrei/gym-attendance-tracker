import { parseAccessEntry } from './nutrition-access.service';

describe('parseAccessEntry', () => {
  it('reads a complete entry', () => {
    expect(parseAccessEntry('u1', { email: 'a@b.c', displayName: 'Ann', enabled: true })).toEqual({
      uid: 'u1',
      email: 'a@b.c',
      displayName: 'Ann',
      enabled: true,
    });
  });

  it('only an explicit true switches an account on', () => {
    for (const enabled of [false, undefined, null, 'true', 1, 'yes', {}, []]) {
      expect(parseAccessEntry('u1', { email: 'a@b.c', enabled })?.enabled).withContext(JSON.stringify(enabled)).toBeFalse();
    }
  });

  it('falls back to an empty name when there is none', () => {
    expect(parseAccessEntry('u1', { email: 'a@b.c', enabled: false })?.displayName).toBe('');
    expect(parseAccessEntry('u1', { email: 'a@b.c', displayName: 42 })?.displayName).toBe('');
  });

  it('ignores entries without an email, so they never show up in the list', () => {
    expect(parseAccessEntry('u1', undefined)).toBeNull();
    expect(parseAccessEntry('u1', {})).toBeNull();
    expect(parseAccessEntry('u1', { email: 5, enabled: true })).toBeNull();
  });
});
