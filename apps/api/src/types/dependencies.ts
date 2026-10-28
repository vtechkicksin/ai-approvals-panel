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

export interface AppDeps {
  getApprovals: () => ApprovalItem[];
  priorityTable: PriorityTable;
  webOrigin: string;
  ai: AiDeps;
  policyChunks: PolicyChunk[];
}
