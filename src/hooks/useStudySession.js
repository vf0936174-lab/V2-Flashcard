// useStudySession.js
import { useEffect, useRef, useState } from 'react';
import * as deckService from '../services/deckService';
import * as studyService from '../services/studyService';
import * as reportService from '../services/reportService';

export default function useStudySession(initialDeckId) {
  const [deck, setDeck] = useState(null);
  const [session, setSession] = useState(null);
  const [currentCard, setCurrentCard] = useState(null);
  const sessionRef = useRef(null);

  async function loadDeckAndSession(deckId) {
    const d = await deckService.getDeck(deckId);
    setDeck(d);
    const s = studyService.createSession(d || { id: deckId, cards: [] });
    s.queue.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    sessionRef.current = s;
    setSession(s);
    setCurrentCard(studyService.nextCard(s));
  }

  useEffect(() => {
    if (!initialDeckId) return;
    loadDeckAndSession(initialDeckId);
  }, [initialDeckId]);

  function goToIndex(idx) {
    if (!sessionRef.current) return;
    if (idx < 0) idx = 0;
    if (idx >= sessionRef.current.queue.length) idx = sessionRef.current.queue.length - 1;
    sessionRef.current.index = idx;
    setSession({ ...sessionRef.current });
    setCurrentCard(sessionRef.current.queue[idx] || null);
  }

  function nextCardLocal() {
    if (!sessionRef.current) return;
    goToIndex(Math.min(sessionRef.current.index + 1, sessionRef.current.queue.length - 1));
  }

  function prevCardLocal() {
    if (!sessionRef.current) return;
    goToIndex(Math.max(sessionRef.current.index - 1, 0));
  }

  async function recordAnswer(cardId, quality) {
    if (!sessionRef.current) return;
    studyService.recordAnswer(sessionRef.current, cardId, quality);
    setSession({ ...sessionRef.current });
    await studyService.persistSession(sessionRef.current);
    const next = studyService.nextCard(sessionRef.current);
    if (!next) {
      await studyService.endSession(sessionRef.current);
      await reportService.logSession(sessionRef.current);
      setCurrentCard(null);
      return null;
    }
    setCurrentCard(next);
    return next;
  }

  // authoritative toggleStar: same logic you already have, but centralized
  async function toggleStarAuthoritative(card) {
    // (copy the canonical logic from your working toggleStar)
    // find owner deck, resolve origin, read authoritative meta, call deckService.updateCard(...)
    // after update, refresh sessionRef.current queue entries and setSession/setCurrentCard
    // return newMeta or throw on error
    // For brevity, assume you paste your existing toggleStar body here.
  }

  // expose API
  return {
    deck,
    session,
    currentCard,
    sessionRef,
    setDeck,
    loadDeckAndSession,
    goToIndex,
    nextCardLocal,
    prevCardLocal,
    recordAnswer,
    toggleStarAuthoritative
  };
}
