import { AccessEntry } from '../../../core/nutrition/services/nutrition-access.service';
import { sortEntries } from './access-admin.service';

const entry = (uid: string, email: string): AccessEntry => ({ uid, email, displayName: '', enabled: false });

describe('sortEntries', () => {
  it('puts the admin first and everybody else by email, ignoring case', () => {
    const sorted = sortEntries([entry('c', 'Carol@x.com'), entry('me', 'zed@x.com'), entry('a', 'alice@x.com'), entry('b', 'bob@x.com')], 'me');
    expect(sorted.map((e) => e.uid)).toEqual(['me', 'a', 'b', 'c']);
  });

  it('does not change the list it was given', () => {
    const list = [entry('b', 'b@x.com'), entry('a', 'a@x.com')];
    sortEntries(list, null);
    expect(list.map((e) => e.uid)).toEqual(['b', 'a']);
  });

  it('copes with the admin having no entry', () => {
    expect(sortEntries([entry('b', 'b@x.com'), entry('a', 'a@x.com')], 'missing').map((e) => e.uid)).toEqual(['a', 'b']);
  });
});
