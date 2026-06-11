// src/components/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import DeckList from './DeckList/DeckList';
import StudyView from './Study/StudyView';
import DeckEditor from './Editor/DeckEditor';
import '../styles/main.css';
import { useTranslation } from 'react-i18next';
// at top of src/components/App.jsx
import DonateButton from './DonateButton'; // adjust path if needed

function Header() {
  const { t } = useTranslation();
  return <h1>{t('appTitle')}</h1>;
}

// language button will be used inside App

export default function App() {
  const { t, i18n } = useTranslation();
  const languages = ['en','ko','zh-Hant'];
  function cycleLanguage() {
    const idx = languages.indexOf(i18n.language);
    const next = languages[(idx + 1) % languages.length];
    i18n.changeLanguage(next);
  }

  const [activeDeckId, setActiveDeckId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDeckId, setEditorDeckId] = useState(null);

  // menu state for header Menu button
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // help and clear-confirm modals
  const [helpVisible, setHelpVisible] = useState(false);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');

  // close menu when clicking/tapping outside
  // Use pointerdown so that the native event doesn't run after React's synthetic click
  // which could cause the menu to immediately close when toggled.
  useEffect(() => {
    function onDocPointerDown(e) {
      if (!menuRef.current) return;
      // prefer composedPath for robustness across shadow DOM / portals
      const path = e.composedPath ? e.composedPath() : [e.target];
      const clickedInside = path.some((node) => node === menuRef.current || (node && node.contains && menuRef.current.contains(node)));
      if (!clickedInside) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  // dispatch an event so StudyView can open the report UI for the active deck
  function handleMenuReport() {
    try {
      window.dispatchEvent(new CustomEvent('open-report', { detail: { deckId: activeDeckId } }));
    } catch (e) {
      console.warn('open-report dispatch failed', e);
    }
    setMenuOpen(false);
  }

  // Open the clear-confirm dialog from the menu
  function handleMenuClearAll() {
    setMenuOpen(false);
    setClearConfirmInput('');
    setClearConfirmVisible(true);
  }

  // Perform the destructive clear only when user typed the exact phrase
  function performClearAll() {
    // defensive: only proceed when user typed the exact phrase
    if (clearConfirmInput.trim() !== 'clear all') return;

    try {
      // Clear local storage (app data) — adjust if you store data elsewhere
      localStorage.clear();

      // Optionally, if you have other stores (indexedDB, etc.), clear them here.
      // Dispatch an event so other components can react (reload decks, reset state)
      window.dispatchEvent(new CustomEvent('decks-cleared'));

      // Reset UI state
      setActiveDeckId(null);
      setClearConfirmVisible(false);
      setClearConfirmInput('');
      // Provide a small visual confirmation
      // (replace with your toast/notification if you have one)
      setTimeout(() => alert('All local data cleared.'), 50);
    } catch (err) {
      console.error('clear all failed', err);
      alert('Failed to clear data. See console for details.');
    }
  }

  // Help button toggles help modal
  function toggleHelp() {
    setHelpVisible((s) => !s);
    setMenuOpen(false);
  }

  return (
    <div className="app">
      <header className="header panel">
        <div className="header__brand">
          <h1 className="header__title">{t('appTitle')}</h1>
          <div className="header__subtitle muted">Study smarter, iterate faster</div>
        </div>

        <div className="header__actions" ref={menuRef} style={{ position: 'relative' }}>
          {/* Language square button (cycles languages) */}
          <button
            className="btn btn--icon"
            onClick={(e) => { e.stopPropagation(); cycleLanguage(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t('language')}
            title={t('language')}
            style={{ marginRight: 8 }}
          >
            {i18n.language === 'en' ? 'EN' : i18n.language === 'ko' ? '한국' : '繁'}
          </button>

          {/* Help square button with "?" icon */}
          <button
            className="btn btn--icon"
            onClick={toggleHelp}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t('howToUseTitle')}
            title={t('howToUseTitle')}
            style={{ marginRight: 8 }}
          >
            ?
          </button>

          {/* donation button inserted here */}
          <DonateButton />

{/* Menu button + dropdown */}
<button
  className="btn btn--ghost"
  onClick={() => setMenuOpen((s) => !s)}
  onPointerDown={(e) => e.stopPropagation()}
  aria-haspopup="true"
  aria-expanded={menuOpen}
  aria-label="Open menu"
>
  Menu ▾
</button>

{/* Clear all button placed next to Menu */}
<button
  className="btn btn--ghost btn--danger-inline"
  onClick={() => {
    // open the same confirmation modal used by the menu item
    setMenuOpen(false);
    setClearConfirmInput('');
    setClearConfirmVisible(true);
  }}
  aria-label="Clear all data"
  title="Clear all local data"
  style={{ marginLeft: 8 }}
>
  Clear all
</button>

{menuOpen && (
  <div
    className="header__menu panel"
    style={{
      position: 'absolute',
      right: 0,
      top: 'calc(100% + 8px)',
      minWidth: 220,
      zIndex: 12050,        // ensure it's above other UI
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}
  >
    <button
      className="btn--link text-small"
      onClick={handleMenuReport}
      style={{ padding: '8px 10px', textAlign: 'left' }}
    >
      Report
    </button>

    <button
      className="btn--link text-small"
      onClick={() => { setMenuOpen(false); alert('Menu: Settings placeholder'); }}
      style={{ padding: '8px 10px', textAlign: 'left' }}
    >
      Settings
    </button>

    <button
      className="btn--link text-small"
      onClick={() => { setMenuOpen(false); alert('Menu: Help placeholder'); }}
      style={{ padding: '8px 10px', textAlign: 'left' }}
    >
      Help
    </button>

    {/* Clear all data (destructive) */}
<button
  className="btn--link text-small btn--danger"
  onClick={handleMenuClearAll}
  style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--danger)' }}
>
  Clear all data
</button>

  </div>
)}
        </div>
      </header>

      <main className="app__main">
        <aside className="sidebar panel">
          <DeckList
            onSelectDeck={(id) => setActiveDeckId(id)}
            activeDeckId={activeDeckId}
          />
        </aside>

        <section className="workspace panel">
          {activeDeckId ? (
            <StudyView deckId={activeDeckId} />
          ) : (
            <div className="workspace__empty">
              <h2 className="muted">Select a deck to start studying</h2>
              <p className="text-small muted">
                Create decks and cards from the editor. Study sessions and reports will appear here.
              </p>
            </div>
          )}
        </section>
      </main>

      {editorOpen && (
        <DeckEditor
          deckId={editorDeckId}
          onClose={() => setEditorOpen(false)}
          onSaved={(deck) => {
            setActiveDeckId(deck.id);
            setEditorOpen(false);
          }}
        />
      )}

      <footer className="footer muted text-small">
        © {new Date().getFullYear()} V2 Flashcard — Created by Vito. 
      </footer>

{/* Help modal (scrollable) */}
{helpVisible && (
  <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('howToUseTitle')} style={{ overflowY: 'auto' }}>
      <div
      className="panel"
      style={{
        maxWidth: 720,
        width: '92%',
        padding: 18,
        maxHeight: '80vh',     // limit height to viewport fraction
        overflowY: 'auto',     // enable internal scrolling
      }}
    >
      <h3 style={{ marginTop: 0 }}>{t('howToUseTitle')}</h3>

      <div style={{ marginTop: 8, lineHeight: 1.5 }}>
        <p><strong>{t('purposeTitle')}</strong></p>
        <p>{t('purposeText')}</p>

        <p><strong>{t('creditTitle')}</strong></p>
        <p>{t('creditText')}</p>

        <p><strong>{t('quickStepsTitle')}</strong></p>
        <ol>
          {[1,2,3,4,5].map((n) => (
            <li key={n}>{t(`step${n}`)}</li>
          ))}
        </ol>

        <p><strong>{t('notesTitle')}</strong></p>
        <ul>
          <li>{t('note1')}</li>
          <li>{t('note2')}</li>
        </ul>

        <p style={{ marginTop: 8 }}><strong>{t('plannedTitle')}</strong></p>
        <p>{t('plannedText')}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button className="btn btn--ghost" onClick={() => setHelpVisible(false)}>{t('close')}</button>
      </div>
    </div>
  </div>
)}


      {/* Clear all confirmation modal */}
      {clearConfirmVisible && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('clearAll')}>
          <div className="panel" style={{ maxWidth: 520, width: '92%', padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>{t('clearAll')}</h3>
            <p className="muted">This will erase all locally stored decks, sessions, and settings. This action cannot be undone.</p>

            <div style={{ marginTop: 12 }}>
              <label className="text-small">Type <code>clear all</code> to confirm</label>
              <input
                type="text"
                value={clearConfirmInput}
                onChange={(e) => setClearConfirmInput(e.target.value)}
                placeholder="Type clear all to confirm"
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn btn--ghost" onClick={() => { setClearConfirmVisible(false); setClearConfirmInput(''); }}>Cancel</button>
              <button
                className="btn btn--danger"
                onClick={performClearAll}
                disabled={clearConfirmInput.trim() !== 'clear all'}
                title={clearConfirmInput.trim() !== 'clear all' ? 'Type "clear all" to enable' : 'Clear all data'}
              >
                {t('clearAll')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

