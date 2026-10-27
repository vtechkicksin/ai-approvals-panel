/** US dollars per million tokens. */
export interface PricePerMTok {
  input: number;
  output: number;
}

/** Cost of one call at the configured price (0 on the free tier). */
export function costUsd(price: PricePerMTok, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
