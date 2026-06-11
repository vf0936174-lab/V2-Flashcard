// src/services/deckService.js
import * as storage from './storageService';

const DECK_INDEX_KEY = 'decks:index';
const ALL_STAR_ID = 'all-star-deck';

async function _ensureIndex() {
  const idx = await storage.load(DECK_INDEX_KEY, []);
  if (!Array.isArray(idx)) {
    await storage.save(DECK_INDEX_KEY, []);
    return [];
  }
  return idx;
}

async function _ensureAllStarDeck() {
  const existing = await storage.load(`deck:${ALL_STAR_ID}`, null);
  if (existing) return existing;

  const deck = {
    id: ALL_STAR_ID,
    name: 'All Star',
    meta: { system: true },
    cards: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await storage.save(`deck:${ALL_STAR_ID}`, deck);

  // ensure All Star is present in index (append at end)
  const idx = await _ensureIndex();
  if (!idx.includes(ALL_STAR_ID)) {
    idx.push(ALL_STAR_ID);
    await storage.save(DECK_INDEX_KEY, idx);
  }

  return deck;
}

function _emitDecksChanged() {
  try {
    window.dispatchEvent(new CustomEvent('decks-changed', { detail: { time: Date.now() } }));
  } catch (e) {
    // ignore in non-browser environments
  }
}

export async function getDecks() {
  const ids = await _ensureIndex();
  await _ensureAllStarDeck();
  const decks = await Promise.all(ids.map(async (id) => {
    const d = await storage.load(`deck:${id}`, null);
    return d;
  }));
  return decks.filter(Boolean);
}

export async function getDeck(deckId) {
  return storage.load(`deck:${deckId}`, null);
}

export async function createDeck({ id = null, name = 'New Deck', meta = {} } = {}) {
  const deckId = id || `deck-${Date.now()}`;
  const deck = {
    id: deckId,
    name,
    meta,
    cards: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await storage.save(`deck:${deckId}`, deck);
  const idx = await _ensureIndex();
  idx.unshift(deckId);
  const filtered = idx.filter((i) => i !== ALL_STAR_ID);
  const allStarExists = (await storage.load(`deck:${ALL_STAR_ID}`, null)) ? [ALL_STAR_ID] : [];
  await storage.save(DECK_INDEX_KEY, [...filtered, ...allStarExists]);
  _emitDecksChanged();
  return deck;
}

export async function deleteDeck(deckId) {
  if (deckId === ALL_STAR_ID) throw new Error('Cannot delete All Star deck');
  const idx = await _ensureIndex();
  const newIdx = idx.filter((i) => i !== deckId);
  await storage.save(DECK_INDEX_KEY, newIdx);
  await storage.remove(`deck:${deckId}`);
  _emitDecksChanged();
  return true;
}

export async function addCard(deckId, card) {
  const deck = await getDeck(deckId);
  if (!deck) throw new Error('Deck not found');
  const cardId = card.id || `card-${Date.now()}`;
  const newCard = {
    id: cardId,
    front: card.front || '',
    back: card.back || '',
    meta: card.meta || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  deck.cards.unshift(newCard);
  deck.updatedAt = new Date().toISOString();
  await storage.save(`deck:${deckId}`, deck);
  _emitDecksChanged();
  return newCard;
}

export async function updateCard(deckId, cardId, updates = {}) {
  const deck = await getDeck(deckId);
  if (!deck) throw new Error('Deck not found');
  const idx = deck.cards.findIndex((c) => c.id === cardId);
  if (idx === -1) throw new Error('Card not found');
  const old = deck.cards[idx];

  // ensure meta object exists before merging
  const safeOldMeta = old.meta || {};
  const safeUpdates = { ...updates };
  if (safeUpdates.meta && typeof safeUpdates.meta === 'object') {
    safeUpdates.meta = { ...(safeOldMeta || {}), ...safeUpdates.meta };
  } else if (!safeUpdates.meta) {
    safeUpdates.meta = { ...(safeOldMeta || {}) };
  }

  const merged = { ...old, ...safeUpdates, updatedAt: new Date().toISOString() };
  deck.cards[idx] = merged;
  deck.updatedAt = new Date().toISOString();
  await storage.save(`deck:${deckId}`, deck);

  // star change detection: treat undefined as false
  const oldStar = Boolean(safeOldMeta.star);
  const newStar = Boolean(merged.meta && merged.meta.star);
  if (oldStar !== newStar) {
    // pass owner deck id so All Star copy records origin
    await _syncAllStar(deckId, merged, newStar);
  }

  // emit after update so UI can refresh immediately
  _emitDecksChanged();
  return deck.cards[idx];
}

export async function removeCard(deckId, cardId) {
  const deck = await getDeck(deckId);
  if (!deck) throw new Error('Deck not found');
  deck.cards = deck.cards.filter((c) => c.id !== cardId);
  deck.updatedAt = new Date().toISOString();
  await storage.save(`deck:${deckId}`, deck);
  const all = await _ensureAllStarDeck();
  all.cards = all.cards.filter((c) => c.id !== cardId);
  await storage.save(`deck:${ALL_STAR_ID}`, all);
  _emitDecksChanged();
  return true;
}

async function _syncAllStar(ownerDeckId, card, add) {
  const all = await _ensureAllStarDeck();
  const exists = all.cards.find((c) => c.id === card.id);

  if (add) {
    if (!exists) {
      const copy = {
        ...card,
        meta: { ...(card.meta || {}), _originDeck: ownerDeckId },
        createdAt: card.createdAt,
        updatedAt: new Date().toISOString()
      };
      all.cards.unshift(copy);
      all.updatedAt = new Date().toISOString();
      await storage.save(`deck:${ALL_STAR_ID}`, all);
    } else {
      all.cards = all.cards.map((c) =>
        c.id === card.id ? { ...c, ...card, meta: { ...(card.meta || {}), _originDeck: c.meta?._originDeck || ownerDeckId }, updatedAt: new Date().toISOString() } : c
      );
      await storage.save(`deck:${ALL_STAR_ID}`, all);
    }
  } else {
    if (exists) {
      all.cards = all.cards.filter((c) => c.id !== card.id);
      all.updatedAt = new Date().toISOString();
      await storage.save(`deck:${ALL_STAR_ID}`, all);
    }
  }

  // emit after sync so UI can refresh All Star deck immediately
  _emitDecksChanged();
}

export async function importDeck(json) {
  const obj = typeof json === 'string' ? JSON.parse(json) : json;
  if (!obj || !obj.name || !Array.isArray(obj.cards)) {
    throw new Error('Invalid deck format');
  }
  const deck = await createDeck({ name: obj.name, meta: obj.meta || {} });
  for (const c of obj.cards) {
    await addCard(deck.id, { front: c.front || '', back: c.back || '', meta: c.meta || {} });
  }
  return getDeck(deck.id);
}

export async function exportDeck(deckId) {
  const deck = await getDeck(deckId);
  if (!deck) throw new Error('Deck not found');
  const exportObj = {
    id: deck.id,
    name: deck.name,
    meta: deck.meta || {},
    cards: deck.cards.map((c) => ({ id: c.id, front: c.front, back: c.back, meta: c.meta || {}, createdAt: c.createdAt })),
    exportedAt: new Date().toISOString()
  };
  return exportObj;
}

export async function getStarred(deckId) {
  const deck = await getDeck(deckId);
  if (!deck) return [];
  return (deck.cards || []).filter((c) => Boolean(c.meta && c.meta.star));
}
