// src/components/Editor/CardEditor.jsx
import React, { useState, useEffect } from 'react';

export default function CardEditor({ card: initial = {}, onChange, onRemove }) {
  const [front, setFront] = useState(initial.front || '');
  const [back, setBack] = useState(initial.back || '');

  useEffect(() => {
    if (typeof onChange === 'function') {
      onChange({ ...initial, front, back });
    }
  }, [front, back]);

  return (
    <div className="panel glass-accent" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="text-small muted">Card</div>
        {onRemove && (
          <button
            className="btn btn--ghost btn--small"
            onClick={onRemove}
            aria-label="Remove card"
          >
            Remove
          </button>
        )}
      </div>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Front (question, prompt)"
          rows={2}
          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', background: 'transparent', color: 'var(--fg)' }}
        />
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Back (answer, notes)"
          rows={3}
          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', background: 'transparent', color: 'var(--fg)' }}
        />
      </div>
    </div>
  );
}
