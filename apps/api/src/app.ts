import cors from 'cors';
import express, { type Express } from 'express';
import { healthResponseSchema, type ApprovalItem, type HealthResponse } from '@approvals/schemas';
import { approvalsRouter } from './approvals/approvalsRouter';
import { loadApprovals, loadPolicyMarkdown, loadPriorityTable } from './data/seedData';
import { errorHandler, notFound } from './middleware/errors';
import { aiRateLimit } from './middleware/rateLimit';
import { sessionCookie } from './middleware/session';
import type { PriorityTable } from './policy/priorityTable';
import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createChatModel } from './ai/chatModel';
import { loadAiConfig, type AiConfig } from './ai/config';
import { createConsoleCostLogger, type CostLogger } from './ai/costLog';
import { summaryRouter } from './summary/summaryRouter';
import { talkRouter } from './talk/talkRouter';
import { helpRouter } from './help/helpRouter';
import { splitPolicy, type PolicyChunk } from './help/policyChunks';
import { teachGuideRouter, teachRouter } from './teach/teachRouter';
import { greetingRouter } from './greeting/greetingRouter';

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

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({ status: 'ok' });
    res.json(body);
  });
  app.use('/api/approvals', approvalsRouter(deps));
  app.use('/api/ai', sessionCookie, ...aiRateLimit(deps.ai.config));
  app.use('/api/ai/summary', summaryRouter(deps));
  app.use('/api/ai/talk', talkRouter(deps));
  app.use('/api/ai/help', helpRouter(deps));
  app.use('/api/teach/guide', teachGuideRouter(deps));
  app.use('/api/ai/teach', teachRouter(deps));
  app.use('/api/ai/greeting', greetingRouter(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
