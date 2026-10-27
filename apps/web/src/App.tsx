import { ApprovalsTable } from './components/ApprovalsTable';
import { AssistantPanel } from './components/assistant/AssistantPanel';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <strong>Command Centre</strong>
          <span>Approvals demo</span>
        </span>
      </header>
      <main className="page">
        <div className="card page-header">
          <h1>Approvals &amp; Review</h1>
        </div>
        <ApprovalsTable />
      </main>
      <AssistantPanel />
    </div>
  );
}
