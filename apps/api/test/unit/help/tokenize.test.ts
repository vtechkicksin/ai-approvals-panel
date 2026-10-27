import { tokenize } from '../../../src/help/tokenize';

describe('tokenize', () => {
  it('lower-cases and drops punctuation', () => {
    expect(tokenize('Reject the FILE?!')).toEqual(['reject', 'file']);
  });

  it('removes common words that carry no meaning for search', () => {
    expect(tokenize('What is the policy for this?')).toEqual(['policy']);
    expect(tokenize('What is it?')).toEqual([]);
  });

  it('trims simple suffixes so word forms match', () => {
    expect(tokenize('rejecting rejected rejects reject')).toEqual(['reject', 'reject', 'reject', 'reject']);
    expect(tokenize('approvals checklists videos')).toEqual(['approval', 'checklist', 'video']);
  });

  it('keeps numbers and non-English letters', () => {
    expect(tokenize('360° camera')).toEqual(['360', 'camera']);
    expect(tokenize('अस्वीकार करें')).toEqual(['अस्वीकार', 'करें']);
  });
});
