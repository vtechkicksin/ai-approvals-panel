import type { TeachGuide } from '@approvals/schemas';
import type { PolicyChunk } from '../help/policyChunks';

/** Used when the policy has no numbered review steps. */
export const DEFAULT_STEPS: readonly string[] = [
  'Open the item and check the title and location are correct.',
  'Open the file itself: watch the video, read the PDF, or view the image.',
  'Compare the content with the policy and with current site rules.',
  'Approve it, or reject it with a clear reason.',
  'Add a short note so the submitter knows what happens next.',
];

/** Builds the guide from the numbered list in the policy's "How to review" section. */
export function buildGuide(_chunks: readonly PolicyChunk[]): TeachGuide {
  throw new Error('Not implemented');
}
