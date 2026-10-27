/** One section of the policy doc: the unit we search and cite. */
export interface PolicyChunk {
  id: string;
  /** The section heading as written, e.g. "4. When to reject". */
  heading: string;
  text: string;
}

const SECTION = /^##(?!#)\s+(.+?)\s*$/;
const NUMBERED = /^(\d+)[.)]\s/;
/** Lines that start their own block: list items and table rows. */
const BLOCK_START = /^\s*(\d+[.)]|[-*+]|\|)/;

/** Joins lines that were only wrapped for width; keeps paragraphs, list items and table rows apart. */
function unwrap(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .reduce<string[]>((lines, line) => {
          if (lines.length > 0 && !BLOCK_START.test(line)) lines[lines.length - 1] += ` ${line.trim()}`;
          else lines.push(line.trimEnd());
          return lines;
        }, [])
        .join('\n'),
    )
    .join('\n\n');
}

/**
 * Splits the policy markdown into its "## " sections. Text before the first
 * section (title, notes) is skipped. A section's id comes from its number
 * ("4. When to reject" → policy-4), or its position if it has none.
 */
export function splitPolicy(markdown: string): PolicyChunk[] {
  const sections: { heading: string; lines: string[] }[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = SECTION.exec(line);
    if (heading) sections.push({ heading: heading[1]!, lines: [] });
    else sections.at(-1)?.lines.push(line);
  }

  return sections.flatMap(({ heading, lines }, index) => {
    const text = unwrap(lines.join('\n').trim());
    if (!text) return [];
    const number = NUMBERED.exec(heading)?.[1] ?? String(index + 1);
    return [{ id: `policy-${number}`, heading, text }];
  });
}
