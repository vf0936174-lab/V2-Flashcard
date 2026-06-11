// src/components/Study/RankingBoard.jsx
import React, { useEffect, useRef, useState } from 'react';
import * as testService from '../../services/testService';
import '../../styles/components.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankingBoard({ deckId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  // global edit toggle
  const [editMode, setEditMode] = useState(false);

  // per-entry editing state
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ name: '', score: 0, total: 0, date: '' });

  async function load() {
    if (!deckId) {
      setList([]);
      return;
    }
    setLoading(true);
    try {
      const r = await testService.getRanking(deckId);
      const top = Array.isArray(r) ? r.slice(0, 10) : [];
      if (mountedRef.current) setList(top);
    } catch (err) {
      console.error('RankingBoard load error', err);
      if (mountedRef.current) setList([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    load();

    function onUpdate(e) {
      if (e && e.detail && e.detail.deckId && e.detail.deckId !== deckId) return;
      load();
    }

    window.addEventListener('ranking-updated', onUpdate);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('ranking-updated', onUpdate);
    };
  }, [deckId]);

  function beginEdit(entry) {
    setEditingId(entry.id);
    setEditValues({
      name: entry.name || '',
      score: Number(entry.score || 0),
      total: Number(entry.total || 0),
      date: entry.date ? new Date(entry.date).toISOString().slice(0, 19) : new Date().toISOString().slice(0, 19)
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({ name: '', score: 0, total: 0, date: '' });
  }

  async function saveEdit() {
    if (!editingId) return;
    const updates = {
      name: (editValues.name || '').trim(),
      score: Number(editValues.score) || 0,
      total: Number(editValues.total) || 0,
      date: editValues.date ? new Date(editValues.date).toISOString() : new Date().toISOString()
    };

    try {
      await testService.updateRankingEntry(deckId, editingId, updates);
      await load();
      try { window.dispatchEvent(new CustomEvent('ranking-updated', { detail: { deckId } })); } catch (e) {}
      cancelEdit();
    } catch (err) {
      console.error('Failed to save ranking edit', err);
      await load();
      cancelEdit();
    }
  }

  async function deleteEntry(id) {
    if (!id) return;
    if (!window.confirm('Delete this ranking entry?')) return;
    try {
      await testService.deleteRankingEntry(deckId, id);
      await load();
      try { window.dispatchEvent(new CustomEvent('ranking-updated', { detail: { deckId } })); } catch (e) {}
    } catch (err) {
      console.error('Failed to delete ranking entry', err);
      await load();
    }
  }

  async function clearAll() {
    if (!window.confirm('Clear all ranking results for this deck?')) return;
    try {
      await testService.clearRanking(deckId);
      await load();
      try { window.dispatchEvent(new CustomEvent('ranking-updated', { detail: { deckId } })); } catch (e) {}
    } catch (err) {
      console.error('Failed to clear ranking', err);
      await load();
    }
  }

  function formatPct(entry) {
    if (!entry || !entry.total) return '—';
    const pct = Math.round((entry.score / entry.total) * 100);
    return `${pct}%`;
  }

  function formatTime(entry) {
    const t = entry?.date || entry?.createdAt || entry?.finishedAt;
    if (!t) return '—';
    try {
      const d = new Date(t);
      return d.toLocaleString();
    } catch {
      return String(t);
    }
  }

  function formatDuration(entry) {
    // Prefer explicit durationMs if present; otherwise try to infer from date fields (not required)
    const ms = Number(entry?.durationMs || entry?.duration || 0);
    if (!ms || ms <= 0) return '—';
    let totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    totalSec = totalSec % 3600;
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}min`);
    // show seconds if any seconds exist or if minutes and hours are zero
    if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h4 style={{ margin: 0 }}>Top Scores</h4>

          {/* Edit toggle switch */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6 }}>
            <input
              type="checkbox"
              checked={editMode}
              onChange={(e) => {
                setEditMode(Boolean(e.target.checked));
                if (!e.target.checked) cancelEdit();
              }}
              aria-label="Toggle edit mode"
            />
            <span className="text-small muted">Edit</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="text-small muted">{list.length} shown</div>
          {editMode && (
            <button className="btn btn--ghost" onClick={clearAll} aria-label="Clear all rankings">Clear All</button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        {loading ? (
          <div className="muted text-small">Loading…</div>
        ) : list.length === 0 ? (
          <div className="muted text-small">No results yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <th style={{ width: 56, padding: '8px 6px' }}>Place</th>
                <th style={{ padding: '8px 6px' }}>Name</th>
                <th style={{ width: 120, padding: '8px 6px' }}>Score</th>
                <th style={{ width: 100, padding: '8px 6px' }}>Correct</th>
                <th style={{ width: 120, padding: '8px 6px' }}>Time Spent</th>
                <th style={{ width: 180, padding: '8px 6px' }}>Finished</th>
                <th style={{ width: 140, padding: '8px 6px', textAlign: 'right' }}> </th>
              </tr>
            </thead>

            <tbody>
              {list.map((r, i) => {
                const place = i + 1;
                const isEditing = editMode && editingId === r.id;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 18 }}>{MEDALS[i] || place}</div>
                      </div>
                    </td>

                    <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                      {isEditing ? (
                        <input
                          value={editValues.name}
                          onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                          style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}
                        />
                      ) : (
                        <div style={{ fontWeight: 700 }}>{r.name || 'Anonymous'}</div>
                      )}
                    </td>

                    <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="number"
                            min="0"
                            value={editValues.score}
                            onChange={(e) => setEditValues((v) => ({ ...v, score: Number(e.target.value || 0) }))}
                            style={{ width: 70, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}
                          />
                          <span style={{ alignSelf: 'center' }}>/</span>
                          <input
                            type="number"
                            min="1"
                            value={editValues.total}
                            onChange={(e) => setEditValues((v) => ({ ...v, total: Number(e.target.value || 0) }))}
                            style={{ width: 70, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}
                          />
                        </div>
                      ) : (
                        <div style={{ fontWeight: 700 }}>{r.score}/{r.total}</div>
                      )}
                    </td>

                    <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                      <div className="muted text-small">{formatPct(r)}</div>
                    </td>

                    <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                      <div className="muted text-small">{formatDuration(r)}</div>
                    </td>

                    <td style={{ padding: '10px 6px', verticalAlign: 'middle' }}>
                      <div className="muted text-small">{formatTime(r)}</div>
                    </td>

                    <td style={{ padding: '10px 6px', verticalAlign: 'middle', textAlign: 'right' }}>
                      {editMode ? (
                        isEditing ? (
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn--ghost" onClick={cancelEdit}>Cancel</button>
                            <button className="btn" onClick={saveEdit}>Save</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn--ghost" onClick={() => beginEdit(r)}>Edit</button>
                            <button className="btn btn--ghost" onClick={() => deleteEntry(r.id)}>Delete</button>
                          </div>
                        )
                      ) : (
                        <div className="muted text-small"> </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
