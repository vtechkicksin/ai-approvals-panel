import { loadApprovals, loadPolicyMarkdown } from '../data/seedData';
import { createChatModel } from '../ai/chatModel';
import { loadAiConfig } from '../ai/config';
import { createConsoleCostLogger } from '../ai/costLog';
import { splitPolicy } from '../policy/policyChunks';
import { parsePriorityTable } from '../policy/priorityTable';
import type { AppDeps } from '../types/dependencies';

/** Loads and prepares the application data and services once during startup. */
export function defaultDeps(): AppDeps {
  const approvals = loadApprovals();
  const policyMarkdown = loadPolicyMarkdown();
  const config = loadAiConfig();
  const apiKey = process.env.GOOGLE_API_KEY?.trim() || undefined;

  return {
    getApprovals: () => approvals,
    priorityTable: parsePriorityTable(policyMarkdown),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    ai: {
      config,
      logger: createConsoleCostLogger(),
      createModel: () => createChatModel({ apiKey, config }),
    },
    policyChunks: splitPolicy(policyMarkdown),
  };
}
