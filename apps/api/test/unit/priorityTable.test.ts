import { parsePriorityTable, PolicyFormatError } from '../../src/policy/priorityTable';

const policy = (table: string) => `# Policy

Some intro text.

## 2. Priority by category

${table}

## 3. Next section

| Not | The table |
| --- | --------- |
| x   | y         |
`;

const validTable = `| Category | Default priority | Why |
| -------- | ---------------- | --- |
| safety   | high             | Protects people on site. |
| Mapping  |  LOW             | Can wait. |`;

describe('parsePriorityTable', () => {
  it('reads category → priority and reason from the "Priority by category" table', () => {
    const table = parsePriorityTable(policy(validTable));

    expect(table.get('safety')).toEqual({ priority: 'high', reason: 'Protects people on site.' });
    expect(table.size).toBe(2);
  });

  it('ignores case and extra spaces in category and priority', () => {
    const table = parsePriorityTable(policy(validTable));

    expect(table.get('mapping')).toEqual({ priority: 'low', reason: 'Can wait.' });
  });

  it('only reads the table under the priority heading, not other tables', () => {
    const table = parsePriorityTable(policy(validTable));

    expect(table.has('x')).toBe(false);
  });

  it('rejects a priority that is not a known level', () => {
    const bad = validTable.replace('high', 'critical');

    expect(() => parsePriorityTable(policy(bad))).toThrow(PolicyFormatError);
    expect(() => parsePriorityTable(policy(bad))).toThrow(/critical/);
  });

  it('rejects a doc with no priority section', () => {
    expect(() => parsePriorityTable('# Policy\n\nNo table here.')).toThrow(PolicyFormatError);
  });

  it('rejects a priority section with no table rows', () => {
    expect(() => parsePriorityTable(policy('Nothing yet.'))).toThrow(PolicyFormatError);
  });

  it('rejects the same category listed twice', () => {
    const dup = `${validTable}\n| safety | low | Again. |`;

    expect(() => parsePriorityTable(policy(dup))).toThrow(/safety/);
  });

  it('rejects a row with a missing reason', () => {
    const missing = `| Category | Default priority | Why |
| -------- | ---------------- | --- |
| safety   | high             |     |`;

    expect(() => parsePriorityTable(policy(missing))).toThrow(PolicyFormatError);
  });
});
