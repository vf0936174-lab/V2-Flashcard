// src/components/DeckList/DeckItem.jsx
import React from 'react';

export default function DeckItem({ deck, active = false, onClick, onDelete, onExport }) {
  const total = (deck.cards || []).length;
  const starred = (deck.cards || []).filter((c) => c.meta && c.meta.star).length;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`deck-item ${active ? 'deck-item--active' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      aria-pressed={active}
    >
      <div>
        <div className="deck-item__title">{deck.name}</div>
        <div className="deck-item__meta text-small muted">
          <span>{total} cards</span>
          {starred > 0 && <span style={{ marginLeft: 8 }}>• ⭐ {starred}</span>}
        </div>
      </div>

      <div className="row">
        <button
          className="btn btn--ghost"
          onClick={(e) => { e.stopPropagation(); onExport && onExport(); }}
          aria-label={`Export ${deck.name}`}
        >
          Export
        </button>

        <button
          className="btn btn--ghost"
          onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
          aria-label={`Delete ${deck.name}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
