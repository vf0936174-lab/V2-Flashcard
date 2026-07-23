// src/services/deckService.js
import * as storage from './storageService.js';

const DECK_INDEX_KEY = 'decks:index';
const ALL_STAR_ID = 'all-star-deck';
const DECK_SCHEMA_VERSION = 1;
const CARD_SCHEMA_VERSION = 1;

function _createCardId(index = 0) {
  return `card-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
}

function _isTemporaryCardId(id) {
  return !id || String(id).startsWith('tmp-');
}

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
    schemaVersion: DECK_SCHEMA_VERSION,
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
  await _ensureAllStarDeck();
  const ids = await _ensureIndex();
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
    schemaVersion: DECK_SCHEMA_VERSION,
    name,
    meta,
    cards: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await storage.save(`deck:${deckId}`, deck);
  const idx = await _ensureIndex();
  const filtered = idx.filter((i) => i !== deckId && i !== ALL_STAR_ID);
  const allStarExists = (await storage.load(`deck:${ALL_STAR_ID}`, null)) ? [ALL_STAR_ID] : [];
  await storage.save(DECK_INDEX_KEY, [deckId, ...filtered, ...allStarExists]);
  _emitDecksChanged();
  return deck;
}

export async function updateDeck(deckId, updates = {}) {
  const existing = await getDeck(deckId);
  if (!existing) throw new Error('Deck not found');

  const now = new Date().toISOString();
  const nextDeck = {
    ...existing,
    schemaVersion: DECK_SCHEMA_VERSION,
    name: updates.name !== undefined ? String(updates.name || '').trim() || 'Untitled' : existing.name,
    meta: updates.meta ? { ...(existing.meta || {}), ...updates.meta } : (existing.meta || {}),
    updatedAt: now
  };

  if (Array.isArray(updates.cards)) {
    const existingById = new Map((existing.cards || []).map((card) => [card.id, card]));
    const usedIds = new Set();

    nextDeck.cards = updates.cards.map((card, index) => {
      const incomingId = !_isTemporaryCardId(card.id) ? card.id : null;
      const oldCard = incomingId ? existingById.get(incomingId) : null;
      let cardId = incomingId || _createCardId(index);

      while (usedIds.has(cardId)) {
        cardId = _createCardId(index);
      }
      usedIds.add(cardId);

      return {
        id: cardId,
        schemaVersion: CARD_SCHEMA_VERSION,
        front: card.front || '',
        back: card.back || '',
        meta: { ...(oldCard?.meta || {}), ...(card.meta || {}) },
        createdAt: oldCard?.createdAt || card.createdAt || now,
        updatedAt: now
      };
    });
  }

  await storage.save(`deck:${deckId}`, nextDeck);

  if (deckId !== ALL_STAR_ID && Array.isArray(updates.cards)) {
    await _syncAllStarForDeck(deckId, nextDeck.cards || []);
  }

  _emitDecksChanged();
  return nextDeck;
}

export async function renameDeck(deckId, name) {
  return updateDeck(deckId, { name });
}

export async function deleteDeck(deckId) {
  if (deckId === ALL_STAR_ID) throw new Error('Cannot delete All Star deck');
  const deck = await getDeck(deckId);
  const idx = await _ensureIndex();
  const newIdx = idx.filter((i) => i !== deckId);
  await storage.save(DECK_INDEX_KEY, newIdx);
  await storage.remove(`deck:${deckId}`);

  const all = await _ensureAllStarDeck();
  const deckCardIds = new Set((deck?.cards || []).map((c) => c.id));
  const nextAllCards = (all.cards || []).filter((c) => {
    const originDeck = c.meta?._originDeck;
    if (originDeck) return originDeck !== deckId;
    return !deckCardIds.has(c.id);
  });
  if (nextAllCards.length !== (all.cards || []).length) {
    all.cards = nextAllCards;
    all.updatedAt = new Date().toISOString();
    await storage.save(`deck:${ALL_STAR_ID}`, all);
  }

  _emitDecksChanged();
  return true;
}

export async function addCard(deckId, card) {
  const deck = await getDeck(deckId);
  if (!deck) throw new Error('Deck not found');
  const cardId = !_isTemporaryCardId(card.id) ? card.id : _createCardId();
  const newCard = {
    id: cardId,
    schemaVersion: CARD_SCHEMA_VERSION,
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
  if (newStar) {
    await _syncAllStar(deckId, merged, true);
  } else if (oldStar !== newStar) {
    // pass owner deck id so All Star copy records origin
    await _syncAllStar(deckId, merged, false);
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
  all.cards = all.cards.filter((c) => {
    const originDeck = c.meta?._originDeck;
    return !(c.id === cardId && (!originDeck || originDeck === deckId));
  });
  await storage.save(`deck:${ALL_STAR_ID}`, all);
  _emitDecksChanged();
  return true;
}

async function _syncAllStarForDeck(ownerDeckId, ownerCards) {
  const all = await _ensureAllStarDeck();
  const starredById = new Map(
    (ownerCards || [])
      .filter((card) => Boolean(card.meta && card.meta.star))
      .map((card) => [card.id, card])
  );

  let changed = false;
  all.cards = (all.cards || []).filter((card) => {
    const originDeck = card.meta?._originDeck;
    if (originDeck !== ownerDeckId) return true;
    if (starredById.has(card.id)) return true;
    changed = true;
    return false;
  });

  for (const card of starredById.values()) {
    const existingIdx = all.cards.findIndex((c) => c.id === card.id && c.meta?._originDeck === ownerDeckId);
    const copy = {
      ...card,
      meta: { ...(card.meta || {}), _originDeck: ownerDeckId },
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      all.cards[existingIdx] = copy;
    } else {
      all.cards.unshift(copy);
    }
    changed = true;
  }

  if (changed) {
    all.updatedAt = new Date().toISOString();
    await storage.save(`deck:${ALL_STAR_ID}`, all);
  }
}

async function _syncAllStar(ownerDeckId, card, add) {
  const all = await _ensureAllStarDeck();
  const existingIdx = all.cards.findIndex((c) => {
    const originDeck = c.meta?._originDeck;
    return c.id === card.id && (!originDeck || originDeck === ownerDeckId);
  });

  if (add) {
    if (existingIdx === -1) {
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
      const existing = all.cards[existingIdx];
      all.cards[existingIdx] = {
        ...existing,
        ...card,
        meta: { ...(card.meta || {}), _originDeck: existing.meta?._originDeck || ownerDeckId },
        updatedAt: new Date().toISOString()
      };
      await storage.save(`deck:${ALL_STAR_ID}`, all);
    }
  } else {
    if (existingIdx !== -1) {
      all.cards = all.cards.filter((c) => {
        const originDeck = c.meta?._originDeck;
        return !(c.id === card.id && (!originDeck || originDeck === ownerDeckId));
      });
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
    schemaVersion: deck.schemaVersion || DECK_SCHEMA_VERSION,
    name: deck.name,
    meta: deck.meta || {},
    cards: deck.cards.map((c) => ({
      id: c.id,
      schemaVersion: c.schemaVersion || CARD_SCHEMA_VERSION,
      front: c.front,
      back: c.back,
      meta: c.meta || {},
      createdAt: c.createdAt
    })),
    exportedAt: new Date().toISOString()
  };
  return exportObj;
}

export async function getStarred(deckId) {
  const deck = await getDeck(deckId);
  if (!deck) return [];
  return (deck.cards || []).filter((c) => Boolean(c.meta && c.meta.star));
}
