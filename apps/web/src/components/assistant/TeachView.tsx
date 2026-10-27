import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TALK_LIMITS } from '@approvals/schemas';
import { useTeachGuide } from '../../api/useTeachGuide';
import { usePanelStore } from '../../state/panelStore';
import { useTeachChatStore, useTeachStore } from '../../state/teachStore';
import { ChatMessages } from './ChatMessages';

const QUICK_FOLLOW_UPS = ['Explain this step more simply', 'Give me an example from the queue'];

export function TeachView() {
  const language = usePanelStore((s) => s.language);
  const guide = useTeachGuide();
  const { step, next, previous, restart } = useTeachStore(useShallow((s) => s));
  const { entries, isSending, send, retry, cancel } = useTeachChatStore(useShallow((s) => s));
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => cancel(), [cancel]);

  const thread = entries.filter((e) => e.scope === step);
  const lastContent = thread.at(-1)?.content;
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, lastContent]);

  if (guide.isPending) {
    return (
      <div className="summary-state" role="status">
        Loading the guide…
      </div>
    );
  }

  if (guide.error) {
    return (
      <div className="summary-state summary-state--error" role="alert">
        <p>
          <strong>Couldn't load the guide.</strong> {guide.error.message}
        </p>
        <button type="button" className="button" onClick={() => void guide.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const { steps } = guide.data;
  const total = steps.length;

  if (step > total) {
    return (
      <div className="teach-done">
        <p className="teach-done__title">You're ready to review approvals.</p>
        <p className="muted">You have gone through all {total} steps. Come back any time to go over them again.</p>
        <button type="button" className="button" onClick={restart}>
          Start again
        </button>
      </div>
    );
  }

  const current = steps[step - 1]!;
  const submit = (text: string) => {
    if (!text.trim() || isSending) return;
    setDraft('');
    void send(text, language);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  };

  return (
    <div className="teach">
      <div className="teach-step">
        <div className="teach-step__top">
          <span className="teach-step__count">
            Step {current.number} of {total}
          </span>
          <span className="teach-progress" aria-hidden="true">
            {steps.map((s) => (
              <span key={s.number} className={s.number <= current.number ? 'is-done' : ''} />
            ))}
          </span>
        </div>
        <p className="teach-step__text">{current.text}</p>
        <div className="teach-step__nav">
          <button type="button" className="link-button" onClick={previous} disabled={step === 1}>
            ← Previous
          </button>
          <button type="button" className="button" onClick={() => next(total)}>
            {step === total ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>

      <div ref={threadRef} className="talk-log teach-thread" role="log" aria-label={`Questions about step ${step}`}>
        {thread.length === 0 ? (
          <div className="talk-empty">
            <p className="muted">Not sure about this step? Ask, or try:</p>
            {QUICK_FOLLOW_UPS.map((q) => (
              <button key={q} type="button" className="chip-button" onClick={() => submit(q)}>
                {q}
              </button>
            ))}
          </div>
        ) : (
          <ChatMessages entries={thread} onRetry={() => void retry(language)} />
        )}
      </div>

      <form className="talk-composer" onSubmit={onSubmit}>
        <textarea
          aria-label="Ask about this step"
          placeholder="Ask about this step…"
          rows={2}
          maxLength={TALK_LIMITS.userMessage}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="talk-composer__actions">
          <button type="submit" className="button" disabled={isSending || !draft.trim()}>
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
