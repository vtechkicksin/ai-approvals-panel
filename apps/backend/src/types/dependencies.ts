import type { ApprovalItem } from '@approvals/schemas';
import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { AiConfig } from '../ai/config';
import type { CostLogger } from '../ai/costLog';
import type { PolicyChunk } from '../policy/policyChunks';
import type { PriorityTable } from '../policy/priorityTable';

export interface AiDeps {
  config: AiConfig;
  logger: CostLogger;
  createModel: () => ChatGoogleGenerativeAI;
}

/** Shared read-only access required by queue-based features. */
export interface ApprovalQueueDependencies {
  getApprovals: () => ApprovalItem[];
  priorityTable: PriorityTable;
}

/** All configured services for assembling the Express application. */
export interface AppDeps extends ApprovalQueueDependencies {
  webOrigin: string;
  ai: AiDeps;
  policyChunks: PolicyChunk[];
}
