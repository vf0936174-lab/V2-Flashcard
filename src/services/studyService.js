// src/services/studyService.js
import * as deckService from './deckService';
import * as storage from './storageService';

const SESSION_PREFIX = 'session:';

export function createSession(deck, options = {}) {
  const queue = (deck.cards || []).map((c) => ({
    ...c,
    // scheduling metadata (defaults)
    interval: c.meta?.interval || 0,
    easeFactor: c.meta?.easeFactor || 2.5,
    repetitions: c.meta?.repetitions || 0,
    due: c.meta?.due || Date.now()
  }));

  return {
    id: `session-${Date.now()}`,
    deckId: deck.id,
    startedAt: new Date().toISOString(),
    options,
    queue,
    index: 0,
    logs: []
  };
}

export function nextCard(session) {
  if (!session) return null;
  // find next due card starting from index
  for (let i = session.index; i < session.queue.length; i++) {
    const card = session.queue[i];
    if (!card.due || card.due <= Date.now()) {
      session.index = i;
      return card;
    }
  }
  // none due, return null
  return null;
}

/**
 * recordAnswer updates scheduling metadata using a simplified SM-2 algorithm.
 * quality: 0-5 (0 = again, 3 = good, 5 = easy)
 */
export function recordAnswer(session, cardId, quality) {
  const cardIdx = session.queue.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) throw new Error('Card not in session queue');
  const card = session.queue[cardIdx];

  // SM-2 simplified
  if (quality < 3) {
    card.repetitions = 0;
    card.interval = 1;
  } else {
    card.repetitions = (card.repetitions || 0) + 1;
    if (card.repetitions === 1) card.interval = 1;
    else if (card.repetitions === 2) card.interval = 6;
    else card.interval = Math.round(card.interval * (card.easeFactor || 2.5));
  }

  // adjust ease factor
  const ef = card.easeFactor || 2.5;
  const newEf = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  card.easeFactor = newEf;

  // set next due (in ms)
  const nextDue = Date.now() + card.interval * 24 * 60 * 60 * 1000;
  card.due = nextDue;

  // log
  session.logs.push({ cardId, quality, time: Date.now(), nextDue });

  // advance index to next card
  session.index = session.index + 1;

  return card;
}

export async function persistSession(session) {
  if (!session || !session.id) throw new Error('Invalid session');
  await storage.save(SESSION_PREFIX + session.id, session);
  return true;
}

export async function loadSession(sessionId) {
  return storage.load(SESSION_PREFIX + sessionId, null);
}

export async function endSession(session) {
  session.endedAt = new Date().toISOString();
  await persistSession(session);
  // Optionally update deck metadata for each card
  try {
    const deck = await deckService.getDeck(session.deckId);
    if (deck) {
      // merge scheduling metadata back into deck cards
      const map = new Map(session.queue.map((c) => [c.id, c]));
      deck.cards = deck.cards.map((c) => {
        const s = map.get(c.id);
        if (!s) return c;
        return {
          ...c,
          meta: {
            ...c.meta,
            interval: s.interval,
            easeFactor: s.easeFactor,
            repetitions: s.repetitions,
            due: s.due
          }
        };
      });
      await storage.save(`deck:${deck.id}`, deck);
    }
  } catch (err) {
    console.warn('studyService.endSession: failed to merge deck metadata', err);
  }
  return session;
}
