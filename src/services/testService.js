// src/services/testService.js
import * as deckService from './deckService';
import * as storage from './storageService';

const RANKING_KEY_PREFIX = 'ranking:deck:';

function keyFor(deckId) {
  return `${RANKING_KEY_PREFIX}${deckId}`;
}

function toNumberSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isoDate(v = null) {
  try {
    return v ? new Date(v).toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeEntryRaw(raw) {
  // Accept raw values and coerce carefully without treating 0 as "missing"
  const score = toNumberSafe(raw.score, 0);
  const total = toNumberSafe(raw.total, 0);
  const durationMs = toNumberSafe(raw.durationMs, 0);
  const date = isoDate(raw.date || raw.createdAt || raw.finishedAt || null);

  return {
    id: raw.id || `r-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: (raw.name || 'Anonymous') + '',
    score,
    total,
    pct: total > 0 ? Math.round((score / total) * 100) : 0,
    durationMs,
    date
  };
}

function sortRanking(list) {
  return (list || []).slice().sort((a, b) => {
    // primary: pct desc
    if ((b.pct || 0) !== (a.pct || 0)) return (b.pct || 0) - (a.pct || 0);
    // secondary: duration asc (faster is better)
    if ((a.durationMs || 0) !== (b.durationMs || 0)) return (a.durationMs || 0) - (b.durationMs || 0);
    // tertiary: date asc (earlier first)
    const ta = new Date(a.date || a.createdAt || 0).getTime();
    const tb = new Date(b.date || b.createdAt || 0).getTime();
    return ta - tb;
  });
}

/* ---------- test deck helpers ---------- */
export async function createTestDeckFrom(deckId, { count, style } = {}) {
  const deck = await deckService.getDeck(deckId);
  if (!deck) throw new Error('Deck not found');
  let cards = (deck.cards || []).slice();

  if (style === 'B>A') cards = cards.slice().reverse();
  if (style === 'Mixed') {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  cards = cards.slice(0, Math.min(count || cards.length, cards.length));
  return { id: `test-${Date.now()}`, name: `${deck.name} (Test)`, cards };
}

export async function saveTestDeck(deckId, testDeck) {
  const id = `test-${Date.now()}`;
  const deck = {
    id,
    name: testDeck.name || 'Test Deck',
    meta: { system: false },
    cards: testDeck.cards || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await deckService.createDeck({ id: deck.id, name: deck.name, meta: deck.meta });
  for (const c of testDeck.cards || []) {
    await deckService.addCard(deck.id, { front: c.front, back: c.back, meta: c.meta || {} });
  }
  return deck;
}

/* ---------- ranking API (storage-backed) ---------- */

/**
 * Save a ranking entry for a deck.
 * Returns the saved entry (with id, pct, date).
 * Dispatches 'ranking-updated' after persistence.
 */
export async function saveRanking(deckId, { name, score, total, durationMs = 0, date = null }) {
  if (!deckId) throw new Error('deckId required');
  const key = keyFor(deckId);
  const list = await storage.load(key, []);

  // Build raw object and normalize explicitly
  const raw = {
    id: `r-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: name || 'Anonymous',
    score,
    total,
    durationMs,
    date
  };
  const entry = normalizeEntryRaw(raw);

  list.push(entry);
  const sorted = sortRanking(list);
  const top = sorted.slice(0, 50);
  await storage.save(key, top);

  // notify listeners immediately after persistence
  try {
    window.dispatchEvent(new CustomEvent('ranking-updated', { detail: { deckId } }));
  } catch (e) {
    // ignore dispatch errors
  }

  return entry;
}

/**
 * Get ranking list for a deck (returns array, already sorted).
 */
export async function getRanking(deckId) {
  if (!deckId) return [];
  const key = keyFor(deckId);
  const list = await storage.load(key, []);
  // Ensure each entry is normalized (fix older entries that might be missing fields)
  const normalized = (list || []).map((r) => normalizeEntryRaw(r));
  return sortRanking(normalized).slice(0, 50);
}

/**
 * Update an existing ranking entry by id.
 * Returns the updated entry.
 * Dispatches 'ranking-updated' after persistence.
 */
export async function updateRankingEntry(deckId, entryId, updates = {}) {
  if (!deckId || !entryId) throw new Error('deckId and entryId required');
  const key = keyFor(deckId);
  const list = await storage.load(key, []);
  const idx = list.findIndex((r) => r.id === entryId);
  if (idx === -1) throw new Error('entry not found');

  const existing = normalizeEntryRaw(list[idx]);
  const mergedRaw = {
    ...existing,
    // allow explicit zero values; use undefined check rather than falsy
    name: updates.name !== undefined ? updates.name : existing.name,
    score: updates.score !== undefined ? updates.score : existing.score,
    total: updates.total !== undefined ? updates.total : existing.total,
    durationMs: updates.durationMs !== undefined ? updates.durationMs : existing.durationMs,
    date: updates.date !== undefined ? updates.date : existing.date
  };

  const merged = normalizeEntryRaw(mergedRaw);

  list[idx] = merged;
  const sorted = sortRanking(list);
  await storage.save(key, sorted.slice(0, 50));

  // notify listeners immediately after persistence
  try {
    window.dispatchEvent(new CustomEvent('ranking-updated', { detail: { deckId } }));
  } catch (e) {}

  return merged;
}

/**
 * Delete a ranking entry by id.
 * Dispatches 'ranking-updated' after persistence.
 */
export async function deleteRankingEntry(deckId, entryId) {
  if (!deckId || !entryId) throw new Error('deckId and entryId required');
  const key = keyFor(deckId);
  const list = await storage.load(key, []);
  const filtered = list.filter((r) => r.id !== entryId);
  await storage.save(key, filtered.slice(0, 50));

  // notify listeners immediately after persistence
  try {
    window.dispatchEvent(new CustomEvent('ranking-updated', { detail: { deckId } }));
  } catch (e) {}

  return true;
}

/**
 * Clear all ranking entries for a deck.
 * Dispatches 'ranking-updated' after persistence.
 */
export async function clearRanking(deckId) {
  if (!deckId) throw new Error('deckId required');
  const key = keyFor(deckId);
  await storage.save(key, []);

  // notify listeners immediately after persistence
  try {
    window.dispatchEvent(new CustomEvent('ranking-updated', { detail: { deckId } }));
  } catch (e) {}

  return true;
}
