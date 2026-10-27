import { Document } from '@langchain/core/documents';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';
import type { PolicyChunk } from './policyChunks';

export interface ScoredChunk {
  chunk: PolicyChunk;
  score: number;
}

export interface PolicyRetrieverInput extends BaseRetrieverInput {
  chunks: PolicyChunk[];
  /** How many sections to return. */
  k?: number;
}

/**
 * BM25 keyword search over the policy sections, as a LangChain retriever.
 * In production this would be embeddings + pgvector; for a 5-section policy,
 * BM25 is exact, fast, free and fully testable.
 */
export class PolicyRetriever extends BaseRetriever {
  lc_namespace = ['approvals', 'retrievers', 'policy'];

  constructor(fields: PolicyRetrieverInput) {
    super(fields);
  }

  /** Every section with a score above 0, best first. */
  score(_query: string): ScoredChunk[] {
    throw new Error('Not implemented');
  }

  override async _getRelevantDocuments(_query: string): Promise<Document[]> {
    throw new Error('Not implemented');
  }
}
