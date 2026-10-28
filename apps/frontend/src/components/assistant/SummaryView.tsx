import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AnswerSource } from '@approvals/schemas';
import { PRIORITY_LABELS } from '../../lib/format';
import { usePanelStore } from '../../state/panelStore';
import { useSummaryStore } from '../../state/summaryStore';

const SOURCE_LABELS: Record<AnswerSource, string> = {
  ai: 'Written by AI',
  partial: 'Partly AI, partly rule-based',
  fallback: 'Rule-based summary',
  rules: 'Rule-based summary (no AI needed)',
};

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

type Speech = 'idle' | 'speaking' | 'paused';

export function SummaryView() {
  const language = usePanelStore((s) => s.language);
  const { status, cards, headline, reasons, confirmed, spokenScript, notice, source, errorMessage, start, cancel } =
    useSummaryStore(useShallow((s) => s));
  const [speech, setSpeech] = useState<Speech>('idle');
  /** The utterance being read; events from an older, cancelled one are ignored. */
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Start on the next tick: React StrictMode mounts, unmounts and mounts again in
    // development, and a start that is cleared here never reaches Gemini (no wasted call).
    const timer = setTimeout(() => void start(language), 0);
    return () => {
      clearTimeout(timer);
      cancel();
      if (canSpeak()) window.speechSynthesis.cancel();
    };
  }, [language, start, cancel]);

  if (status === 'idle' || status === 'connecting') {
    return (
      <div className="summary-state" role="status">
        <span className="skeleton-rows" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Reviewing the approvals queue…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="summary-state summary-state--error" role="alert">
        <p>{errorMessage}</p>
        <button type="button" className="button" onClick={() => void start(language)}>
          Try again
        </button>
      </div>
    );
  }

  const isStreaming = status === 'streaming';
  const readAloud = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenScript);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    const finished = () => {
      if (utteranceRef.current === utterance) setSpeech('idle');
    };
    utterance.onend = finished;
    utterance.onerror = finished;
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeech('speaking');
  };
  const pauseReading = () => {
    window.speechSynthesis.pause();
    setSpeech('paused');
  };
  const resumeReading = () => {
    window.speechSynthesis.resume();
    setSpeech('speaking');
  };
  const stopReading = () => {
    utteranceRef.current = null;
    if (canSpeak()) window.speechSynthesis.cancel();
    setSpeech('idle');
  };
  const regenerate = () => {
    stopReading();
    void start(language);
  };

  return (
    <section className="summary" aria-label="Summary" aria-busy={isStreaming}>
      {notice && <p className="summary-notice">{notice.message}</p>}

      <p className="summary-headline" aria-live="polite">
        {headline || (isStreaming && <span className="text-skeleton" aria-hidden="true" />)}
      </p>

      <ol className="summary-cards" aria-label="Approvals in priority order">
        {cards.map((card) => {
          const reason = reasons[card.id];
          const verifying = isStreaming && reason && !confirmed[card.id];
          return (
            <li key={card.id} className="summary-card">
              <span className="summary-card__rank" aria-hidden="true">
                {card.rank}
              </span>
              <div className="summary-card__body">
                <div className="summary-card__top">
                  <span className="summary-card__title">{card.title}</span>
                  <span className={`priority priority--${card.effectivePriority}`}>
                    {PRIORITY_LABELS[card.effectivePriority]}
                  </span>
                </div>
                {reason ? (
                  <p className={`summary-card__reason${verifying ? ' is-provisional' : ''}`}>{reason}</p>
                ) : (
                  isStreaming && <span className="text-skeleton" aria-hidden="true" />
                )}
                {verifying && <span className="verifying">verifying…</span>}
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="summary-footer">
        <span className="muted">{source ? SOURCE_LABELS[source] : 'Writing…'}</span>
        <span className="summary-footer__actions">
          {canSpeak() &&
            status === 'complete' &&
            spokenScript &&
            (speech === 'idle' ? (
              <button type="button" className="link-button" onClick={readAloud}>
                🔊 Read aloud
              </button>
            ) : (
              <>
                {speech === 'speaking' ? (
                  <button type="button" className="link-button" onClick={pauseReading}>
                    ⏸ Pause
                  </button>
                ) : (
                  <button type="button" className="link-button" onClick={resumeReading}>
                    ▶ Resume
                  </button>
                )}
                <button type="button" className="link-button" onClick={stopReading}>
                  ⏹ Stop
                </button>
              </>
            ))}
          <button type="button" className="link-button" disabled={isStreaming} onClick={regenerate}>
            Regenerate
          </button>
        </span>
      </footer>
    </section>
  );
}
