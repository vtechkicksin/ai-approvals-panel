import { createConsoleCostLogger, createMemoryCostLogger, type AiCallRecord } from '../../../src/ai/costLog';

const record: AiCallRecord = {
  feature: 'greeting',
  model: 'claude-haiku-5-5',
  outcome: 'complete',
  attempts: 1,
  inputTokens: 120,
  outputTokens: 30,
  costUsd: 0.000027,
  latencyMs: 640,
  firstTokenMs: 410,
};

describe('cost logging', () => {
  it('writes one JSON line per AI call to stdout', () => {
    const write = jest.spyOn(console, 'log').mockImplementation(() => {});

    createConsoleCostLogger().log(record);

    expect(write).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(write.mock.calls[0]![0])) as Record<string, unknown>;
    expect(line).toMatchObject({ event: 'ai_call', ...record });
    write.mockRestore();
  });

  it('keeps records in memory for tests', () => {
    const logger = createMemoryCostLogger();

    logger.log(record);

    expect(logger.records).toEqual([record]);
  });
});
