import { partOfDayAt } from '@approvals/schemas';
import { useGreetingStore } from '../../state/greetingStore';
import { usePanelStore, type Language } from '../../state/panelStore';
import { HomeIcon } from '../icons';

const LANGUAGES: { id: Language; label: string; name: string }[] = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'hi', label: 'हिं', name: 'Hindi' },
];

export function GreetingBar() {
  const language = usePanelStore((s) => s.language);
  const setLanguage = usePanelStore((s) => s.setLanguage);
  const back = usePanelStore((s) => s.back);
  const replay = useGreetingStore((s) => s.replay);

  const replayGreeting = () => {
    back(); // the greeting lives on the cards screen
    void replay(language, partOfDayAt(new Date()));
  };

  return (
    <div className="greeting-bar">
      <span className="greeting-bar__title">
        <HomeIcon />
        Approvals
      </span>
      <div className="greeting-bar__end">
        <div className="lang-toggle" role="group" aria-label="Language">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              lang={lang.id}
              title={lang.name}
              aria-pressed={language === lang.id}
              onClick={() => setLanguage(lang.id)}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <button type="button" className="link-button" onClick={replayGreeting}>
          Replay Greeting
        </button>
      </div>
    </div>
  );
}
