import type { TeachGuide } from '@approvals/schemas';
import type { PolicyChunk } from '../../policy/policyChunks';

/** Used when the policy has no numbered review steps. */
export const DEFAULT_STEPS: readonly string[] = [
  'Open the item and check the title and location are correct.',
  'Open the file itself: watch the video, read the PDF, or view the image.',
  'Compare the content with the policy and with current site rules.',
  'Approve it, or reject it with a clear reason.',
  'Add a short note so the submitter knows what happens next.',
];

const REVIEW_SECTION = /how to review/i;
const LIST_ITEM = /^\s*\d+[.)]\s+(.+?)\s*$/;

/**
 * Builds the guide from the numbered list in the policy's "How to review"
 * section, so the lesson always matches the policy. Deterministic: no AI.
 */
export function buildGuide(chunks: readonly PolicyChunk[]): TeachGuide {
  const section = chunks.find((c) => REVIEW_SECTION.test(c.heading));
  const items = (section?.text.split('\n') ?? []).flatMap((line) => {
    const match = LIST_ITEM.exec(line);
    return match ? [match[1]!] : [];
  });

  const texts = items.length > 0 ? items : DEFAULT_STEPS;
  return {
    steps: texts.map((text, i) => ({ number: i + 1, text })),
    sourceSectionId: items.length > 0 ? section!.id : null,
  };
}
