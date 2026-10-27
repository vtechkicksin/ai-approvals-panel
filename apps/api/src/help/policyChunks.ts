/** One section of the policy doc: the unit we search and cite. */
export interface PolicyChunk {
  id: string;
  /** The section heading as written, e.g. "4. When to reject". */
  heading: string;
  text: string;
}

/** Splits the policy markdown into its "## " sections. */
export function splitPolicy(_markdown: string): PolicyChunk[] {
  return []; // Not implemented yet (returns empty so app start-up still works).
}
