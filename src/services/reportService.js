// src/services/reportService.js
import * as storage from './storageService.js';

const REPORT_INDEX = 'reports:index';

export async function logSession(sessionData) {
  const id = sessionData.id || `report-${Date.now()}`;
  await storage.save(`report:${id}`, sessionData);
  const idx = await storage.load(REPORT_INDEX, []);
  idx.unshift(id);
  await storage.save(REPORT_INDEX, idx);
  return id;
}

export async function getReports(range = { limit: 50 }) {
  const idx = await storage.load(REPORT_INDEX, []);
  const ids = idx.slice(0, range.limit || 50);
  const reports = await Promise.all(ids.map((id) => storage.load(`report:${id}`, null)));
  return reports.filter(Boolean);
}

export function computeStats(session) {
  if (!session || !Array.isArray(session.logs)) return {};
  const total = session.logs.length;
  const byQuality = session.logs.reduce((acc, l) => {
    acc[l.quality] = (acc[l.quality] || 0) + 1;
    return acc;
  }, {});
  const avgQuality = session.logs.reduce((s, l) => s + l.quality, 0) / Math.max(1, total);
  return {
    total,
    byQuality,
    avgQuality
  };
}

function _safeTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function _qualityValue(value) {
  const quality = Number(value);
  return Number.isFinite(quality) ? Math.max(0, Math.min(5, quality)) : 0;
}

function _cardLabel(card, fallback) {
  if (!card) return fallback;
  const front = String(card.front || '').trim();
  const back = String(card.back || '').trim();
  if (front && back) return `${front} / ${back}`;
  return front || back || fallback;
}

function _buildCardLookup(decks = []) {
  const cards = new Map();
  const deckNames = new Map();

  for (const deck of decks || []) {
    if (!deck || !deck.id) continue;
    deckNames.set(deck.id, deck.name || deck.id);
    for (const card of deck.cards || []) {
      if (!card || !card.id) continue;
      cards.set(`${deck.id}::${card.id}`, card);
    }
  }

  return { cards, deckNames };
}

export function buildReportInsights(reports = [], decks = []) {
  const { cards, deckNames } = _buildCardLookup(decks);
  const qualityCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const cardStats = new Map();
  const recentSessions = [];

  let answerCount = 0;
  let qualitySum = 0;
  let lowQualityCount = 0;
  let lastStudiedAt = null;

  for (const report of reports || []) {
    if (!report) continue;
    const logs = Array.isArray(report.logs) ? report.logs : [];
    let sessionQualitySum = 0;
    let sessionLowQuality = 0;
    let sessionLastTime = Math.max(_safeTime(report.endedAt), _safeTime(report.startedAt));

    for (const log of logs) {
      const quality = _qualityValue(log.quality);
      const qualityBucket = Math.round(quality);
      const lowQuality = quality < 3;
      const logTime = _safeTime(log.time);
      const deckId = report.deckId || 'unknown';
      const cardId = log.cardId || 'unknown';
      const cardKey = `${deckId}::${cardId}`;

      qualityCounts[qualityBucket] = (qualityCounts[qualityBucket] || 0) + 1;
      answerCount += 1;
      qualitySum += quality;
      sessionQualitySum += quality;
      if (lowQuality) {
        lowQualityCount += 1;
        sessionLowQuality += 1;
      }

      sessionLastTime = Math.max(sessionLastTime, logTime);

      if (!cardStats.has(cardKey)) {
        cardStats.set(cardKey, {
          cardId,
          deckId,
          deckName: deckNames.get(deckId) || deckId,
          label: _cardLabel(cards.get(cardKey), cardId),
          attempts: 0,
          qualitySum: 0,
          lowQualityCount: 0,
          lastSeen: null
        });
      }

      const stat = cardStats.get(cardKey);
      stat.attempts += 1;
      stat.qualitySum += quality;
      if (lowQuality) stat.lowQualityCount += 1;
      if (!stat.lastSeen || logTime > _safeTime(stat.lastSeen)) {
        stat.lastSeen = logTime ? new Date(logTime).toISOString() : null;
      }
    }

    if (sessionLastTime && (!lastStudiedAt || sessionLastTime > _safeTime(lastStudiedAt))) {
      lastStudiedAt = new Date(sessionLastTime).toISOString();
    }

    recentSessions.push({
      id: report.id,
      deckId: report.deckId || 'unknown',
      deckName: deckNames.get(report.deckId) || report.deckId || 'unknown',
      startedAt: report.startedAt || null,
      endedAt: report.endedAt || null,
      total: logs.length,
      avgQuality: logs.length ? sessionQualitySum / logs.length : 0,
      lowQualityCount: sessionLowQuality
    });
  }

  const weakCards = Array.from(cardStats.values())
    .map((stat) => ({
      cardId: stat.cardId,
      deckId: stat.deckId,
      deckName: stat.deckName,
      label: stat.label,
      attempts: stat.attempts,
      avgQuality: stat.attempts ? stat.qualitySum / stat.attempts : 0,
      lowQualityCount: stat.lowQualityCount,
      lastSeen: stat.lastSeen
    }))
    .filter((stat) => stat.lowQualityCount > 0)
    .sort((a, b) => {
      if (b.lowQualityCount !== a.lowQualityCount) return b.lowQualityCount - a.lowQualityCount;
      if (a.avgQuality !== b.avgQuality) return a.avgQuality - b.avgQuality;
      return b.attempts - a.attempts;
    })
    .slice(0, 8);

  recentSessions.sort((a, b) => {
    const aTime = Math.max(_safeTime(a.endedAt), _safeTime(a.startedAt));
    const bTime = Math.max(_safeTime(b.endedAt), _safeTime(b.startedAt));
    return bTime - aTime;
  });

  return {
    sessionCount: (reports || []).length,
    answerCount,
    avgQuality: answerCount ? qualitySum / answerCount : 0,
    lowQualityCount,
    lowQualityRate: answerCount ? lowQualityCount / answerCount : 0,
    lastStudiedAt,
    qualityCounts,
    weakCards,
    recentSessions: recentSessions.slice(0, 10)
  };
}

