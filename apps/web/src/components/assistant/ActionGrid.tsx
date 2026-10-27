import { usePanelStore } from '../../state/panelStore';
import { ActionArt } from './ActionArt';
import { ACTIONS } from './actions';

export function ActionGrid() {
  const openAction = usePanelStore((s) => s.openAction);

  return (
    <div className="action-grid">
      {ACTIONS.map((action) => (
        <button key={action.id} type="button" className="action-card" onClick={() => openAction(action.id)}>
          <ActionArt action={action.id} />
          <span className="action-card__label">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
