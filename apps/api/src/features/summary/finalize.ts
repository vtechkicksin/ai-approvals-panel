import { summarySchema, type AnswerSource, type Language, type Summary, type SummaryCard } from '@approvals/schemas';
import type { ExtractorSnapshot } from './extractor';
import { buildRuleSummary } from './ruleSummary';

export interface FinalSummary {
  summary: Summary;
  source: Extract<AnswerSource, 'ai' | 'partial' | 'fallback'>;
}

interface AiParts {
  headline?: string;
  reasons: Record<string, string>;
  spokenScript?: string;
}

const headlineSchema = summarySchema.shape.headline;
const reasonSchema = summarySchema.shape.items.element.shape.reason;
const scriptSchema = summarySchema.shape.spokenScript;

/** Builds the final summary in ranked order: AI text where it passed its check, rules everywhere else. */
function assemble(ai: AiParts, cards: readonly SummaryCard[], language: Language): FinalSummary {
  const rules = buildRuleSummary(cards, language);
  const summary: Summary = {
    headline: ai.headline ?? rules.headline,
    items: rules.items.map((item) => ({ id: item.id, reason: ai.reasons[item.id] ?? item.reason })),
    spokenScript: ai.spokenScript ?? rules.spokenScript,
  };

  const aiParts = [ai.headline, ai.spokenScript, ...cards.map((c) => ai.reasons[c.id])];
  const fromAi = aiParts.filter((p) => p !== undefined).length;
  const source = fromAi === 0 ? 'fallback' : fromAi === aiParts.length ? 'ai' : 'partial';
  return { summary, source };
}

/**
 * For a reply that was cut short: keeps only the parts the model finished and
 * that passed their checks; everything else is rule-based.
 */
export function finalizeFromSnapshot(
  snapshot: ExtractorSnapshot,
  cards: readonly SummaryCard[],
  language: Language,
): FinalSummary {
  return assemble({ headline: snapshot.headline, reasons: snapshot.reasons }, cards, language);
}

/**
 * Validates the model's full JSON and builds the final summary in the queue's
 * ranked order. Unusable parts are replaced by rule-based text, never trusted:
 * invented ids are dropped, duplicates ignored, and each field is checked.
 */
export function finalizeSummary(rawText: string, cards: readonly SummaryCard[], language: Language): FinalSummary {
  let reply: unknown;
  try {
    reply = JSON.parse(rawText);
  } catch {
    return assemble({ reasons: {} }, cards, language);
  }
  if (typeof reply !== 'object' || reply === null || Array.isArray(reply)) {
    return assemble({ reasons: {} }, cards, language);
  }

  const { headline, items, spokenScript } = reply as Record<string, unknown>;
  const known = new Set(cards.map((c) => c.id));
  const reasons: Record<string, string> = {};
  for (const entry of Array.isArray(items) ? items : []) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, reason } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !known.has(id) || id in reasons) continue;
    const checked = reasonSchema.safeParse(reason);
    if (checked.success) reasons[id] = checked.data;
  }

  const h = headlineSchema.safeParse(headline);
  const s = scriptSchema.safeParse(spokenScript);
  return assemble(
    { reasons, ...(h.success && { headline: h.data }), ...(s.success && { spokenScript: s.data }) },
    cards,
    language,
  );
}
