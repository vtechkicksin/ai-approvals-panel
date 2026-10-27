/** US dollars per million tokens (Anthropic first-party rates, prompts up to 100K tokens). */
export const PRICING: Readonly<Record<string, { input: number; output: number }>> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

/** Cost of one call, or null for a model we have no price for (never a guess). */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = PRICING[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
