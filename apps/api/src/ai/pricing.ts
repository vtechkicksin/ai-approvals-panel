/** US dollars per million tokens (Anthropic first-party rates, prompts up to 100K tokens). */
export const PRICING: Readonly<Record<string, { input: number; output: number }>> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

export function costUsd(_model: string, _inputTokens: number, _outputTokens: number): number | null {
  throw new Error('Not implemented');
}
