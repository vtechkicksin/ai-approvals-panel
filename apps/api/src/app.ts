import cors from 'cors';
import express, { type Express } from 'express';
import type { ApprovalItem } from '@approvals/schemas';
import { loadApprovals, loadPolicyMarkdown, loadPriorityTable } from './data/seedData';
import { errorHandler, notFound } from './middleware/errors';
import { aiRateLimit } from './middleware/rateLimit';
import { sessionCookie } from './middleware/session';
import type { PriorityTable } from './policy/priorityTable';
import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createChatModel } from './ai/chatModel';
import { loadAiConfig, type AiConfig } from './ai/config';
import { createConsoleCostLogger, type CostLogger } from './ai/costLog';
import { splitPolicy, type PolicyChunk } from './help/policyChunks';
import { apiRouter } from './router';

export interface AiDeps {
  config: AiConfig;
  logger: CostLogger;
  createModel: () => ChatGoogleGenerativeAI;
}

export interface AppDeps {
  getApprovals: () => ApprovalItem[];
  priorityTable: PriorityTable;
  webOrigin: string;
  ai: AiDeps;
  policyChunks: PolicyChunk[];
}

export function defaultDeps(): AppDeps {
  const approvals = loadApprovals();
  return {
    getApprovals: () => approvals,
    priorityTable: loadPriorityTable(),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    ai: defaultAiDeps(),
    policyChunks: splitPolicy(loadPolicyMarkdown()),
  };
}

function defaultAiDeps(): AiDeps {
  const config = loadAiConfig();
  const apiKey = process.env.GOOGLE_API_KEY?.trim() || undefined;
  return { config, logger: createConsoleCostLogger(), createModel: () => createChatModel({ apiKey, config }) };
}

export function createApp(deps: AppDeps = defaultDeps()): Express {
  const app = express();
  app.use(cors({ origin: [deps.webOrigin], credentials: true }));
  app.use(express.json());

  app.use('/api/ai', sessionCookie, ...aiRateLimit(deps.ai.config));
  app.use(apiRouter(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
