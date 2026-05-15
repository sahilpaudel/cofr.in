import React, { useEffect, useMemo, useState } from 'react';
import { ACCOUNT_TYPES } from './lib/accountTypes.js';
import { mergeImportedAccounts } from './lib/importMerge.js';
import { loadAccounts, saveAccounts } from './lib/storage.js';
import { loadStatement, loadStatements } from './lib/statementStore.js';
import { loadMembers, saveMembers } from './lib/membersStore.js';
import TopBar from './components/TopBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Footer from './components/Footer.jsx';
import TypePicker from './components/TypePicker.jsx';
import AccountModal from './components/AccountModal.jsx';
import FamilyModal from './components/FamilyModal.jsx';
import Dashboard from './views/Dashboard.jsx';
import AboutView from './views/AboutView.jsx';
import Tour from './components/Tour.jsx';
import AccountsView from './views/AccountsView.jsx';
import ImportView from './views/ImportView.jsx';
import StatementsView from './views/StatementsView.jsx';
import StatementReportView from './views/StatementReportView.jsx';
import SubscriptionsView from './views/SubscriptionsView.jsx';

// ── hash routing helpers ────────────────────────────────────────────────────
const HASH_TO_VIEW = {
  '':              'dashboard',
  'accounts':      'accounts',
  'subscriptions': 'subscriptions',
  'statements':    'statements',
  'import':        'import',
  'about':         'about',
};
const VIEW_TO_HASH = {
  dashboard:      '',
  accounts:       'accounts',
  subscriptions:  'subscriptions',
  statements:     'statements',
  import:         'import',
  about:          'about',
};

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (raw.startsWith('statements/')) {
    return { view: 'statement', statementId: raw.slice('statements/'.length) };
  }
  return { view: HASH_TO_VIEW[raw] ?? 'dashboard', statementId: null };
}

