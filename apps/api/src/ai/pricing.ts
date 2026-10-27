/** US dollars per million tokens. */
export interface PricePerMTok {
  input: number;
  output: number;
}

export function costUsd(_price: PricePerMTok, _inputTokens: number, _outputTokens: number): number {
  throw new Error('Not implemented');
}
