import type { PolicyChunk } from '../../../src/help/policyChunks';
import { PolicyRetriever } from '../../../src/help/policyRetriever';

const chunks: PolicyChunk[] = [
  { id: 'a', heading: 'Cameras', text: 'Camera maps show every camera position on site.' },
  { id: 'b', heading: 'Safety', text: 'Safety specs protect people. Check the camera once.' },
  { id: 'c', heading: 'Training', text: 'Training videos guide patrols.' },
];

describe('PolicyRetriever (BM25)', () => {
  it('ranks the section that uses the words most, and gives it a higher score', () => {
    const results = new PolicyRetriever({ chunks }).score('camera position');

    expect(results.map((r) => r.chunk.id)).toEqual(['a', 'b']);
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it('weighs rare words more than common ones', () => {
    const results = new PolicyRetriever({ chunks }).score('camera training');

    // "training" appears in one section, "camera" in two: the training section wins.
    expect(results[0]!.chunk.id).toBe('c');
  });

  it('leaves out sections with no matching words', () => {
    expect(new PolicyRetriever({ chunks }).score('weather forecast')).toEqual([]);
  });

  it('searches the heading as well as the text', () => {
    expect(new PolicyRetriever({ chunks }).score('cameras')[0]!.chunk.id).toBe('a');
  });

  it('works as a LangChain retriever, returning documents with id, heading and score', async () => {
    const docs = await new PolicyRetriever({ chunks, k: 1 }).invoke('safety');

    expect(docs).toHaveLength(1);
    expect(docs[0]!.pageContent).toBe(chunks[1]!.text);
    expect(docs[0]!.metadata).toMatchObject({ id: 'b', heading: 'Safety', score: expect.any(Number) });
  });
});
