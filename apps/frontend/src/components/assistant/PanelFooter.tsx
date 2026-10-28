import { useApprovals } from '../../api/useApprovals';
import { ExternalIcon } from '../icons';

export function PanelFooter() {
  const { data } = useApprovals();

  return (
    <footer className="panel-footer">
      <span>{data ? data.total : '–'} folders / items</span>
      <span className="panel-footer__link">
        HMS Panel <ExternalIcon />
      </span>
    </footer>
  );
}
