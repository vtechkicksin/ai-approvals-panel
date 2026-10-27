import cors from 'cors';
import express, { type Express } from 'express';
import { healthResponseSchema, type ApprovalItem, type HealthResponse } from '@approvals/schemas';
import { approvalsRouter } from './approvals/approvalsRouter';
import { loadApprovals, loadPriorityTable } from './data/seedData';
import { errorHandler, notFound } from './middleware/errors';
import type { PriorityTable } from './policy/priorityTable';
import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createChatModel } from './ai/chatModel';
import { loadAiConfig, type AiConfig } from './ai/config';
import { createConsoleCostLogger, type CostLogger } from './ai/costLog';
import { summaryRouter } from './summary/summaryRouter';

export interface AiDeps {
  config: AiConfig;
  logger: CostLogger;
  /** Builds the model for one call. Throws AiNotConfiguredError when no key is set. */
  createModel: () => ChatGoogleGenerativeAI;
}

export interface AppDeps {
  getApprovals: () => ApprovalItem[];
  priorityTable: PriorityTable;
  /** The web app's origin, allowed to call the API from the browser. */
  webOrigin: string;
  ai: AiDeps;
}

/** Loads the seed data once; invalid data or policy fails here, at startup. */
export function defaultDeps(): AppDeps {
  const approvals = loadApprovals();
  return {
    getApprovals: () => approvals,
    priorityTable: loadPriorityTable(),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    ai: defaultAiDeps(),
  };
}

function defaultAiDeps(): AiDeps {
  const config = loadAiConfig();
  const apiKey = process.env.GOOGLE_API_KEY?.trim() || undefined;
  return { config, logger: createConsoleCostLogger(), createModel: () => createChatModel({ apiKey, config }) };
}

export function createApp(deps: AppDeps = defaultDeps()): Express {
  const app = express();
  // The browser app calls the API directly; only its origin may, with cookies.
  app.use(cors({ origin: [deps.webOrigin], credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({ status: 'ok' });
    res.json(body);
  });
  app.use('/api/approvals', approvalsRouter(deps));
  app.use('/api/ai/summary', summaryRouter(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
