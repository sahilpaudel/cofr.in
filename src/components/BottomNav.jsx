import React from 'react';
import { Icon } from '../icons/Icon.jsx';

const TABS = [
  { k: 'dashboard',     label: 'Overview',    icon: 'pie'       },
  { k: 'accounts',      label: 'Accounts',    icon: 'bank'      },
  { k: 'statements',    label: 'Statements',  icon: 'file-text' },
  { k: 'subscriptions', label: 'Subs',        icon: 'repeat'    },
];

export default function BottomNav({ view, setView, onAdd }) {
  const isActive = (k) => k === view || (k === 'statements' && view === 'statement');

  return (
    <nav className="bottom-nav">
      {TABS.slice(0, 2).map((tab) => (
        <button
          key={tab.k}
          id={`tour-bnav-${tab.k}`}
          className={`bottom-nav-item ${isActive(tab.k) ? 'active' : ''}`}
          onClick={() => setView(tab.k)}
        >
          <Icon name={tab.icon} size={22} stroke={1.4} />
          {tab.label}
        </button>
      ))}

      <button id="tour-add-mobile" className="bottom-nav-fab" onClick={onAdd} aria-label="Add account">
        <Icon name="plus" size={18} stroke={2} />
      </button>

      {TABS.slice(2).map((tab) => (
        <button
          key={tab.k}
          id={`tour-bnav-${tab.k}`}
          className={`bottom-nav-item ${isActive(tab.k) ? 'active' : ''}`}
          onClick={() => setView(tab.k)}
        >
          <Icon name={tab.icon} size={22} stroke={1.4} />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
