import type { Request, Response } from 'express';
import type { Language } from '@approvals/schemas';
import type { GuardedEvent } from './guardedStream';

export interface TextAnswerOptions {
  req: Request;
  res: Response;
  language: Language;
  /** Runs the guarded AI stream; `signal` is aborted if the client disconnects. */
  run: (signal: AbortSignal) => AsyncIterable<GuardedEvent>;
  /** The backup answer when the AI fails before saying anything. */
  fallback: () => string | Promise<string>;
}

/** Streams an AI text answer as SSE, with friendly notices and a backup answer. Never sends a 500. */
export async function streamTextAnswer(_options: TextAnswerOptions): Promise<void> {
  throw new Error('Not implemented');
}
