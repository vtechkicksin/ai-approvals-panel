import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@approvals/schemas';

function errorBody(code: string, message: string): ApiError {
  return { error: { code, message } };
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json(errorBody('not_found', 'This endpoint does not exist.'));
};

function isJsonParseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';
}

/**
 * Last line of defence: every error becomes the same JSON shape, and the
 * real details stay in the server log, never in the response.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (isJsonParseError(err)) {
    res.status(400).json(errorBody('invalid_json', 'The request body is not valid JSON.'));
    return;
  }

  console.error(err);
  res.status(500).json(errorBody('internal_error', 'Something went wrong. Please try again.'));
};
