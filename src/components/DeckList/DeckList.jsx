// src/components/DeckList/DeckList.jsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as deckService from '../../services/deckService';
import DeckEditor from '../Editor/DeckEditor';
import '../../styles/components.css';

export default function DeckList({ onSelectDeck, activeDeckId }) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCreateMode, setEditorCreateMode] = useState(false);
  const [editingDeck, setEditingDeck] = useState(null);

  async function loadDecks() {
    setLoading(true);
    try {
      const ds = await deckService.getDecks();
      setDecks(ds || []);
    } catch (err) {
      console.error('loadDecks error', err);
      setDecks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    loadDecks();

    function onDecksChanged() {
      if (!mounted) return;
      loadDecks();
    }

    window.addEventListener('decks-changed', onDecksChanged);
    window.addEventListener('decks-cleared', onDecksChanged);
    return () => {
      mounted = false;
      window.removeEventListener('decks-changed', onDecksChanged);
      window.removeEventListener('decks-cleared', onDecksChanged);
    };
  }, []);

  function openCreateDeck() {
    setEditorCreateMode(true);
    setEditingDeck(null);
    setEditorOpen(true);
  }

  function openEditDeck(deck) {
    setEditorCreateMode(false);
    setEditingDeck(deck);
    setEditorOpen(true);
  }

  async function handleDelete(deckId) {
    const ok = window.confirm('Delete this deck? This cannot be undone.');
    if (!ok) return;
    try {
      await deckService.deleteDeck(deckId);
      await loadDecks();
      if (activeDeckId === deckId && typeof onSelectDeck === 'function') onSelectDeck(null);
      try { window.dispatchEvent(new CustomEvent('decks-changed')); } catch (e) {}
    } catch (err) {
      console.error('deleteDeck failed', err);
      alert('Delete failed');
    }
  }

  async function handleExport(deckId) {
    try {
      const obj = await deckService.exportDeck(deckId);
      const json = JSON.stringify(obj, null, 2);
      const safeName = (obj.name || 'deck').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'deck';

      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined' && document.createElement) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeName}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        alert('Deck JSON downloaded');
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json);
        alert('Deck JSON copied to clipboard');
      } else {
        const w = window.open('', '_blank');
        w.document.write(`<pre>${json.replace(/</g, '&lt;')}</pre>`);
        w.document.close();
      }
    } catch (err) {
      console.error('exportDeck failed', err);
      alert('Export failed: ' + (err?.message || 'unknown'));
    }
  }

  async function handleRename(deck) {
    const name = window.prompt('Rename deck to:', deck?.name || '');
    if (!name) return;
    try {
      await deckService.renameDeck(deck.id, name);
      await loadDecks();
      try { window.dispatchEvent(new CustomEvent('decks-changed')); } catch (e) {}
    } catch (err) {
      console.error('renameDeck failed', err);
      alert('Rename failed');
    }
  }

  // Render DeckEditor into document.body so modal is not constrained by sidebar width
  function renderEditorPortal() {
    if (!editorOpen) return null;

    const deckIdProp = editorCreateMode ? null : (editingDeck ? editingDeck.id : null);

    return createPortal(
      <DeckEditor
        deckId={deckIdProp}
        onClose={() => {
          setEditorOpen(false);
          setEditorCreateMode(false);
          setEditingDeck(null);
          loadDecks();
        }}
        onSaved={(d) => {
          setEditorOpen(false);
          setEditorCreateMode(false);
          setEditingDeck(null);
          loadDecks();
          try { window.dispatchEvent(new CustomEvent('decks-changed')); } catch (e) {}
          if (editorCreateMode && d && d.id && typeof onSelectDeck === 'function') {
            onSelectDeck(d.id);
          }
        }}
      />,
      document.body
    );
  }

  function starredCount(deck) {
    if (!deck || !Array.isArray(deck.cards)) return 0;
    return deck.cards.reduce((acc, c) => acc + ((c && c.meta && c.meta.star) ? 1 : 0), 0);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Decks</h3>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(Boolean(e.target.checked))} />
            <span className="text-small muted">Edit</span>
          </label>

          <button className="btn btn--small" onClick={openCreateDeck}>New</button>
        </div>
      </div>

      <div className="sidebar__list" style={{ marginTop: 12 }}>
        {loading ? (
          <div className="muted text-small">Loading decks…</div>
        ) : decks.length === 0 ? (
          <div className="muted text-small">No decks yet. Create one to get started.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {decks.map((d) => {
              const isActive = d.id === activeDeckId;
              const stars = starredCount(d);
              return (
                <li
                  key={d.id}
                  className={`deck-item ${isActive ? 'active' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  <button
                    className={`btn--link deck-button ${isActive ? 'deck-button--active' : ''}`}
                    onClick={() => typeof onSelectDeck === 'function' && onSelectDeck(d.id)}
                    aria-label={`Open deck ${d.name}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>{d.name}</div>
                      {stars > 0 && (
                        <div className="deck-star-badge" title={`${stars} starred`}>
                          <span className="star-icon">★</span>
                          <span className="star-count">{stars}</span>
                        </div>
                      )}
                    </div>
                    <div className="muted text-small">{(d.cards && d.cards.length) || 0} cards</div>
                  </button>

                  {/* Actions moved below the deck name; link-style to match deck name visual */}
                  {editMode && (
                    <div className="deck-actions" style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 2 }}>
                      {/* rename button is removed for now      <button className="btn--link text-small muted" onClick={() => handleRename(d)} aria-label={`Rename ${d.name}`}>Rename</button> */}
                      <button className="btn--link text-small muted" onClick={() => handleExport(d.id)} aria-label={`Export ${d.name}`}>Export</button>
                      <button className="btn--link text-small muted btn--danger" onClick={() => handleDelete(d.id)} aria-label={`Delete ${d.name}`}>Delete</button>
                      <button className="btn--link text-small muted" onClick={() => openEditDeck(d)} aria-label={`Edit ${d.name}`}>Edit</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {renderEditorPortal()}
    </div>
  );
}
