// src/components/Study/StudyView.jsx
import React, { useEffect, useRef, useState } from 'react';
import Flashcard from './Flashcard';
import TestPrepModal from './TestPrepModal';
import RankingBoard from './RankingBoard';
import * as deckService from '../../services/deckService';
import * as studyService from '../../services/studyService';
import * as reportService from '../../services/reportService';
import * as testService from '../../services/testService';
import * as studentService from '../../services/studentService';
import DeckEditor from '../Editor/DeckEditor';
import {
  showEncouragementRight,
  showComboRight,
  showStarToast,
  smallConfettiBurst,
  longConfettiBurst,
  fireworksBurst,
  floatingEmoji
} from '../../utils/visuals';
import '../../styles/components.css';

export default function StudyView({ deckId }) {
  const [deck, setDeck] = useState(null);
  const [session, setSession] = useState(null);
  const [currentCard, setCurrentCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const sessionRef = useRef(null);
  const currentCardRef = useRef(null);

  const [globalFlipMap, setGlobalFlipMap] = useState({});
  const [allFlipped, setAllFlipped] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [flipSignal, setFlipSignal] = useState(0);
  const [flipDuration, setFlipDuration] = useState(300);
  const lastKeyTimeRef = useRef(0);

  const [studyStarredMode, setStudyStarredMode] = useState(false);
  const normalSessionBackup = useRef(null);
  const comboRef = useRef(0);

  const [testPrepOpen, setTestPrepOpen] = useState(false);
  const [testDeck, setTestDeck] = useState(null);
  const testDeckRef = useRef(null);
  const [testMode, setTestMode] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testCountdown, setTestCountdown] = useState(null);
  const [testIndex, setTestIndex] = useState(0);
  const testIndexRef = useRef(0);
  const [testScore, setTestScore] = useState(0);
  const testScoreRef = useRef(0); // synchronous ref for final save
  const [testStartTime, setTestStartTime] = useState(null);
  const [testResultsVisible, setTestResultsVisible] = useState(false);
  const [testStudentName, setTestStudentName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [students, setStudents] = useState([]);
  const [perCardSeconds, setPerCardSeconds] = useState(15);
  const [perCardRemaining, setPerCardRemaining] = useState(15);
  const perCardTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const [starPoolActive, setStarPoolActive] = useState(false);
  const studentInputRef = useRef(null);

  // Prevent double finish / re-entrancy when timers and user actions race
  const testFinishedRef = useRef(false);

  function prepareFreshSession(deckData) {
    const s = studyService.createSession(deckData || { id: deckId, cards: [] });
    s.queue = Array.isArray(s.queue) ? s.queue : [];
    s.queue.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    s.index = Math.max(0, Math.min(s.index || 0, Math.max(0, s.queue.length - 1)));
    return s;
  }

  function reconcileSavedSession(savedSession, deckData) {
    if (!savedSession || !Array.isArray(savedSession.queue)) {
      return prepareFreshSession(deckData);
    }

    const fresh = prepareFreshSession(deckData);
    const freshById = new Map(fresh.queue.map((card) => [card.id, card]));
    const queue = savedSession.queue
      .map((savedCard) => {
        const currentCardData = freshById.get(savedCard.id);
        if (!currentCardData) return null;
        return {
          ...currentCardData,
          interval: savedCard.interval ?? currentCardData.interval,
          easeFactor: savedCard.easeFactor ?? currentCardData.easeFactor,
          repetitions: savedCard.repetitions ?? currentCardData.repetitions,
          due: savedCard.due ?? currentCardData.due
        };
      })
      .filter(Boolean);

    const savedIds = new Set(queue.map((card) => card.id));
    const newCards = fresh.queue.filter((card) => !savedIds.has(card.id));
    const nextQueue = [...queue, ...newCards];

    return {
      ...savedSession,
      queue: nextQueue,
      logs: Array.isArray(savedSession.logs) ? savedSession.logs : [],
      index: Math.max(0, Math.min(savedSession.index || 0, Math.max(0, nextQueue.length - 1)))
    };
  }

  function setActiveSession(nextSession) {
    sessionRef.current = nextSession;
    setSession(nextSession);
    setCurrentCard((nextSession.queue && nextSession.queue.length > 0) ? nextSession.queue[nextSession.index] : null);
  }

  useEffect(() => { testIndexRef.current = testIndex; }, [testIndex]);
  useEffect(() => { testDeckRef.current = testDeck; }, [testDeck]);
  useEffect(() => { currentCardRef.current = currentCard; }, [currentCard]);

  useEffect(() => {
    const cls = 'app-test-mode';
    if (testMode) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => { document.body.classList.remove(cls); };
  }, [testMode]);

  useEffect(() => {
    let mounted = true;

    async function loadStudents() {
      try {
        const list = await studentService.getStudents();
        if (mounted) setStudents(list);
      } catch (err) {
        console.error('load students failed', err);
        if (mounted) setStudents([]);
      }
    }

    loadStudents();
    window.addEventListener('students-changed', loadStudents);
    return () => {
      mounted = false;
      window.removeEventListener('students-changed', loadStudents);
    };
  }, []);

  function findStudentByName(name) {
    const clean = String(name || '').trim().toLocaleLowerCase();
    if (!clean) return null;
    return students.find((student) => student.name.toLocaleLowerCase() === clean) || null;
  }

  function handleStudentSelect(name) {
    const student = students.find((item) => item.name === name) || null;
    setSelectedStudentId(student?.id || null);
    setTestStudentName(name);
  }

  function handleStudentNameChange(name) {
    const student = findStudentByName(name);
    setSelectedStudentId(student?.id || null);
    setTestStudentName(name);
  }

useEffect(() => {
  let mounted = true;
  async function init() {
    setLoading(true);
    const d = await deckService.getDeck(deckId);
    const saved = await studyService.loadActiveSession(deckId);
    if (!mounted) return;
    setDeck(d);

    const s = saved ? reconcileSavedSession(saved, d || { id: deckId, cards: [] }) : prepareFreshSession(d || { id: deckId, cards: [] });
    setActiveSession(s);
    await studyService.persistSession(s).catch(() => {});

    setGlobalFlipMap({});
    setAllFlipped(false);
    setStudyStarredMode(false);
    normalSessionBackup.current = null;
    setLoading(false);
  }
  init();

  async function onDecksChanged() {
    // reload deck and reconcile session queue with authoritative deck cards
    try {
      const d = await deckService.getDeck(deckId);
      if (!mounted) return;
      if (!d) {
        setDeck(null);
        setSession(null);
        setCurrentCard(null);
        sessionRef.current = null;
        return;
      }
      setDeck(d);

      if (sessionRef.current && Array.isArray(sessionRef.current.queue)) {
        // Build a map of authoritative cards and merge meta
        if (d && Array.isArray(d.cards)) {
          const map = new Map(d.cards.map((c) => [c.id, c]));
          sessionRef.current.queue = sessionRef.current.queue
            .map((q) => {
              const latest = map.get(q.id);
              if (!latest) return null;
              return { ...q, ...latest, interval: q.interval, easeFactor: q.easeFactor, repetitions: q.repetitions, due: q.due };
            })
            .filter(Boolean);
        }

        // Ensure index is still valid after any queue changes
        sessionRef.current.index = Math.max(0, Math.min(sessionRef.current.index || 0, Math.max(0, sessionRef.current.queue.length - 1)));
        setSession({ ...sessionRef.current });
        setCurrentCard(sessionRef.current.queue[sessionRef.current.index] || null);
        studyService.persistSession(sessionRef.current).catch(() => {});
      }
    } catch (err) {
      console.error('onDecksChanged error', err);
    }
  }

  window.addEventListener('decks-changed', onDecksChanged);
  return () => {
    mounted = false;
    window.removeEventListener('decks-changed', onDecksChanged);
    clearInterval(perCardTimerRef.current);
    clearInterval(countdownTimerRef.current);
  };
}, [deckId]);


function goToIndex(idx) {
  if (!sessionRef.current) return;
  if (!Array.isArray(sessionRef.current.queue) || sessionRef.current.queue.length === 0) {
    sessionRef.current.index = 0;
    setSession({ ...sessionRef.current });
    setCurrentCard(null);
    return;
  }
  if (idx < 0) idx = 0;
  if (idx >= sessionRef.current.queue.length) idx = sessionRef.current.queue.length - 1;
  sessionRef.current.index = idx;
  const card = sessionRef.current.queue[idx] || null;
  setCurrentCard(card);
  setSession({ ...sessionRef.current });
}

function nextCardLocal() {
  if (!sessionRef.current || !Array.isArray(sessionRef.current.queue)) return;
  const nextIdx = Math.min((sessionRef.current.index || 0) + 1, sessionRef.current.queue.length - 1);
  goToIndex(nextIdx);
}

function prevCardLocal() {
  if (!sessionRef.current || !Array.isArray(sessionRef.current.queue)) return;
  const prevIdx = Math.max((sessionRef.current.index || 0) - 1, 0);
  goToIndex(prevIdx);
}

  const encouragementPool = [
    'Nice! 🎉', 'Great! 👍', 'Awesome! 😍', 'Well done! ✅', 'Perfect! 🎯', 'You got it! 🙌',
    'Sweet! 🍬', 'Boom! 💥', 'Love it! ❤️', 'Brilliant! ✨', 'Fantastic! 🚀', 'Superb! 🏆',
    'Legendary! 🦸', 'Incredible! 🌈', 'Terrific! 🥳', 'Excellent recall!', 'Solid work!',
    'Smart move', 'That’s progress', 'Memory boosted', 'Nailed it', 'Tiny victory', 'High five ✋',
    'Brain flex 🧠', 'Quick thinking', 'Clever!', 'Spot on!', 'Good memory!', 'You’re getting better!'
  ];
  function pickShortEncouragement() {
    const i = Math.floor(Math.random() * encouragementPool.length);
    return encouragementPool[i];
  }
  function buildComboMessage(combo) {
    if (!combo || combo < 2) return '';
    if (combo >= 5) return `${combo} correct in a row — Legendary! 🏆`;
    if (combo >= 3) return `${combo} correct in a row — Nice streak! 🔥`;
    return `${combo} correct in a row — Keep it up! ✨`;
  }

async function handleAnswer(cardId, quality) {
  if (!sessionRef.current) return;

  // Snapshot before any mutation
  const prevQueue = Array.isArray(sessionRef.current.queue) ? sessionRef.current.queue : [];
  const prevIndex = typeof sessionRef.current.index === 'number' ? sessionRef.current.index : 0;
  const prevCard = prevQueue[prevIndex] || null;

  // Defensive: ensure cardId corresponds to visible card
  if (!cardId && prevCard) cardId = prevCard.id;
  if (!cardId) return;

  // Record answer (may mutate sessionRef.current.queue/index)
  try {
    studyService.recordAnswer(sessionRef.current, cardId, quality);
    setSession({ ...sessionRef.current });
    // persist but don't block UI; still await to reduce race windows
    await studyService.persistSession(sessionRef.current).catch(() => {});
  } catch (err) {
    console.error('recordAnswer error', err);
  }

  // Recompute authoritative queue and find answered card position
  const q = Array.isArray(sessionRef.current.queue) ? sessionRef.current.queue : [];
  const foundIdx = q.findIndex((c) => c && c.id === cardId);

  // Determine next index robustly
  let nextIdx;
  if (foundIdx >= 0) {
    nextIdx = foundIdx + 1;
  } else {
    // If answered card was removed, continue from prevIndex clamped to bounds
    nextIdx = Math.min(prevIndex, Math.max(0, q.length - 1));
  }

  // If session finished (no next card)
  if (!q || q.length === 0 || nextIdx >= q.length) {
    try {
      await studyService.endSession(sessionRef.current);
      await reportService.logSession(sessionRef.current);
    } catch (err) {
      console.error('endSession/logSession error', err);
    }

    sessionRef.current.index = 0;
    setSession({ ...sessionRef.current });
    setCurrentCard(null);

    // Session completion visuals (keeps your original effects)
    const cardEl = document.querySelector('.flashcard');
    const rect = cardEl ? cardEl.getBoundingClientRect() : null;
    longConfettiBurst(rect);
    showEncouragementRight('Session complete! 🎉', { anchorRect: rect });

    // reset combo
    comboRef.current = 0;
    return;
  }

  // Advance to next card
  sessionRef.current.index = nextIdx;
  setSession({ ...sessionRef.current });
  const nextCard = q[nextIdx] || null;
  setCurrentCard(nextCard);

  // --- Original visual effects preserved ---
  // combo handling: increment only for quality >= 3, otherwise reset
  if (quality >= 3) {
    comboRef.current = (comboRef.current || 0) + 1;
    const combo = comboRef.current;

    // short encouragement (random)
    const short = pickShortEncouragement();
    const cardEl = document.querySelector('.flashcard');
    const rect = cardEl ? cardEl.getBoundingClientRect() : null;
    try {
      showEncouragementRight(short, { anchorRect: rect });

      // combo message if applicable (keeps your original showComboRight)
      if (combo >= 2) {
        const comboMsg = buildComboMessage(combo);
        // showComboRight is assumed to exist (keeps original placement/animation)
        if (typeof showComboRight === 'function') {
          showComboRight(comboMsg, { anchorRect: rect });
        } else {
          // fallback: show as a second encouragement
          showEncouragementRight(comboMsg, { anchorRect: rect, timeout: 2200 });
        }
      }

      // confetti burst (small)
      smallConfettiBurst(rect);
    } catch (e) {
      // swallow visual errors so study flow is unaffected
      console.warn('visual effect error', e);
    }
  } else {
    comboRef.current = 0;
  }
}


  async function toggleStar(cardParam) {
    try {
      const visibleCard = cardParam && cardParam.id ? cardParam : currentCardRef.current;
      if (!visibleCard) {
        showStarToast('No card selected');
        return;
      }

      let ownerDeck = await deckService.getDeck(deckId);
      let freshOwner = ownerDeck ? await deckService.getDeck(ownerDeck.id) : null;
      let target = freshOwner ? freshOwner.cards.find((c) => c.id === visibleCard.id) : null;

      if (!target) {
        const decks = await deckService.getDecks();
        for (const d of decks) {
          if (!d || !Array.isArray(d.cards)) continue;
          const found = d.cards.find((c) => c.id === visibleCard.id);
          if (found) {
            ownerDeck = d;
            freshOwner = await deckService.getDeck(d.id);
            target = freshOwner.cards.find((c) => c.id === visibleCard.id);
            break;
          }
        }
      }

      if (!freshOwner || !target) {
        showStarToast('Star action failed');
        return;
      }

      const currentlyStarred = Boolean(target.meta && target.meta.star);
      const newStar = !currentlyStarred;
      const newMeta = { ...(target.meta || {}), star: newStar };

      await deckService.updateCard(freshOwner.id, target.id, { meta: newMeta });

      if (freshOwner.id === deckId) {
        const reloaded = await deckService.getDeck(deckId);
        if (reloaded) {
          const newSession = studyService.createSession(reloaded || { id: deckId, cards: [] });
          newSession.queue.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          const newIndex = newSession.queue.findIndex((c) => c.id === visibleCard.id);
          newSession.index = newIndex >= 0 ? newIndex : 0;
          sessionRef.current = newSession;
          setSession(newSession);
          setCurrentCard(newSession.queue[newSession.index] || null);
        }
      } else {
        if (sessionRef.current && Array.isArray(sessionRef.current.queue)) {
          sessionRef.current.queue = sessionRef.current.queue.map((q) => (q.id === target.id ? { ...q, meta: newMeta } : q));
          setSession({ ...sessionRef.current });
          if (currentCardRef.current && currentCardRef.current.id === target.id) {
            setCurrentCard((prev) => ({ ...prev, meta: newMeta }));
          }
        }
      }

      showStarToast(newStar ? 'Starred' : 'Unstarred');
    } catch (err) {
      console.error('toggleStar error', err);
      showStarToast('Star action failed');
    }
  }

  function toggleCardFlip(cardId) {
    setGlobalFlipMap((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }
  function flipCurrent() {
    if (!currentCardRef.current) return;
    if (allFlipped) {
      toggleCardFlip(currentCardRef.current.id);
    } else {
      setFlipSignal((s) => s + 1);
    }
  }
  function adjustFlipSpeed() {
    const now = Date.now();
    const last = lastKeyTimeRef.current || 0;
    const delta = last ? now - last : 300;
    lastKeyTimeRef.current = now;
    const dur = Math.max(80, Math.min(600, Math.round(600 - (600 - 80) * Math.max(0, (500 - delta) / 500))));
    setFlipDuration(dur);
  }

  useEffect(() => {
    function onKey(e) {
      const active = document.activeElement;
      const activeTag = (active && active.tagName) || '';

      if ((activeTag === 'INPUT' || activeTag === 'TEXTAREA') && active !== studentInputRef.current) return;

      const code = e.code || '';
      const key = e.key || '';

      if (code === 'Space' || key === ' ') {
        e.preventDefault();
        const card = currentCardRef.current;
        if (card) toggleStar(card);
        return;
      }

      if (code === 'ArrowRight' || key === 'ArrowRight' || key === 'Right') {
        e.preventDefault();
        if (testMode && testRunning) {
          moveToNextTestCard();
        } else {
          nextCardLocal();
        }
        return;
      }

      if (code === 'ArrowLeft' || key === 'ArrowLeft' || key === 'Left') {
        e.preventDefault();
        if (!testMode || !testRunning) {
          prevCardLocal();
        }
        return;
      }

      if (code === 'ArrowDown' || key === 'ArrowDown' || key === 'Down') {
        e.preventDefault();
        if (testMode && testRunning) {
          handleTestMarkDone();
          return;
        }
        const cur = currentCardRef.current;
        if (!cur) return;
        handleAnswer(cur.id, 3);
        return;
      }

      if (code === 'ArrowUp' || key === 'ArrowUp' || key === 'Up') {
        e.preventDefault();
        adjustFlipSpeed();
        if (allFlipped) {
          const c = currentCardRef.current;
          if (c) toggleCardFlip(c.id);
        } else {
          setFlipSignal((s) => s + 1);
        }
        return;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allFlipped, testMode, testRunning]);

  function toggleFlipAll() {
    if (!sessionRef.current) return;
    const newAll = !allFlipped;
    setAllFlipped(newAll);
    const map = {};
    sessionRef.current.queue.forEach((c) => { map[c.id] = newAll; });
    setGlobalFlipMap(map);
    showStarToast(newAll ? 'All flipped' : 'All reset');
  }
  function shuffleQueue() {
    if (!sessionRef.current) return;
    setShuffling(true);
    const q = [...sessionRef.current.queue];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    sessionRef.current.queue = q;
    sessionRef.current.index = 0;
    setSession({ ...sessionRef.current });
    setCurrentCard(sessionRef.current.queue[0] || null);
    setGlobalFlipMap({});
    setAllFlipped(false);
    setTimeout(() => setShuffling(false), 300);
    showStarToast('Shuffled');
  }
  async function restartSession() {
    if (!deck) return;
    const s = prepareFreshSession(deck);
    setActiveSession(s);
    await studyService.persistSession(s).catch(() => {});
    setGlobalFlipMap({});
    setAllFlipped(false);
    setStudyStarredMode(false);
    normalSessionBackup.current = null;
    setStarPoolActive(false);
  }

  async function toggleStarPool() {
    if (starPoolActive) {
      if (normalSessionBackup.current) {
        sessionRef.current = {
          ...normalSessionBackup.current,
          queue: normalSessionBackup.current.queue.map((c) => ({ ...c }))
        };
        setSession(sessionRef.current);
        const idx = Math.max(0, Math.min(sessionRef.current.index || 0, sessionRef.current.queue.length - 1));
        sessionRef.current.index = idx;
        setCurrentCard(sessionRef.current.queue[idx] || null);
      }
      normalSessionBackup.current = null;
      setStudyStarredMode(false);
      setStarPoolActive(false);
      showStarToast('Returned to full deck');
      return;
    }

    try {
      const d = await deckService.getDeck(deckId);
      if (!d || !Array.isArray(d.cards)) {
        showStarToast('No deck loaded');
        return;
      }

      const starred = d.cards.filter((c) => c.meta && c.meta.star);
      if (!starred || starred.length === 0) {
        showStarToast('No starred cards in this deck');
        return;
      }

      if (sessionRef.current) {
        normalSessionBackup.current = {
          index: sessionRef.current.index || 0,
          queue: sessionRef.current.queue.map((c) => ({ ...c }))
        };
      } else {
        normalSessionBackup.current = null;
      }

      const tempDeck = {
        id: `${deckId}-star-pool`,
        name: `${d.name} (Star pool)`,
        cards: starred.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          meta: { ...(c.meta || {}) },
          createdAt: c.createdAt || Date.now()
        }))
      };

      const s = studyService.createSession(tempDeck);
      s.queue.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      s.index = 0;
      sessionRef.current = s;
      setSession(s);
      setCurrentCard(studyService.nextCard(s));
      setStudyStarredMode(true);
      setStarPoolActive(true);
      showStarToast(`Studying ${tempDeck.cards.length} starred card(s)`);
    } catch (err) {
      console.error('toggleStarPool error', err);
      showStarToast('Failed to load starred cards');
    }
  }

  async function openPrepareTest() { setTestPrepOpen(true); }
  async function handleSavePreparedTest({ count, style, saveName }) {
    setTestPrepOpen(false);
    const td = await testService.createTestDeckFrom(deckId, { count, style });
    td.name = saveName || td.name;
    setTestDeck(td);
    testDeckRef.current = td;
    showStarToast('Test prepared');
  }
  function beginTestCountdown() {
    const preparedDeck = testDeckRef.current || testDeck;
    if (!preparedDeck || !Array.isArray(preparedDeck.cards) || preparedDeck.cards.length === 0) {
      showStarToast('No cards available for test');
      setTestCountdown(null);
      return;
    }

    setTestCountdown(3);
    let c = 3;
    clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      c -= 1;
      setTestCountdown(c > 0 ? c : 0);
      if (c <= 0) {
        clearInterval(countdownTimerRef.current);
        setTestCountdown(null);
        startTestRun();
      }
    }, 1000);
  }
  function startTest() {
    if (!testDeck) {
      testService.createTestDeckFrom(deckId, { count: deck?.cards?.length || 0, style: 'A>B' }).then((td) => {
        setTestDeck(td);
        testDeckRef.current = td;
        beginTestCountdown();
      }).catch((err) => {
        console.error('startTest failed', err);
        showStarToast('Failed to prepare test');
      });
    } else {
      beginTestCountdown();
    }
  }
  function resetTestState() {
    setTestScore(0);
    testScoreRef.current = 0;
    setTestIndex(0);
    testIndexRef.current = 0;
    setTestResultsVisible(false);
    setTestRunning(false);
    setTestStartTime(null);
    setPerCardRemaining(perCardSeconds);
    clearInterval(perCardTimerRef.current);
    perCardTimerRef.current = null;
    clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    testFinishedRef.current = false; // reset finished flag
  }
  function startPerCardTimer() {
    clearInterval(perCardTimerRef.current);
    setPerCardRemaining(perCardSeconds);
    perCardTimerRef.current = setInterval(() => {
      setPerCardRemaining((r) => {
        if (r <= 1) {
          clearInterval(perCardTimerRef.current);
          perCardTimerRef.current = null;
          handleAutoPass();
          return perCardSeconds;
        }
        return r - 1;
      });
    }, 1000);
  }
  function startTestRun() {
    resetTestState();
    testFinishedRef.current = false; // ensure flag cleared at start
    setTestRunning(true);
    setTestStartTime(Date.now());
    setTestIndex(0);
    testIndexRef.current = 0;
    setPerCardRemaining(perCardSeconds);
    setTimeout(() => startPerCardTimer(), 250);
  }
  function handleAutoPass() {
    // if already finished, ignore auto-pass
    if (testFinishedRef.current) return;
    moveToNextTestCard();
  }

  function handleTestMarkDone() {
    // if already finished, ignore user action
    if (testFinishedRef.current) return;

    // update both state and ref
    setTestScore((s) => {
      const ns = s + 1;
      testScoreRef.current = ns;
      return ns;
    });

    const cardEl = document.querySelector('.flashcard');
    const rect = cardEl ? cardEl.getBoundingClientRect() : null;
    showEncouragementRight(pickShortEncouragement(), { anchorRect: rect });
    smallConfettiBurst(rect);

    moveToNextTestCard();
  }

  function moveToNextTestCard() {
    // guard against re-entrancy if finish already started
    if (testFinishedRef.current) return;

    // stop per-card timer for the current card
    clearInterval(perCardTimerRef.current);
    perCardTimerRef.current = null;

    // compute next index using ref to avoid stale closures
    const next = (testIndexRef.current || 0) + 1;
    if (!testDeckRef.current || next >= (testDeckRef.current.cards.length || 0)) {
      // mark finished and call finishTest once
      finishTest();
      return;
    }

    // advance index
    setTestIndex(next);
    testIndexRef.current = next;

    // reset per-card timer for next card
    setPerCardRemaining(perCardSeconds);
    setTimeout(() => startPerCardTimer(), 250);
  }

  async function finishTest() {
    // prevent double finish
    if (testFinishedRef.current) return;
    testFinishedRef.current = true;

    // stop timers immediately
    clearInterval(perCardTimerRef.current);
    perCardTimerRef.current = null;
    clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;

    // stop running state so UI/timers know test ended
    setTestRunning(false);

    const durationMs = Date.now() - (testStartTime || Date.now());
    setTestResultsVisible(true);

    // use the synchronous ref for final score
    const finalScore = testScoreRef.current;
    const total = testDeckRef.current ? testDeckRef.current.cards.length : 0;

    try {
      const entry = await testService.saveRanking(deckId, {
        name: testStudentName || 'Anonymous',
        studentId: selectedStudentId,
        studentName: testStudentName || 'Anonymous',
        score: finalScore,
        total,
        durationMs
      });

      const pct = total ? Math.round((finalScore / total) * 100) : 0;
      if (pct >= 60) longConfettiBurst();

      const ranking = await testService.getRanking(deckId);
      const pos = ranking.findIndex((r) => r.id === entry.id);

      if (pos === 0) {
        longConfettiBurst();
        fireworksBurst(null, 6000);
        floatingEmoji('🏆', 10);
      } else if (pos === 1 || pos === 2) {
        smallConfettiBurst(document.querySelector('.flashcard')?.getBoundingClientRect());
        fireworksBurst(null, 3000);
        floatingEmoji('🎉', 6);
      }
    } catch (err) {
      console.error('finishTest save error', err);
      // still show results even if save failed
    }
  }

  async function handleRenameDeck() {
    const name = window.prompt('Rename deck to:', deck?.name || '');
    if (!name || !deck) return;
    try {
      await deckService.renameDeck(deck.id, name);
      const reloaded = await deckService.getDeck(deck.id);
      setDeck(reloaded);
      showStarToast('Deck renamed');
    } catch (err) {
      console.error('rename failed', err);
      showStarToast('Rename failed');
    }
  }
  async function handleExportDeck() {
    try {
      await deckService.exportDeck(deckId);
      showStarToast('Export started');
    } catch (err) {
      console.error('export failed', err);
      showStarToast('Export failed');
    }
  }
  async function handleDeleteDeck() {
    if (!deck) return;
    if (!window.confirm(`Delete deck "${deck.name}"? This cannot be undone.`)) return;
    try {
      await deckService.deleteDeck(deck.id);
      showStarToast('Deck deleted');
      setDeck(null);
      setSession(null);
      setCurrentCard(null);
    } catch (err) {
      console.error('delete failed', err);
      showStarToast('Delete failed');
    }
  }
  function openCreateDeck() {
    setEditorOpen(true);
  }

  function enterTestMode() {
    setTestMode(true);
    testService.createTestDeckFrom(deckId, { count: deck?.cards?.length || 0, style: 'A>B' }).then((td) => {
      setTestDeck(td);
      testDeckRef.current = td;
    });
  }
  function exitTestMode() {
    setTestMode(false);
    setTestRunning(false);
    setTestCountdown(null);
    setTestDeck(null);
    testDeckRef.current = null;
    setSelectedStudentId(null);
    resetTestState();
  }

  if (loading) return <div className="muted text-small">Loading study session…</div>;
  if (!deck) return <div className="muted text-small">Deck not found.</div>;

  const visibleCard = (testMode && testRunning && testDeckRef.current) ? testDeckRef.current.cards[testIndexRef.current] : currentCard;
  const testResultTotal = testDeckRef.current?.cards?.length || 0;
  const testResultPct = testResultTotal ? Math.round((testScore / testResultTotal) * 100) : 0;

  return (
    <div className="study-root" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{deck.name}{testMode ? ' — Test Mode' : ''}</h2>
          <div className="text-small muted">{deck.cards.length} cards</div>
        </div>

        <div className="row" style={{ alignItems: 'center' }}>
          <button className="btn btn--ghost" onClick={() => setEditorOpen(true)}>Edit</button>

          <button
            className={`btn btn--ghost btn--flipall`}
            onClick={toggleFlipAll}
            aria-pressed={allFlipped}
            title="Flip all cards (toggle)"
          >
            {allFlipped ? 'Unflip All' : 'Flip All'}
          </button>

          <button className="btn btn--ghost" onClick={shuffleQueue} disabled={shuffling}>Shuffle</button>

          <button
            className={`btn ${starPoolActive ? 'btn--danger' : 'btn--ghost'}`}
            onClick={toggleStarPool}
            title="Study only starred cards in this deck"
          >
            {starPoolActive ? 'Exit Star pool' : 'Star pool'}
          </button>

          <button
            className={`btn ${testMode ? 'btn' : 'btn--ghost'}`}
            onClick={() => { if (!testMode) enterTestMode(); else exitTestMode(); }}
          >
            {testMode ? 'Exit Test Mode' : 'Enter Test Mode'}
          </button>

          <button className="btn" onClick={restartSession}>Restart</button>
        </div>
      </header>

      {/* Main column: test area (top) and ranking board (below) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Test controls (only visible in test mode) */}
        {testMode && (
          
          <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button className="btn btn--ghost" onClick={openPrepareTest}>Prepare Test</button>

            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
              <select
                value={students.some((student) => student.name === testStudentName) ? testStudentName : ''}
                onChange={(e) => handleStudentSelect(e.target.value)}
                style={{ minWidth: 160, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.25)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.06)' }}
                aria-label="Select student"
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.name}>{student.name}</option>
                ))}
              </select>

              <input
                ref={studentInputRef}
                placeholder="Student or team name"
                value={testStudentName}
                onChange={(e) => handleStudentNameChange(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="text-small muted">Per card (s)</label>
              <input type="number" min="5" max="300" value={perCardSeconds} onChange={(e) => { const v = Math.max(5, Number(e.target.value || 15)); setPerCardSeconds(v); setPerCardRemaining(v); }} style={{ width: 80 }} />
              <button className="btn btn" onClick={startTest} aria-label="Start Test">Test Start</button>
            </div>
          </div>
        )}

        {/* Flashcard area */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className={`flashcard-container ${testMode ? 'test-mode' : ''}`} style={{ width: '100%', maxWidth: 920, position: 'relative' }}>
            {testMode && testCountdown !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.6)',
                  zIndex: 7000,
                  borderRadius: 12
                }}
              >
                <div className="overlay-countdown" style={{ textAlign: 'center' }}>
                  <div className="overlay-text" style={{ color: 'var(--fg)', fontWeight: 700 }}>Are you ready?</div>
                  <div className="overlay-number" style={{ color: 'var(--danger)' }}>{testCountdown}</div>
                </div>
              </div>
            )}

            {testMode && testRunning && (
              <div className="test-timer-bar" style={{ right: 18, top: 18 }}>
                <div className="text-small muted">Time left: <strong>{perCardRemaining}s</strong></div>
              </div>
            )}

            {visibleCard ? (
              <Flashcard
                key={visibleCard.id}
                card={visibleCard}
                flipSignal={flipSignal}
                flipDurationMs={flipDuration}
                onAnswer={(quality) => {
                  if (testMode && testRunning) {
                    // UI answer buttons do not auto-mark done in test; keyboard ArrowDown does.
                  } else {
                    handleAnswer(visibleCard.id, quality);
                  }
                }}
                onToggleStar={() => toggleStar()}
                forcedFlipped={globalFlipMap[visibleCard.id]}
                onRequestFlip={(cardId) => toggleCardFlip(cardId)}
              />
            ) : (
              <div className="panel" style={{ padding: 28 }}>
                <h3 className="muted">No card</h3>
              </div>
            )}
          </div>
        </div>

        {/* Ranking board below the test area (visible while in test mode) */}
        {testMode && (
          <div>
            <RankingBoard deckId={deckId} />
          </div>
        )}
      </div>

      {!testMode && (
        <>
          <div style={{ marginTop: 12 }} className="muted text-small">
            Progress: {sessionRef.current ? Math.min(sessionRef.current.index + 1, sessionRef.current.queue.length) : 0} / {sessionRef.current ? sessionRef.current.queue.length : 0}
          </div>
          <div style={{ marginTop: 8 }} className="muted text-small">
            Keyboard: <strong>Space</strong>=star, <strong>→</strong>=next, <strong>←</strong>=prev, <strong>↓</strong>=done, <strong>↑</strong>=flip (faster presses flip faster)
          </div>
        </>
      )}

      {testMode && !testRunning && (
        <div style={{ marginTop: 12 }} className="muted text-small">
          Test prepared: <strong>{testDeck ? `${testDeck.cards.length} questions` : 'none'}</strong>
        </div>
      )}

      {editorOpen && (
        <DeckEditor
          deckId={deckId}
          onClose={() => {
            setEditorOpen(false);
            deckService.getDeck(deckId).then((d) => {
              setDeck(d);
              const s = prepareFreshSession(d || { id: deckId, cards: [] });
              setActiveSession(s);
              studyService.persistSession(s).catch(() => {});
            });
          }}
          onSaved={(d) => {
            setEditorOpen(false);
            setDeck(d);
            const s = prepareFreshSession(d || { id: deckId, cards: [] });
            setActiveSession(s);
            studyService.persistSession(s).catch(() => {});
            const rect = document.querySelector('.flashcard')?.getBoundingClientRect() || null;
            showEncouragementRight('Deck saved ✅', { anchorRect: rect });
          }}
        />
      )}

      {testPrepOpen && (
        <TestPrepModal
          deck={deck}
          onClose={() => setTestPrepOpen(false)}
          onSave={(opts) => handleSavePreparedTest(opts)}
        />
      )}

      {testResultsVisible && testDeckRef.current && (
        <div className="modal-overlay" style={{ zIndex: 9000 }}>
          <div className="modal panel" style={{ maxWidth: 520 }}>
            <h3>Test Results</h3>
            <p><strong>{testStudentName || 'Anonymous'}</strong></p>
            <p>Score: {testScore} / {testResultTotal} ({testResultPct}%)</p>
            <p>Time: {Math.round(((Date.now() - (testStartTime || Date.now())) / 1000))}s</p>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn--ghost" onClick={() => { setTestResultsVisible(false); /* remain in test mode */ }}>
                Close
              </button>
              <button className="btn" onClick={() => { setTestResultsVisible(false); /* remain in test mode */ }}>
                Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
