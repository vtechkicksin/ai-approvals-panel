import { SUMMARY_LIMITS, summarySchema, type SummaryCard, type SummaryStreamEvent } from '@approvals/schemas';
import { parsePartialJson } from './partialJson';

/** What the model has finished so far: only fields that are known to be complete. */
export interface ExtractorSnapshot {
  /** Set once the model has moved past the headline. */
  headline?: string;
  /** Reasons of items that passed their check, by id. */
  reasons: Record<string, string>;
}

export interface SummaryExtractor {
  /** Feed the next piece of the model's JSON text; returns events to send now. */
  push(text: string): SummaryStreamEvent[];
  /** The stream is over: confirm or replace any item that is still open. */
  finish(): SummaryStreamEvent[];
  /** All text received so far. */
  readonly text: string;
  snapshot(): ExtractorSnapshot;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const headlineSchema = summarySchema.shape.headline;
const reasonSchema = summarySchema.shape.items.element.shape.reason;

/**
 * Turns the model's streaming JSON into safe, typed events: only appended
 * text for known fields and known item ids, cut at the length limits, with a
 * per-item check as soon as each item is complete. Raw model JSON never
 * leaves this function.
 *
 * Relies on the field order the Gemini schema asks for: headline → items
 * (id → reason) → spokenScript.
 */
export function createSummaryExtractor(cards: readonly SummaryCard[]): SummaryExtractor {
  const cardById = new Map(cards.map((c) => [c.id, c]));
  let text = '';
  let headlineDone = false;
  const sent = { headline: '', spokenScript: '' };
  const sentReasons = new Map<string, string>();
  /** Array index → the known id it claimed, or null if it is ignored (unknown or duplicate id). */
  const claimed = new Map<number, string | null>();
  const usedIds = new Set<string>();
  const latestRaw = new Map<string, Json>();
  const confirmed = new Map<string, { status: 'ok' | 'fallback'; reason: string }>();

  /** Sends only the text added since last time, never past the limit, never a rewrite. */
  function appended(previous: string, full: string, limit: number): string | null {
    const capped = full.slice(0, limit);
    return capped.length > previous.length && capped.startsWith(previous) ? capped.slice(previous.length) : null;
  }

  function confirm(id: string, raw: Json | undefined): SummaryStreamEvent {
    const reason = reasonSchema.safeParse(raw?.reason);
    const result = reason.success
      ? { status: 'ok' as const, reason: reason.data }
      : { status: 'fallback' as const, reason: cardById.get(id)!.priorityReason };
    confirmed.set(id, result);
    return { type: 'item', itemId: id, ...result };
  }

  function push(piece: string): SummaryStreamEvent[] {
    text += piece;
    const view = parsePartialJson(text);
    if (!isObject(view)) return [];
    const events: SummaryStreamEvent[] = [];

    if (typeof view.headline === 'string') {
      const delta = appended(sent.headline, view.headline, SUMMARY_LIMITS.headline);
      if (delta) {
        sent.headline += delta;
        events.push({ type: 'delta', field: 'headline', text: delta });
      }
    }
    if ('items' in view || 'spokenScript' in view) headlineDone = true;

    const items = Array.isArray(view.items) ? view.items : [];
    const listClosed = 'spokenScript' in view;
    items.forEach((raw, index) => {
      if (!isObject(raw)) return;
      const isClosed = index < items.length - 1 || listClosed;

      // The id is final once the reason has started (or the item is closed).
      if (!claimed.has(index) && typeof raw.id === 'string' && ('reason' in raw || isClosed)) {
        const ok = cardById.has(raw.id) && !usedIds.has(raw.id);
        claimed.set(index, ok ? raw.id : null);
        if (ok) usedIds.add(raw.id);
      }
      const id = claimed.get(index);
      if (!id || confirmed.has(id)) return;
      latestRaw.set(id, raw);

      if (typeof raw.reason === 'string') {
        const previous = sentReasons.get(id) ?? '';
        const delta = appended(previous, raw.reason, SUMMARY_LIMITS.reason);
        if (delta) {
          sentReasons.set(id, previous + delta);
          events.push({ type: 'delta', field: 'reason', itemId: id, text: delta });
        }
      }
      if (isClosed) events.push(confirm(id, raw));
    });

    if (typeof view.spokenScript === 'string') {
      const delta = appended(sent.spokenScript, view.spokenScript, SUMMARY_LIMITS.spokenScript);
      if (delta) {
        sent.spokenScript += delta;
        events.push({ type: 'delta', field: 'spokenScript', text: delta });
      }
    }
    return events;
  }

  function finish(): SummaryStreamEvent[] {
    return cards.filter((c) => !confirmed.has(c.id)).map((c) => confirm(c.id, latestRaw.get(c.id)));
  }

  function snapshot(): ExtractorSnapshot {
    const headline = headlineSchema.safeParse(sent.headline);
    const reasons = Object.fromEntries(
      [...confirmed].filter(([, r]) => r.status === 'ok').map(([id, r]) => [id, r.reason]),
    );
    return headlineDone && headline.success ? { headline: headline.data, reasons } : { reasons };
  }

  return {
    push,
    finish,
    snapshot,
    get text() {
      return text;
    },
  };
}
