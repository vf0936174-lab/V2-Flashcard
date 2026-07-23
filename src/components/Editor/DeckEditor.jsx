// src/components/Editor/DeckEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import CardEditor from './CardEditor';
import * as deckService from '../../services/deckService';
import { useTranslation } from 'react-i18next';

export default function DeckEditor({ deckId = null, onClose, onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState(deckId ? '' : t('newDeck'));
  const [cards, setCards] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(deckId));
  const pasteRef = useRef();

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deckId) return;
      setLoading(true);
      const d = await deckService.getDeck(deckId);
      if (!mounted) return;
      if (d) {
        setName(d.name || 'Untitled');
        setCards((d.cards || []).map((c) => ({ ...c })));
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [deckId]);

  function updateCardAt(i, updated) {
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...updated } : c)));
  }

  function addCard() {
    setCards((prev) => [...prev, { id: `tmp-${Date.now()}`, front: '', back: '' }]);
    // focus last card's front by scrolling to bottom
    setTimeout(() => {
      const el = document.querySelector('.panel .card-editor-focus');
      if (el) el.focus();
    }, 50);
  }

  function removeCardAt(i) {
    setCards((prev) => prev.filter((_, idx) => idx !== i));
  }

  function parsePasteText(text) {
    // Accept TSV or tab/space separated two columns. Each line -> one card.
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      // split by tab first, then by multiple spaces
      let parts = line.split('\t');
      if (parts.length === 1) parts = line.split(/\s{2,}/);
      if (parts.length === 1) parts = line.split(/\s+/);
      const front = (parts[0] || '').trim();
      const back = (parts[1] || '').trim();
      if (front || back) parsed.push({ id: `tmp-${Date.now()}-${parsed.length}`, front, back });
    }
    return parsed;
  }

  function handlePasteParse() {
    const raw = pasteRef.current?.value || '';
    if (!raw.trim()) {
      alert(t('pasteAlert'));
      return;
    }
    const parsed = parsePasteText(raw);
    if (parsed.length === 0) {
      alert(t('noValidRowsAlert'));
      return;
    }
    setCards((prev) => [...prev, ...parsed]);
    // clear paste area
    pasteRef.current.value = '';
  }

  function handleCopyAtoB() {
    // For each card, if back is empty, copy front -> back
    setCards((prev) => prev.map((c) => ({ ...c, back: c.back || c.front })));
  }

  async function handleSave() {
    setSaving(true);
    try {
      let deck;
      if (deckId) {
        deck = await deckService.updateDeck(deckId, { name, cards });
      } else {
        deck = await deckService.createDeck({ name });
        deck = await deckService.updateDeck(deck.id, { cards });
      }

      if (typeof onSaved === 'function') onSaved(deck);
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      console.error('DeckEditor.save error', err);
      alert(t('failedToSaveDeck', { message: err.message }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', zIndex: 1200, padding: 20
    }}>
      <div className="panel" style={{ width: 'min(980px, 96%)', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>{deckId ? t('editDeck') : t('newDeck')}</h3>
            <div className="text-small muted">{t('createCardsAndSave')}</div>
          </div>

          <div className="row">
            <button className="btn btn--ghost" onClick={onClose}>{t('close')}</button>
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? t('savingEllipsis') : t('saveDeck')}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="text-small muted">{t('deckName')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', background: 'transparent', color: 'var(--fg)' }}
            />

            <div style={{ marginTop: 12 }}>
              <label className="text-small muted">{t('pasteTwoColumnsTitle')}</label>
              <textarea
                ref={pasteRef}
                placeholder={t('pasteTwoColumnsDesc')}
                rows={4}
                style={{ width: '100%', padding: 8, marginTop: 6, borderRadius: 8 }}
              />
              <div style={{ marginTop: 8 }} className="row">
                <button className="btn" onClick={handlePasteParse}>{t('parsePasteAddCards')}</button>
                <button className="btn btn--ghost" onClick={handleCopyAtoB} style={{ marginLeft: 8 }}>{t('copyAToB')}</button>
                <button className="btn btn--ghost" onClick={addCard} style={{ marginLeft: 8 }}>{t('addCard')}</button>
              </div>
            </div>
          </div>

          <div style={{ width: 160 }}>
            <div className="text-small muted">{t('cardsLabel')}</div>
            <div style={{ marginTop: 8 }}>
              <div className="muted text-small">{t('cardsCount', { count: cards.length })}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          {loading ? (
            <div className="muted text-small">{t('loadingDeck')}</div>
          ) : cards.length === 0 ? (
            <div className="muted text-small">{t('noCardsYet')}</div>
          ) : (
            cards.map((c, i) => (
              <div key={c.id || i}>
                <CardEditor
                  card={c}
                  onChange={(updated) => updateCardAt(i, updated)}
                  onRemove={() => removeCardAt(i)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
