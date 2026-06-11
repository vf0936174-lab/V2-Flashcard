// src/components/Study/TestPrepModal.jsx
import React, { useState } from 'react';

export default function TestPrepModal({ deck, onClose, onSave }) {
  const [count, setCount] = useState(deck?.cards?.length || 0);
  const [style, setStyle] = useState('A>B'); // 'A>B' | 'B>A' | 'Mixed'
  const [saveName, setSaveName] = useState(`${deck?.name || 'Deck'} (Test)`);

  return (
    <div className="modal-overlay">
      <div className="modal panel" style={{ maxWidth: 520 }}>
        <h3>Prepare Test</h3>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="text-small muted">Questions</label>
          <input type="number" min="1" max={deck?.cards?.length || 999} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          <div className="text-small muted" style={{ marginLeft: 8 }}>{deck?.cards?.length || 0} available</div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="text-small muted">Style</label>
          <div className="row" style={{ marginTop: 6 }}>
            <button className={`btn btn--small ${style === 'A>B' ? 'active' : ''}`} onClick={() => setStyle('A>B')}>A&gt;B</button>
            <button className={`btn btn--small ${style === 'B>A' ? 'active' : ''}`} onClick={() => setStyle('B>A')}>B&gt;A</button>
            <button className={`btn btn--small ${style === 'Mixed' ? 'active' : ''}`} onClick={() => setStyle('Mixed')}>Mixed</button>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="text-small muted">Save as (optional)</label>
          <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onSave({ count, style, saveName })}>Save Test Deck</button>
        </div>
      </div>
    </div>
  );
}
