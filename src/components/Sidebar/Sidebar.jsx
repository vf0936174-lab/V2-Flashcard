// src/components/Sidebar/Sidebar.jsx
import React from 'react';
import DeckList from '../DeckList/DeckList';
import RankingBoard from '../Study/RankingBoard';
import '../../styles/components.css';

export default function Sidebar({ selectedDeckId, onSelectDeck }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h4 className="sidebar-title">Decks</h4>
        <DeckList onSelectDeck={onSelectDeck} activeDeckId={selectedDeckId} />
      </div>

      <div className="sidebar-section" style={{ marginTop: 12 }}>
        <h4 className="sidebar-title">Top Scores</h4>
        <RankingBoard deckId={selectedDeckId} />
      </div>
    </aside>
  );
}
