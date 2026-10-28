import { useEffect, useState, type FormEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { HELP_LIMITS } from '@approvals/schemas';
import { useHelpStore } from '../../state/helpStore';
import { usePanelStore } from '../../state/panelStore';

const EXAMPLES = [
  'When should I reject an item?',
  'What do I do if an urgent item cannot be reviewed today?',
  'Which categories are high priority?',
];

export function HelpView() {
  const language = usePanelStore((s) => s.language);
  const openAction = usePanelStore((s) => s.openAction);
  const { question, status, answer, citations, notice, source, errorMessage, ask, retry, cancel } = useHelpStore(
    useShallow((s) => s),
  );
  const [draft, setDraft] = useState('');

  useEffect(() => () => cancel(), [cancel]);

  const isStreaming = status === 'streaming';
  const submit = (text: string) => {
    if (!text.trim() || isStreaming) return;
    setDraft('');
    void ask(text, language);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  return (
    <div className="help">
      <form className="help-form" onSubmit={onSubmit}>
        <input
          type="text"
          aria-label="Question"
          placeholder="Ask about the approval policy…"
          maxLength={HELP_LIMITS.question}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="button" disabled={isStreaming || !draft.trim()}>
          Ask
        </button>
      </form>

      {status === 'idle' && (
        <div className="help-examples">
          <p className="muted">Answers come from the approval policy. Try:</p>
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="chip-button" onClick={() => submit(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {status !== 'idle' && (
        <section className="help-answer" aria-label="Answer" aria-busy={isStreaming}>
          <p className="help-question">{question}</p>

          {status === 'error' ? (
            <div className="summary-state--error" role="alert">
              <p>{errorMessage}</p>
              <button type="button" className="button" onClick={() => void retry(language)}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {notice && <p className="summary-notice">{notice}</p>}
              {answer ? (
                <p className="help-answer__text" aria-live="polite">
                  {answer}
                </p>
              ) : (
                isStreaming && (
                  <span className="typing" aria-label="Finding the answer">
                    <span />
                    <span />
                    <span />
                  </span>
                )
              )}
              {source === 'rules' && (
                <button type="button" className="chip-button" onClick={() => openAction('talk')}>
                  Talk to me
                </button>
              )}
              {citations.length > 0 && (
                <div className="help-sources">
                  <h4>Sources from the policy</h4>
                  <ol aria-label="Sources from the policy">
                    {citations.map((c) => (
                      <li key={c.id}>
                        <details>
                          <summary>{c.heading}</summary>
                          <p>{c.excerpt}</p>
                        </details>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
