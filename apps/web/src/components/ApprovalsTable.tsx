import type { RankedApproval } from '@approvals/schemas';
import { useApprovals } from '../api/useApprovals';
import { formatShortDate, PRIORITY_LABELS, pluralItems, TYPE_LABELS } from '../lib/format';
import { TypeIcon } from './icons';

const HEADING_ID = 'approvals-heading';

function Row({ item }: { item: RankedApproval }) {
  return (
    <tr>
      <th scope="row" className="cell-name">
        <span className={`type-tile type-tile--${item.type}`} aria-hidden="true">
          <TypeIcon type={item.type} />
        </span>
        <span className="name-text">
          <span className="name-title">{item.title}</span>
          <span className="name-location">{item.location.join(' › ')}</span>
        </span>
      </th>
      <td>
        <span className="chip">
          <TypeIcon type={item.type} />
          {TYPE_LABELS[item.type]}
        </span>
      </td>
      <td>{item.submittedBy}</td>
      <td>{formatShortDate(item.submittedAt)}</td>
      <td>
        <span className={`priority priority--${item.effectivePriority}`} title={item.priorityReason}>
          {PRIORITY_LABELS[item.effectivePriority]}
        </span>
      </td>
      <td>
        <span className="status">Pending Review</span>
      </td>
    </tr>
  );
}

function Body() {
  const { data, error, isPending, refetch, isFetching } = useApprovals();

  if (isPending) {
    return (
      <div className="table-state" role="status">
        <span className="skeleton-rows" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Loading approvals…
      </div>
    );
  }

  if (error) {
    return (
      <div className="table-state table-state--error" role="alert">
        <p>
          <strong>Couldn't load approvals.</strong> {error.message}
        </p>
        <button type="button" className="button" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  if (data.items.length === 0) {
    return <p className="table-state">No approvals waiting. You're all caught up.</p>;
  }

  return (
    <table className="approvals-table" aria-labelledby={HEADING_ID}>
      <thead>
        <tr>
          <th scope="col">Folder / content name</th>
          <th scope="col">Type</th>
          <th scope="col">Submitted by</th>
          <th scope="col">Date</th>
          <th scope="col">Priority</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </tbody>
    </table>
  );
}

export function ApprovalsTable() {
  const { data } = useApprovals();

  return (
    <section className="card approvals-card">
      <header className="approvals-card__header">
        <h2 id={HEADING_ID} className="eyebrow">
          Pending approval requests
        </h2>
        {data && <span className="pill">{pluralItems(data.total)}</span>}
      </header>
      <Body />
    </section>
  );
}
