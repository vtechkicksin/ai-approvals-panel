import { priorityLevelSchema, type PriorityLevel } from '@approvals/schemas';

export interface PriorityRule {
  priority: PriorityLevel;
  reason: string;
}

/** Category (lower-case) → default priority, read from the policy doc. */
export type PriorityTable = ReadonlyMap<string, PriorityRule>;

export class PolicyFormatError extends Error {
  override name = 'PolicyFormatError';
}

const SECTION_HEADING = /^#{1,6}\s+.*priority by category/i;
const ANY_HEADING = /^#{1,6}\s/;
const SEPARATOR_ROW = /^\|?\s*:?-{3,}/;

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Reads the markdown table under the "Priority by category" heading.
 * Columns are found by header name (Category / Priority / Why or Reason),
 * so their order in the doc does not matter.
 */
export function parsePriorityTable(markdown: string): PriorityTable {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => SECTION_HEADING.test(line));
  if (start === -1) throw new PolicyFormatError('Policy has no "Priority by category" section');

  const sectionEnd = lines.findIndex((line, i) => i > start && ANY_HEADING.test(line));
  const tableRows = lines
    .slice(start + 1, sectionEnd === -1 ? undefined : sectionEnd)
    .filter((line) => line.trim().startsWith('|'));

  const [header, ...rest] = tableRows;
  const dataRows = rest.filter((row) => !SEPARATOR_ROW.test(row.trim()));
  if (!header || dataRows.length === 0) {
    throw new PolicyFormatError('The "Priority by category" section has no table rows');
  }

  const headings = cells(header).map((h) => h.toLowerCase());
  const col = {
    category: headings.findIndex((h) => h.includes('category')),
    priority: headings.findIndex((h) => h.includes('priority')),
    reason: headings.findIndex((h) => h.includes('why') || h.includes('reason')),
  };
  if (Object.values(col).some((i) => i === -1)) {
    throw new PolicyFormatError('Priority table needs Category, Priority and Why columns');
  }

  const table = new Map<string, PriorityRule>();
  for (const row of dataRows) {
    const values = cells(row);
    const category = (values[col.category] ?? '').toLowerCase();
    const rawPriority = (values[col.priority] ?? '').toLowerCase();
    const reason = values[col.reason] ?? '';

    if (!category || !reason) {
      throw new PolicyFormatError(`Priority table row is missing a category or reason: ${row.trim()}`);
    }
    const priority = priorityLevelSchema.safeParse(rawPriority);
    if (!priority.success) {
      throw new PolicyFormatError(
        `Unknown priority "${rawPriority}" for category "${category}". Use one of: ${priorityLevelSchema.options.join(', ')}`,
      );
    }
    if (table.has(category)) {
      throw new PolicyFormatError(`Category "${category}" is listed twice in the priority table`);
    }
    table.set(category, { priority: priority.data, reason });
  }
  return table;
}
