import type { NavTab } from '../domain/types';

interface NavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const TABS: Array<{ id: NavTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'practice', label: 'Practice' },
  { id: 'progress', label: 'Progress' },
  { id: 'settings', label: 'Settings' },
];

export function Nav({ activeTab, onSelectTab }: NavProps) {
  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <button
          type="button"
          className="brand"
          onClick={() => onSelectTab('overview')}
        >
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>Numera</span>
        </button>

        <nav className="nav-links" aria-label="Main navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-link${activeTab === tab.id ? ' active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => onSelectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
