import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildGreeting, greetingFacts, helloFor, partOfDayAt } from '@approvals/schemas';
import { useApprovals } from '../../api/useApprovals';
import { useGreetingStore } from '../../state/greetingStore';
import { usePanelStore } from '../../state/panelStore';

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/**
 * The greeting at the top of the panel. The template is built right here
 * from the queue already on screen: instant, no request. The AI wording is
 * optional and only replaces it once the server has accepted it.
 */
export function GreetingCard() {
  const language = usePanelStore((s) => s.language);
  const { data } = useApprovals();
  const { aiWording, aiText, status, note, replays, setAiWording, cancel } = useGreetingStore(useShallow((s) => s));
  const spokenReplay = useRef(replays);

  const partOfDay = partOfDayAt(new Date());
  const template = data ? buildGreeting(greetingFacts(data.items), language, partOfDay) : helloFor(language, partOfDay);
  const text = aiText ?? template;

  useEffect(() => () => cancel(), [cancel]);

  // Replay Greeting reads it aloud once the final text is known.
  useEffect(() => {
    if (replays === spokenReplay.current || status === 'streaming') return;
    spokenReplay.current = replays;
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.speak(utterance);
  }, [replays, status, text, language]);

  return (
    <div className="greeting-card">
      <span className="panel-avatar" aria-hidden="true">
        ✦
      </span>
      <div className="greeting-card__body">
        <p className="greeting-card__text" role="status" aria-label="Greeting" aria-live="polite">
          {text}
        </p>
        <div className="greeting-card__meta">
          {aiText && status === 'done' && <span className="muted">Worded by AI</span>}
          {note && <span className="muted">{note}</span>}
          <label className="toggle">
            <input type="checkbox" checked={aiWording} onChange={(e) => setAiWording(e.target.checked)} />
            Let AI word it
          </label>
        </div>
      </div>
    </div>
  );
}