function _studentName(entry) {
  return String(entry?.studentName || entry?.name || 'Anonymous').trim() || 'Anonymous';
}

export function buildStudentTestInsights(rankings = [], selectedStudent = '') {
  const selectedKey = String(selectedStudent || '').trim().toLocaleLowerCase();
  const rows = (rankings || [])
    .map((entry) => ({
      ...entry,
      studentName: _studentName(entry),
      deckName: entry.deckName || entry.deckId || 'unknown',
      pct: Number.isFinite(Number(entry.pct)) ? Number(entry.pct) : 0,
      score: Number.isFinite(Number(entry.score)) ? Number(entry.score) : 0,
      total: Number.isFinite(Number(entry.total)) ? Number(entry.total) : 0,
      durationMs: Number.isFinite(Number(entry.durationMs)) ? Number(entry.durationMs) : 0,
      date: entry.date || entry.createdAt || null
    }))
    .filter((entry) => !selectedKey || entry.studentName.toLocaleLowerCase() === selectedKey);

  rows.sort((a, b) => _safeTime(b.date) - _safeTime(a.date));

  const deckStats = new Map();
  let pctSum = 0;
  let bestPct = 0;

  for (const row of rows) {
    pctSum += row.pct;
    bestPct = Math.max(bestPct, row.pct);

    const deckKey = row.deckId || row.deckName;
    if (!deckStats.has(deckKey)) {
      deckStats.set(deckKey, {
        deckId: row.deckId || deckKey,
        deckName: row.deckName || deckKey,
        attempts: 0,
        pctSum: 0,
        bestPct: 0,
        recentPct: null,
        lastTestAt: null
      });
    }

    const stat = deckStats.get(deckKey);
    stat.attempts += 1;
    stat.pctSum += row.pct;
    stat.bestPct = Math.max(stat.bestPct, row.pct);
    if (!stat.lastTestAt || _safeTime(row.date) > _safeTime(stat.lastTestAt)) {
      stat.lastTestAt = row.date;
      stat.recentPct = row.pct;
    }
  }

  const deckSummaries = Array.from(deckStats.values())
    .map((stat) => ({
      ...stat,
      avgPct: stat.attempts ? Math.round(stat.pctSum / stat.attempts) : 0
    }))
    .sort((a, b) => {
      if (a.avgPct !== b.avgPct) return a.avgPct - b.avgPct;
      return b.attempts - a.attempts;
    });

  return {
    studentName: selectedStudent || '',
    testCount: rows.length,
    avgPct: rows.length ? Math.round(pctSum / rows.length) : 0,
    bestPct,
    recentPct: rows[0]?.pct ?? null,
    lastTestAt: rows[0]?.date || null,
    weakDecks: deckSummaries.slice(0, 5),
    recentTests: rows.slice(0, 10)
  };
}
