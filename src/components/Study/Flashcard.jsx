// src/components/Study/Flashcard.jsx
import React, { useEffect, useState } from 'react';
import '../../styles/components.css';

export default function Flashcard({
  card,
  onAnswer,
  flipSignal = 0,
  onToggleStar,
  flipDurationMs = 300,
  forcedFlipped,
  onRequestFlip
}) {
  const [internalFlipped, setInternalFlipped] = useState(false);

  useEffect(() => {
    // flipSignal indicates a requested flip (keyboard or programmatic)
    setInternalFlipped((f) => !f);
  }, [flipSignal]);

  const flipped = forcedFlipped === undefined ? internalFlipped : Boolean(forcedFlipped);

  function handleFlip() {
    if (forcedFlipped === undefined) {
      setInternalFlipped((f) => !f);
    } else if (typeof onRequestFlip === 'function') {
      onRequestFlip(card.id);
    }
  }

  function handleAnswer(quality) {
    if (typeof onAnswer === 'function') onAnswer(quality);
  }

  function handleToggleStar(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    if (typeof onToggleStar === 'function') onToggleStar(card);
  }

  const innerStyle = {
    transition: `transform ${Math.max(80, flipDurationMs)}ms ease`,
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={`card-star ${card.meta?.star ? 'active' : ''}`}
        onClick={handleToggleStar}
        aria-label="Toggle star"
        title={card.meta?.star ? 'Unstar' : 'Star'}
        style={{ position: 'absolute', right: 8, top: 8, zIndex: 10 }}
      >
        {card.meta?.star ? '★' : '☆'}
      </button>

      <div className={`flashcard ${flipped ? 'flashcard--flipped' : ''}`} style={{ perspective: 1200 }}>
        <div
          className="flashcard__inner"
          onClick={handleFlip}
          role="button"
          tabIndex={0}
          style={innerStyle}
        >
          <div className="flashcard__face flashcard__front">
            <div className="flashcard__text">{card.front}</div>
          </div>

          <div className="flashcard__face flashcard__back">
            <div className="flashcard__text">{card.back}</div>
          </div>
        </div>
      </div>

      <div className="flashcard-controls" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--small" onClick={() => handleAnswer(3)}>Done</button>
          <button className="btn btn--small btn--ghost" onClick={handleToggleStar}>Star</button>
          <button className="btn btn--small btn--ghost" onClick={handleFlip}>Flip</button>
          <button
            className="btn btn--nav btn--ghost"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))}
            aria-label="Previous"
          >
            ◀
          </button>
          <button
            className="btn btn--nav"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))}
            aria-label="Next"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
