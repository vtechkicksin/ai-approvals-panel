import { GenerativeModel } from '@google/generative-ai';

let applied = false;

/**
 * The Google SDK's generateContentStream() returns { stream, response }, where
 * `response` is a second promise that aggregates the whole reply. LangChain
 * only reads `stream`. When we cancel a call (timeout, silence, user closed
 * the panel), `response` rejects with nobody listening: an unhandled promise
 * rejection, which crashes Node by default. Marking it handled fixes that;
 * errors still reach us through `stream`.
 */
export function applyGeminiSdkPatch(): void {
  if (applied) return;
  applied = true;

  const original = GenerativeModel.prototype.generateContentStream;
  GenerativeModel.prototype.generateContentStream = async function (this: GenerativeModel, ...args) {
    const result = await original.apply(this, args);
    result.response.catch(() => {});
    return result;
  };
}
