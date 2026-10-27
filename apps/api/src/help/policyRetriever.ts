import { Document } from '@langchain/core/documents';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';
import type { PolicyChunk } from './policyChunks';
import { tokenize } from './tokenize';

export interface ScoredChunk {
  chunk: PolicyChunk;
  score: number;
}

export interface PolicyRetrieverInput extends BaseRetrieverInput {
  chunks: PolicyChunk[];
  /** How many sections to return. */
  k?: number;
}

// Standard BM25 settings: k1 controls how fast repeated words stop adding score,
// b how much long sections are penalised.
const K1 = 1.5;
const B = 0.75;

/**
 * BM25 keyword search over the policy sections, as a LangChain retriever.
 * In production this would be embeddings + pgvector; for a 5-section policy,
 * BM25 is exact, fast, free and fully testable.
 */
export class PolicyRetriever extends BaseRetriever {
  lc_namespace = ['approvals', 'retrievers', 'policy'];

  private readonly chunks: PolicyChunk[];
  private readonly k: number;
  private readonly termCounts: Map<string, number>[];
  private readonly lengths: number[];
  private readonly avgLength: number;
  private readonly docFrequency = new Map<string, number>();

  constructor(fields: PolicyRetrieverInput) {
    super(fields);
    this.chunks = fields.chunks;
    this.k = fields.k ?? 3;
    // The heading is searched too: it is often the best summary of a section.
    const docs = this.chunks.map((c) => tokenize(`${c.heading} ${c.text}`));
    this.lengths = docs.map((d) => d.length);
    this.avgLength = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, docs.length);
    this.termCounts = docs.map((terms) => {
      const counts = new Map<string, number>();
      for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
      return counts;
    });
    for (const counts of this.termCounts) {
      for (const term of counts.keys()) this.docFrequency.set(term, (this.docFrequency.get(term) ?? 0) + 1);
    }
  }

  private idf(term: string): number {
    const n = this.chunks.length;
    const df = this.docFrequency.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** Every section with a score above 0, best first. */
  score(query: string): ScoredChunk[] {
    const terms = [...new Set(tokenize(query))];
    return this.chunks
      .map((chunk, i) => {
        const counts = this.termCounts[i]!;
        const norm = K1 * (1 - B + (B * this.lengths[i]!) / (this.avgLength || 1));
        const score = terms.reduce((sum, term) => {
          const tf = counts.get(term) ?? 0;
          return tf === 0 ? sum : sum + this.idf(term) * ((tf * (K1 + 1)) / (tf + norm));
        }, 0);
        return { chunk, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  override async _getRelevantDocuments(query: string): Promise<Document[]> {
    return this.score(query)
      .slice(0, this.k)
      .map(
        ({ chunk, score }) =>
          new Document({ pageContent: chunk.text, metadata: { id: chunk.id, heading: chunk.heading, score } }),
      );
  }
}