function pushHash(view, statementId = null) {
  const path = view === 'statement' && statementId
    ? `statements/${statementId}`
    : (VIEW_TO_HASH[view] ?? '');
  const next = '#/' + path;
  if (window.location.hash !== next) window.history.pushState(null, '', next);
}
// ────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [accounts, setAccounts] = useState(loadAccounts);
  const [members,  setMembers]  = useState(loadMembers);
  const [location, setLocation] = useState(parseHash);
  const [modal, setModal] = useState(null);
  const [picker, setPicker] = useState(false);
  const [familyModal, setFamilyModal] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem('tour_seen') && loadAccounts().length === 0
  );

  const view        = location.view;
  const statementId = location.statementId;

  // Sync browser back/forward → state
  useEffect(() => {
    const onPop = () => setLocation(parseHash());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (newView, id = null) => {
    pushHash(newView, id);
    setLocation({ view: newView, statementId: id });
  };

  // Drop-in replacement for old setView so all child callsites need no changes
  const setView = (v) => navigate(v);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const openReport = (id) => {
    navigate('statement', id);
    setModal(null);
  };

  // Persist every change.
  useEffect(() => saveAccounts(accounts), [accounts]);

  const totals = useMemo(() => {
    // Build latest-statement map so CC totalDue is used instead of a.balance
    const stmtByAccount = {};
    for (const s of loadStatements()) {
      if (s.accountId && !stmtByAccount[s.accountId]) stmtByAccount[s.accountId] = s;
    }
    const effectiveBalance = (a) => {
      if (a.type === 'creditCard') {
        // a.balance is authoritative when explicitly set (0 = paid, >0 = synced/manual).
        // Only fall back to statement totalDue when balance has never been set.
        if (a.balance != null && a.balance !== '') return Number(a.balance);
        const due = stmtByAccount[a.id]?.summary?.totalDue;
        return due != null ? Number(due) : 0;
      }
      return Number(a.balance) || 0;
    };
    const assets = accounts
      .filter((a) => ACCOUNT_TYPES[a.type]?.kind === 'asset')
      .reduce((s, a) => s + effectiveBalance(a), 0);
    const liabs = accounts
      .filter((a) => ACCOUNT_TYPES[a.type]?.kind === 'liability')
      .reduce((s, a) => s + effectiveBalance(a), 0);
    return { assets, liabs, net: assets - liabs };
  }, [accounts]);

  const memberTotals = useMemo(() => {
    if (!members.length) return [];
    const stmtByAccount = {};
    for (const s of loadStatements()) {
      if (s.accountId && !stmtByAccount[s.accountId]) stmtByAccount[s.accountId] = s;
    }
    const effectiveBal = (a) => {
      if (a.type === 'creditCard') {
        if (a.balance != null && a.balance !== '') return Number(a.balance);
        return stmtByAccount[a.id]?.summary?.totalDue ?? 0;
      }
      return Number(a.balance) || 0;
    };
    return members.map((m, i) => {
      // First member owns all unattributed (ownerId null/undefined) accounts too.
      const mine = accounts.filter(a => a.ownerId === m.id || (i === 0 && !a.ownerId));
      const assets = mine.filter(a => ACCOUNT_TYPES[a.type]?.kind === 'asset').reduce((s, a) => s + effectiveBal(a), 0);
      const liabs  = mine.filter(a => ACCOUNT_TYPES[a.type]?.kind === 'liability').reduce((s, a) => s + effectiveBal(a), 0);
      return { member: m, assets, liabs, net: assets - liabs };
    });
  }, [accounts, members]);

  const upsert = (acc) => {
    setAccounts((prev) => {
      if (acc.id) {
        return prev.map((a) => (a.id === acc.id ? { ...acc, updatedAt: Date.now() } : a));
      }
      return [
        ...prev,
        { ...acc, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() },
      ];
    });
  };

  const remove = (id, type) =>
    setAccounts((prev) => prev.filter((a) => !(a.id === id && a.type === type)));

  const openAdd = (type) => {
    setPicker(false);
    setModal({ type, accountId: null });
  };
  const openEdit = (account) => setModal({ type: account.type, accountId: account.id });

  return (
    <>
      <div className="app-shell grain">
        <TopBar
          view={view}
          setView={setView}
          onAdd={() => setPicker(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onAbout={() => navigate('about')}
        />

        <main className="container pb-32">
          {view === 'dashboard' && (
            <Dashboard
              totals={totals}
              accounts={accounts}
              members={members}
              memberTotals={memberTotals}
              onAdd={() => setPicker(true)}
              onEdit={openEdit}
              onImport={() => setView('import')}
              onManageFamily={() => setFamilyModal(true)}
              onTour={() => setShowTour(true)}
            />
          )}
          {view === 'accounts' && (
            <AccountsView
              accounts={accounts}
              members={members}
              onAdd={() => setPicker(true)}
              onEdit={openEdit}
              onManageFamily={() => setFamilyModal(true)}
            />
          )}
          {view === 'import' && (
            <ImportView
              onAdd={() => setPicker(true)}
              existingAccounts={accounts}
              members={members}
              onImport={(incoming, ownerId) => {
                const result = mergeImportedAccounts(accounts, incoming, Date.now(), ownerId);
                saveAccounts(result.accounts);
                window.location.reload();
                return result;
              }}
            />
          )}
          {view === 'subscriptions' && <SubscriptionsView />}
          {view === 'statements' && (
            <StatementsView
              onOpen={openReport}
              accounts={accounts}
              onAccountUpdate={(id, changes) => {
                setAccounts(prev => prev.map(a =>
                  a.id === id ? { ...a, ...changes, updatedAt: Date.now() } : a
                ));
              }}
            />
          )}
          {view === 'statement' && statementId && (
            <StatementReportView
              report={loadStatement(statementId)}
              accounts={accounts}
              onBack={() => navigate('statements')}
              onDelete={() => navigate('statements')}
            />
          )}
          {view === 'about' && <AboutView onNavigate={navigate} />}
        </main>

        <Footer onAbout={() => navigate('about')} />
      </div>

      <BottomNav view={view} setView={setView} onAdd={() => setPicker(true)} />

      {picker && (
        <TypePicker
          onClose={() => setPicker(false)}
          onPick={openAdd}
          onImport={() => { setPicker(false); setView('import'); }}
          onManageFamily={() => { setPicker(false); setFamilyModal(true); }}
        />
      )}
      {modal && (
        <AccountModal
          type={modal.type}
          account={modal.accountId ? accounts.find(a => a.id === modal.accountId) ?? null : null}
          members={members}
          onClose={() => setModal(null)}
          onSave={(data) => {
            upsert(data);
            setModal(null);
          }}
          onDelete={(id) => {
            remove(id, modal.type);
            setModal(null);
          }}
          onUpdate={(data) => upsert(data)}
          onViewReport={openReport}
        />
      )}
      {familyModal && (
        <FamilyModal
          members={members}
          onClose={() => setFamilyModal(false)}
          onChange={(updated) => setMembers(updated)}
        />
      )}
      {showTour && <Tour onDone={() => setShowTour(false)} />}
    </>
  );
}
