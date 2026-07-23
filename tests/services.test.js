import test from 'node:test';
import assert from 'node:assert/strict';

import * as deckService from '../src/services/deckService.js';
import * as reportService from '../src/services/reportService.js';
import * as studyService from '../src/services/studyService.js';
import * as studentService from '../src/services/studentService.js';
import * as testService from '../src/services/testService.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  get length() {
    return this.store.size;
  }

  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function resetBrowserMocks() {
  globalThis.localStorage = new MemoryStorage();
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.window = {
    events: [],
    dispatchEvent(event) {
      this.events.push(event);
      return true;
    }
  };
}

test.beforeEach(() => {
  resetBrowserMocks();
});

test('updateDeck preserves card ids and metadata while changing card text', async () => {
  const deck = await deckService.createDeck({ id: 'deck-preserve', name: 'Original' });

  const firstSave = await deckService.updateDeck(deck.id, {
    name: 'Original',
    cards: [
      {
        id: 'card-1',
        front: 'front',
        back: 'back',
        meta: { star: true, due: 123, repetitions: 2 }
      }
    ]
  });

  const updated = await deckService.updateDeck(deck.id, {
    name: 'Renamed',
    cards: [
      {
        id: firstSave.cards[0].id,
        front: 'changed front',
        back: 'changed back'
      }
    ]
  });

  assert.equal(updated.name, 'Renamed');
  assert.equal(updated.cards[0].id, 'card-1');
  assert.equal(updated.cards[0].front, 'changed front');
  assert.equal(updated.cards[0].meta.star, true);
  assert.equal(updated.cards[0].meta.due, 123);
  assert.equal(updated.cards[0].meta.repetitions, 2);
  assert.equal(updated.schemaVersion, 1);
  assert.equal(updated.cards[0].schemaVersion, 1);
});

test('createTestDeckFrom swaps front and back for B>A tests', async () => {
  const deck = await deckService.createDeck({ id: 'deck-test-style', name: 'Vocabulary' });
  await deckService.updateDeck(deck.id, {
    cards: [
      { id: 'card-a', front: 'front side', back: 'back side' }
    ]
  });

  const testDeck = await testService.createTestDeckFrom(deck.id, { count: 1, style: 'B>A' });

  assert.equal(testDeck.cards.length, 1);
  assert.equal(testDeck.cards[0].front, 'back side');
  assert.equal(testDeck.cards[0].back, 'front side');
  assert.equal(testDeck.cards[0].meta.testDirection, 'B>A');
});

test('All Star sync keeps cards separated by origin deck', async () => {
  const deckA = await deckService.createDeck({ id: 'deck-a', name: 'Deck A' });
  const deckB = await deckService.createDeck({ id: 'deck-b', name: 'Deck B' });

  await deckService.updateDeck(deckA.id, {
    cards: [
      { id: 'same-card-id', front: 'a front', back: 'a back', meta: { star: true } }
    ]
  });
  await deckService.updateDeck(deckB.id, {
    cards: [
      { id: 'same-card-id', front: 'b front', back: 'b back', meta: { star: true } }
    ]
  });

  await deckService.updateCard(deckA.id, 'same-card-id', { meta: { star: false } });

  const allStar = await deckService.getDeck('all-star-deck');
  const remaining = allStar.cards.filter((card) => card.id === 'same-card-id');

  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].front, 'b front');
  assert.equal(remaining[0].meta._originDeck, deckB.id);
});

test('persistSession tracks active sessions and endSession clears them', async () => {
  const deck = await deckService.createDeck({ id: 'deck-session', name: 'Session deck' });
  await deckService.updateDeck(deck.id, {
    cards: [
      { id: 'card-session', front: 'front', back: 'back' }
    ]
  });

  const savedDeck = await deckService.getDeck(deck.id);
  const session = studyService.createSession(savedDeck);

  await studyService.persistSession(session);
  const active = await studyService.loadActiveSession(deck.id);

  assert.equal(active.id, session.id);
  assert.equal(active.deckId, deck.id);

  await studyService.endSession(session);
  const ended = await studyService.loadActiveSession(deck.id);

  assert.equal(ended, null);
});

