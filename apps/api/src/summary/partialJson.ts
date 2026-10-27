/**
 * Parses JSON that may be cut off mid-way (a streaming reply), returning the
 * best complete view of it so far, or undefined if nothing can be read yet.
 */
export function parsePartialJson(_text: string): unknown {
  throw new Error('Not implemented');
}
