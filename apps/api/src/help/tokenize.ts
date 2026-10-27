/** Common English words that carry no meaning for search. */
const STOPWORDS = new Set(
  (
    'a an the and or but if then else of to in on at by for with from as into onto over under about ' +
    'is are was were be been being am do does did doing done have has had having ' +
    'i me my mine we us our you your he him his she her it its they them their ' +
    'this that these those there here what which who whom whose when where why how ' +
    'can cannot could should would will shall may might must need not no yes so than too very just ' +
    'all any some such only own same other more most each both few up down out off also again ' +
    'tell please get got let make like want know one'
  ).split(' '),
);

/** Trims simple English suffixes so word forms match ("rejecting" → "reject"). */
function stem(word: string): string {
  if (!/^[a-z]+$/.test(word)) return word;
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Turns text into search terms: lower case, letters and digits only, common
 * words removed, simple suffixes trimmed ("rejecting" → "reject").
 * The same function is used for the policy and the question.
 */
export function tokenize(text: string): string[] {
  // \p{M} keeps combining marks, which Devanagari words need.
  const words = text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return words.filter((w) => !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w))).map(stem);
}