test('studentService bulk adds names, dedupes them, and removes by id', async () => {
  const added = await studentService.addStudents('Alice\nBob\nalice\n  Carol  ');

  assert.deepEqual(added.map((student) => student.name), ['Alice', 'Bob', 'Carol']);
  assert.equal(added[0].schemaVersion, 1);

  const next = await studentService.removeStudent(added[1].id);

  assert.deepEqual(next.map((student) => student.name), ['Alice', 'Carol']);
});

test('saveRanking keeps student identity for report filtering', async () => {
  const entry = await testService.saveRanking('deck-ranking-student', {
    name: 'Alice',
    studentId: 'student-alice',
    studentName: 'Alice',
    score: 8,
    total: 10,
    durationMs: 12000,
    date: '2026-01-04T00:00:00.000Z'
  });

  const ranking = await testService.getRanking('deck-ranking-student');

  assert.equal(entry.studentId, 'student-alice');
  assert.equal(ranking[0].studentName, 'Alice');
  assert.equal(ranking[0].pct, 80);
});

test('buildReportInsights summarizes quality and weak cards', () => {
  const reports = [
    {
      id: 'session-1',
      deckId: 'deck-report',
      startedAt: '2026-01-01T00:00:00.000Z',
      logs: [
        { cardId: 'card-weak', quality: 1, time: Date.parse('2026-01-01T00:01:00.000Z') },
        { cardId: 'card-good', quality: 5, time: Date.parse('2026-01-01T00:02:00.000Z') }
      ]
    },
    {
      id: 'session-2',
      deckId: 'deck-report',
      startedAt: '2026-01-02T00:00:00.000Z',
      logs: [
        { cardId: 'card-weak', quality: 2, time: Date.parse('2026-01-02T00:01:00.000Z') }
      ]
    }
  ];
  const decks = [
    {
      id: 'deck-report',
      name: 'Report Deck',
      cards: [
        { id: 'card-weak', front: 'hard', back: 'difficult' },
        { id: 'card-good', front: 'easy', back: 'simple' }
      ]
    }
  ];

  const insights = reportService.buildReportInsights(reports, decks);

  assert.equal(insights.sessionCount, 2);
  assert.equal(insights.answerCount, 3);
  assert.equal(insights.lowQualityCount, 2);
  assert.equal(insights.qualityCounts[1], 1);
  assert.equal(insights.qualityCounts[2], 1);
  assert.equal(insights.qualityCounts[5], 1);
  assert.equal(insights.weakCards[0].cardId, 'card-weak');
  assert.equal(insights.weakCards[0].label, 'hard / difficult');
  assert.equal(insights.recentSessions[0].id, 'session-2');
});

test('buildStudentTestInsights filters tests by student and finds weak decks', () => {
  const rankings = [
    { id: 'r-1', name: 'Alice', studentName: 'Alice', deckId: 'deck-a', deckName: 'Animals', score: 6, total: 10, pct: 60, date: '2026-01-01T00:00:00.000Z' },
    { id: 'r-2', name: 'Alice', studentName: 'Alice', deckId: 'deck-b', deckName: 'Food', score: 9, total: 10, pct: 90, date: '2026-01-02T00:00:00.000Z' },
    { id: 'r-3', name: 'Bob', studentName: 'Bob', deckId: 'deck-a', deckName: 'Animals', score: 10, total: 10, pct: 100, date: '2026-01-03T00:00:00.000Z' }
  ];

  const insights = reportService.buildStudentTestInsights(rankings, 'Alice');

  assert.equal(insights.testCount, 2);
  assert.equal(insights.avgPct, 75);
  assert.equal(insights.bestPct, 90);
  assert.equal(insights.recentPct, 90);
  assert.equal(insights.weakDecks[0].deckName, 'Animals');
  assert.equal(insights.recentTests[0].id, 'r-2');
});
