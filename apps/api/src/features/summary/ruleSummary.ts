import {
  PRIORITY_LEVELS,
  SUMMARY_LIMITS,
  type Language,
  type PriorityLevel,
  type Summary,
  type SummaryCard,
} from '@approvals/schemas';

/** Read out every item for a short queue; otherwise the first few, then a count. */
const READ_ALL_UP_TO = 4;
const READ_FIRST = 3;

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

const LABELS: Record<Language, Record<PriorityLevel, string>> = {
  en: { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' },
  hi: { urgent: 'अत्यावश्यक', high: 'उच्च', medium: 'मध्यम', low: 'निम्न' },
};

function countsByPriority(cards: readonly SummaryCard[], language: Language): string {
  return PRIORITY_LEVELS.map((level) => [level, cards.filter((c) => c.effectivePriority === level).length] as const)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count} ${LABELS[language][level]}`)
    .join(', ');
}

const TEXT = {
  en: {
    empty: "No approvals waiting. You're all caught up.",
    headline: (n: number, counts: string, first: string) =>
      `${n} ${n === 1 ? 'approval' : 'approvals'} waiting (${counts}). Start with “${first}”.`,
    intro: (n: number) => `You have ${n} ${n === 1 ? 'approval' : 'approvals'} waiting.`,
    order: ['First', 'Next', 'Then', 'Finally'],
    item: (order: string, title: string, label: string, reason: string) => `${order}, “${title}” (${label}): ${reason}`,
    titleOnly: (order: string, title: string, label: string) => `${order}, “${title}” (${label}).`,
    rest: (shown: number, rest: number) => `That covers the first ${shown}, and ${rest} more are listed on screen.`,
  },
  hi: {
    empty: 'कोई अनुमोदन लंबित नहीं है। सब काम पूरा है।',
    headline: (n: number, counts: string, first: string) => `${n} अनुमोदन लंबित हैं (${counts})। “${first}” से शुरू करें।`,
    intro: (n: number) => `आपके पास ${n} अनुमोदन लंबित हैं।`,
    order: ['पहले', 'फिर', 'उसके बाद', 'अंत में'],
    item: (order: string, title: string, label: string, reason: string) => `${order}: “${title}” (${label}) — ${reason}`,
    titleOnly: (order: string, title: string, label: string) => `${order}: “${title}” (${label})।`,
    rest: (shown: number, rest: number) => `पहले ${shown} बताए गए हैं, और ${rest} अनुमोदन स्क्रीन पर दिखाए गए हैं।`,
  },
} as const;

function script(cards: readonly SummaryCard[], language: Language, withReasons: boolean): string {
  const t = TEXT[language];
  const shown = cards.length <= READ_ALL_UP_TO ? cards : cards.slice(0, READ_FIRST);
  const lines = shown.map((card, i) => {
    const order = t.order[Math.min(i, t.order.length - 1)]!;
    const title = clip(card.title, 60);
    const label = LABELS[language][card.effectivePriority];
    return withReasons ? t.item(order, title, label, clip(card.priorityReason, 100)) : t.titleOnly(order, title, label);
  });
  const rest = cards.length - shown.length;
  return [t.intro(cards.length), ...lines, ...(rest > 0 ? [t.rest(shown.length, rest)] : [])].join(' ');
}

/**
 * The rule-based summary, built only from the ranked queue and the policy
 * reasons. Used when the AI fails, and when there is nothing for the AI to do.
 * Always within the shared length limits.
 */
export function buildRuleSummary(cards: readonly SummaryCard[], language: Language): Summary {
  const t = TEXT[language];
  if (cards.length === 0) return { headline: t.empty, items: [], spokenScript: t.empty };

  const headline = clip(
    t.headline(cards.length, countsByPriority(cards, language), clip(cards[0]!.title, 80)),
    SUMMARY_LIMITS.headline,
  );
  const full = script(cards, language, true);
  const spokenScript = clip(
    full.length <= SUMMARY_LIMITS.spokenScript ? full : script(cards, language, false),
    SUMMARY_LIMITS.spokenScript,
  );

  return {
    headline,
    items: cards.map((c) => ({ id: c.id, reason: clip(c.priorityReason, SUMMARY_LIMITS.reason) })),
    spokenScript,
  };
}
