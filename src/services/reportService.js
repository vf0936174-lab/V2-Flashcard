// src/services/reportService.js
import * as storage from './storageService';

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
