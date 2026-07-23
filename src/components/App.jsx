// src/components/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import DeckList from './DeckList/DeckList';
import StudyView from './Study/StudyView';
import DeckEditor from './Editor/DeckEditor';
import '../styles/main.css';
import { useTranslation } from 'react-i18next';
// at top of src/components/App.jsx
import DonateButton from './DonateButton'; // adjust path if needed
import * as deckService from '../services/deckService';
import * as reportService from '../services/reportService';
import * as studentService from '../services/studentService';
import * as testService from '../services/testService';

function Header() {
  const { t } = useTranslation();
  return <h1>{t('appTitle')}</h1>;
}

// language button will be used inside App

export default function App() {
  const { t, i18n } = useTranslation();
  const languages = ['en','ko','zh-Hant'];
  function cycleLanguage() {
    const idx = languages.indexOf(i18n.language);
    const next = languages[(idx + 1) % languages.length];
    i18n.changeLanguage(next);
  }

  const [activeDeckId, setActiveDeckId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDeckId, setEditorDeckId] = useState(null);

  // menu state for header Menu button
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // help and clear-confirm modals
  const [helpVisible, setHelpVisible] = useState(false);
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [reportRows, setReportRows] = useState([]);
  const [reportInsights, setReportInsights] = useState(null);
  const [reportRankingRows, setReportRankingRows] = useState([]);
  const [reportStudentOptions, setReportStudentOptions] = useState([]);
  const [reportStudentFilter, setReportStudentFilter] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [studentsVisible, setStudentsVisible] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentsDraft, setStudentsDraft] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(false);

  // close menu when clicking/tapping outside
  // Use pointerdown so that the native event doesn't run after React's synthetic click
  // which could cause the menu to immediately close when toggled.
  useEffect(() => {
    function onDocPointerDown(e) {
      if (!menuRef.current) return;
      // prefer composedPath for robustness across shadow DOM / portals
      const path = e.composedPath ? e.composedPath() : [e.target];
      const clickedInside = path.some((node) => node === menuRef.current || (node && node.contains && menuRef.current.contains(node)));
      if (!clickedInside) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  async function handleMenuReport() {
    setMenuOpen(false);
    setReportVisible(true);
    setReportLoading(true);
    setReportError('');

    try {
      const reports = await reportService.getReports({ limit: 50 });
      const visibleReports = activeDeckId
        ? reports.filter((report) => report.deckId === activeDeckId)
        : reports;
      const decks = await deckService.getDecks();
      const visibleDecks = activeDeckId ? decks.filter((deck) => deck.id === activeDeckId) : decks;
      const rankingGroups = await Promise.all(
        visibleDecks.map(async (deck) => {
          const ranking = await testService.getRanking(deck.id);
          return ranking.map((entry) => ({
            ...entry,
            deckId: deck.id,
            deckName: deck.name || deck.id,
            studentName: entry.studentName || entry.name || 'Anonymous'
          }));
        })
      );
      const rankingRows = rankingGroups.flat();
      const studentList = await studentService.getStudents();
      const studentOptions = buildReportStudentOptions(studentList, rankingRows);
      setReportRows(visibleReports);
      setReportInsights(reportService.buildReportInsights(visibleReports, decks));
      setReportRankingRows(rankingRows);
      setReportStudentOptions(studentOptions);
      setReportStudentFilter((current) => (
        current && !studentOptions.some((name) => name.toLocaleLowerCase() === current.toLocaleLowerCase())
          ? ''
          : current
      ));
    } catch (err) {
      console.error('report load failed', err);
      setReportError('Failed to load reports.');
      setReportRows([]);
      setReportInsights(null);
      setReportRankingRows([]);
      setReportStudentOptions([]);
    } finally {
      setReportLoading(false);
    }
  }

  async function loadStudents() {
    setStudentsLoading(true);
    try {
      const list = await studentService.getStudents();
      setStudents(list);
    } catch (err) {
      console.error('student load failed', err);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }

  async function handleMenuStudents() {
    setMenuOpen(false);
    setStudentsVisible(true);
    setStudentsDraft('');
    await loadStudents();
  }

  async function handleAddStudents() {
    if (!studentsDraft.trim()) return;
    const list = await studentService.addStudents(studentsDraft);
    setStudents(list);
    setStudentsDraft('');
  }

  async function handleRemoveStudent(studentId) {
    const list = await studentService.removeStudent(studentId);
    setStudents(list);
  }

  function buildReportStudentOptions(studentList = [], rankingRows = []) {
    const names = [];
    const seen = new Set();

    function addName(name) {
      const clean = String(name || '').trim();
      if (!clean) return;
      const key = clean.toLocaleLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(clean);
    }

    studentList.forEach((student) => addName(student.name));
    rankingRows.forEach((row) => addName(row.studentName || row.name));
    return names.sort((a, b) => a.localeCompare(b));
  }

  function formatReportDate(value) {
    if (!value) return '-';
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return '-';
    return new Date(time).toLocaleString();
  }

  function formatQuality(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(1) : '-';
  }

  function formatPercent(value) {
    const n = Number(value);
    return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '0%';
  }

  function reportSummaryText(insights) {
    if (!insights || insights.answerCount === 0) return 'No answers recorded yet.';
    if (insights.lowQualityRate >= 0.35) return 'Many answers are still difficult. Start with the weak cards below.';
    if (insights.avgQuality >= 4) return 'Recall looks strong. Keep reviewing briefly to maintain it.';
    if (insights.avgQuality >= 3) return 'Progress is stable. A short review of weaker cards should help.';
    return 'This deck needs more guided practice before testing again.';
  }

  // Open the clear-confirm dialog from the menu
  function handleMenuClearAll() {
    setMenuOpen(false);
    setClearConfirmInput('');
    setClearConfirmVisible(true);
  }

  // Perform the destructive clear only when user typed the exact phrase
  function performClearAll() {
    // defensive: only proceed when user typed the exact phrase
    if (clearConfirmInput.trim() !== 'clear all') return;

    try {
      // Clear local storage (app data) — adjust if you store data elsewhere
      localStorage.clear();

      // Optionally, if you have other stores (indexedDB, etc.), clear them here.
      // Dispatch an event so other components can react (reload decks, reset state)
      window.dispatchEvent(new CustomEvent('decks-cleared'));
      window.dispatchEvent(new CustomEvent('decks-changed'));
      window.dispatchEvent(new CustomEvent('ranking-updated'));
      window.dispatchEvent(new CustomEvent('students-changed'));

      // Reset UI state
      setActiveDeckId(null);
      setReportRows([]);
      setReportInsights(null);
      setReportRankingRows([]);
      setReportStudentOptions([]);
      setReportStudentFilter('');
      setReportVisible(false);
      setStudents([]);
      setStudentsVisible(false);
      setClearConfirmVisible(false);
      setClearConfirmInput('');
      // Provide a small visual confirmation
      // (replace with your toast/notification if you have one)
      setTimeout(() => alert('All local data cleared.'), 50);
    } catch (err) {
      console.error('clear all failed', err);
      alert('Failed to clear data. See console for details.');
    }
  }

  // Help button toggles help modal
  function toggleHelp() {
    setHelpVisible((s) => !s);
    setMenuOpen(false);
  }

  const reportStudentInsights = reportService.buildStudentTestInsights(reportRankingRows, reportStudentFilter);

  return (
    <div className="app">
      <header className="header panel">
        <div className="header__brand">
          <h1 className="header__title">{t('appTitle')}</h1>
          <div className="header__subtitle muted">Study smarter, iterate faster</div>
        </div>

        <div className="header__actions" ref={menuRef} style={{ position: 'relative' }}>
          {/* Language square button (cycles languages) */}
          <button
            className="btn btn--icon"
            onClick={(e) => { e.stopPropagation(); cycleLanguage(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t('language')}
            title={t('language')}
            style={{ marginRight: 8 }}
          >
            {i18n.language === 'en' ? 'EN' : i18n.language === 'ko' ? '한국' : '繁'}
          </button>

          {/* Help square button with "?" icon */}
          <button
            className="btn btn--icon"
            onClick={toggleHelp}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={t('howToUseTitle')}
            title={t('howToUseTitle')}
            style={{ marginRight: 8 }}
          >
            ?
          </button>

          {/* donation button inserted here */}
          <DonateButton />

{/* Menu button + dropdown */}
<button
  className="btn btn--ghost"
  onClick={() => setMenuOpen((s) => !s)}
  onPointerDown={(e) => e.stopPropagation()}
  aria-haspopup="true"
  aria-expanded={menuOpen}
  aria-label="Open menu"
>
  Menu ▾
</button>

{/* Clear all button placed next to Menu */}
<button
  className="btn btn--ghost btn--danger-inline"
  onClick={() => {
    // open the same confirmation modal used by the menu item
    setMenuOpen(false);
    setClearConfirmInput('');
    setClearConfirmVisible(true);
  }}
  aria-label="Clear all data"
  title="Clear all local data"
  style={{ marginLeft: 8 }}
>
  Clear all
</button>

{menuOpen && (
  <div
    className="header__menu panel"
    style={{
      position: 'absolute',
      right: 0,
      top: 'calc(100% + 8px)',
      minWidth: 220,
      zIndex: 12050,        // ensure it's above other UI
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}
  >
    <button
      className="btn--link text-small"
      onClick={handleMenuReport}
      style={{ padding: '8px 10px', textAlign: 'left' }}
    >
      Report
    </button>

    <button
      className="btn--link text-small"
      onClick={handleMenuStudents}
      style={{ padding: '8px 10px', textAlign: 'left' }}
    >
      Students
    </button>

    <button
      className="btn--link text-small"
      onClick={() => { setMenuOpen(false); alert('Menu: Help placeholder'); }}
      style={{ padding: '8px 10px', textAlign: 'left' }}
    >
      Help
    </button>

    {/* Clear all data (destructive) */}
<button
  className="btn--link text-small btn--danger"
  onClick={handleMenuClearAll}
  style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--danger)' }}
>
  Clear all data
</button>

  </div>
)}
        </div>
      </header>

      <main className="app__main">
        <aside className="sidebar panel">
          <DeckList
            onSelectDeck={(id) => setActiveDeckId(id)}
            activeDeckId={activeDeckId}
          />
        </aside>

        <section className="workspace panel">
          {activeDeckId ? (
            <StudyView deckId={activeDeckId} />
          ) : (
            <div className="workspace__empty">
              <h2 className="muted">Select a deck to start studying</h2>
              <p className="text-small muted">
                Create decks and cards from the editor. Study sessions and reports will appear here.
              </p>
            </div>
          )}
        </section>
      </main>

      {editorOpen && (
        <DeckEditor
          deckId={editorDeckId}
          onClose={() => setEditorOpen(false)}
          onSaved={(deck) => {
            setActiveDeckId(deck.id);
            setEditorOpen(false);
          }}
        />
      )}

      <footer className="footer muted text-small">
        © {new Date().getFullYear()} V2 Flashcard — Created by Vito. 
      </footer>

{/* Help modal (scrollable) */}
{helpVisible && (
  <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('howToUseTitle')} style={{ overflowY: 'auto' }}>
      <div
      className="panel"
      style={{
        maxWidth: 720,
        width: '92%',
        padding: 18,
        maxHeight: '80vh',     // limit height to viewport fraction
        overflowY: 'auto',     // enable internal scrolling
      }}
    >
      <h3 style={{ marginTop: 0 }}>{t('howToUseTitle')}</h3>

      <div style={{ marginTop: 8, lineHeight: 1.5 }}>
        <p><strong>{t('purposeTitle')}</strong></p>
        <p>{t('purposeText')}</p>

        <p><strong>{t('creditTitle')}</strong></p>
        <p>{t('creditText')}</p>

        <p><strong>{t('quickStepsTitle')}</strong></p>
        <ol>
          {[1,2,3,4,5].map((n) => (
            <li key={n}>{t(`step${n}`)}</li>
          ))}
        </ol>

        <p><strong>{t('notesTitle')}</strong></p>
        <ul>
          <li>{t('note1')}</li>
          <li>{t('note2')}</li>
        </ul>

        <p style={{ marginTop: 8 }}><strong>{t('plannedTitle')}</strong></p>
        <p>{t('plannedText')}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button className="btn btn--ghost" onClick={() => setHelpVisible(false)}>{t('close')}</button>
      </div>
    </div>
  </div>
)}

{/* Report modal */}
{reportVisible && (
  <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Report" style={{ overflowY: 'auto' }}>
    <div
      className="panel"
      style={{
        maxWidth: 760,
        width: '92%',
        padding: 18,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Report</h3>
          <div className="text-small muted" style={{ marginTop: 6 }}>
            {activeDeckId ? 'Recent sessions for the selected deck' : 'Recent sessions across all decks'}
          </div>
        </div>
        <button className="btn btn--ghost" onClick={() => setReportVisible(false)}>Close</button>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="text-small muted">Student</label>
        <select
          value={reportStudentFilter}
          onChange={(e) => setReportStudentFilter(e.target.value)}
          style={{ minWidth: 180, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.25)', color: 'var(--fg)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <option value="">All students</option>
          {reportStudentOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="text-small muted">
          {reportStudentInsights.testCount} of {reportRankingRows.length} test results
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <h4 style={{ margin: '0 0 8px' }}>
          {reportStudentFilter ? `${reportStudentFilter} test insight` : 'Student test insight'}
        </h4>
        {reportStudentInsights.testCount === 0 ? (
          <div className="muted text-small">
            {reportStudentFilter ? 'No test results for this student yet.' : 'No test results yet.'}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                ['Tests', reportStudentInsights.testCount],
                ['Average', `${reportStudentInsights.avgPct}%`],
                ['Best', `${reportStudentInsights.bestPct}%`],
                ['Recent', reportStudentInsights.recentPct === null ? '-' : `${reportStudentInsights.recentPct}%`],
                ['Last test', formatReportDate(reportStudentInsights.lastTestAt)]
              ].map(([label, value]) => (
                <div key={label} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 10 }}>
                  <div className="text-small muted">{label}</div>
                  <div style={{ fontWeight: 800, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="text-small muted" style={{ marginBottom: 6 }}>Weak decks</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '8px 6px' }}>Deck</th>
                    <th style={{ padding: '8px 6px' }}>Tests</th>
                    <th style={{ padding: '8px 6px' }}>Avg</th>
                    <th style={{ padding: '8px 6px' }}>Recent</th>
                  </tr>
                </thead>
                <tbody>
                  {reportStudentInsights.weakDecks.map((deck) => (
                    <tr key={deck.deckId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 6px' }}>{deck.deckName}</td>
                      <td style={{ padding: '8px 6px' }}>{deck.attempts}</td>
                      <td style={{ padding: '8px 6px' }}>{deck.avgPct}%</td>
                      <td style={{ padding: '8px 6px' }}>{deck.recentPct === null ? '-' : `${deck.recentPct}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="text-small muted" style={{ marginBottom: 6 }}>Recent tests</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '8px 6px' }}>Finished</th>
                    {!reportStudentFilter && <th style={{ padding: '8px 6px' }}>Student</th>}
                    <th style={{ padding: '8px 6px' }}>Deck</th>
                    <th style={{ padding: '8px 6px' }}>Score</th>
                    <th style={{ padding: '8px 6px' }}>Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {reportStudentInsights.recentTests.map((test) => (
                    <tr key={`${test.deckId}-${test.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 6px' }}>{formatReportDate(test.date)}</td>
                      {!reportStudentFilter && <td style={{ padding: '8px 6px' }}>{test.studentName}</td>}
                      <td style={{ padding: '8px 6px' }}>{test.deckName}</td>
                      <td style={{ padding: '8px 6px' }}>{test.score}/{test.total}</td>
                      <td style={{ padding: '8px 6px' }}>{test.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        {reportLoading ? (
          <div className="muted text-small">Loading reports...</div>
        ) : reportError ? (
          <div className="muted text-small">{reportError}</div>
        ) : reportRows.length === 0 ? (
          <div className="muted text-small">No completed study sessions yet.</div>
        ) : !reportInsights || reportInsights.answerCount === 0 ? (
          <div className="muted text-small">Reports exist, but no answers were recorded yet.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                ['Sessions', reportInsights.sessionCount],
                ['Answers', reportInsights.answerCount],
                ['Avg quality', `${formatQuality(reportInsights.avgQuality)} / 5`],
                ['Low score rate', formatPercent(reportInsights.lowQualityRate)],
                ['Last studied', formatReportDate(reportInsights.lastStudiedAt)]
              ].map(([label, value]) => (
                <div key={label} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 10 }}>
                  <div className="text-small muted">{label}</div>
                  <div style={{ fontWeight: 800, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <strong>Insight:</strong> {reportSummaryText(reportInsights)}
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px' }}>Quality distribution</h4>
              <div style={{ display: 'grid', gap: 6 }}>
                {[0, 1, 2, 3, 4, 5].map((quality) => {
                  const count = reportInsights.qualityCounts[quality] || 0;
                  const pct = reportInsights.answerCount ? count / reportInsights.answerCount : 0;
                  return (
                    <div key={quality} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 48px', gap: 8, alignItems: 'center' }}>
                      <div className="text-small muted">{quality}</div>
                      <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(pct * 100)}%`, height: '100%', background: quality < 3 ? 'var(--danger)' : 'var(--accent-bright)' }} />
                      </div>
                      <div className="text-small muted" style={{ textAlign: 'right' }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px' }}>Cards to review first</h4>
              {reportInsights.weakCards.length === 0 ? (
                <div className="muted text-small">No weak cards found in these reports.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '8px 6px' }}>Card</th>
                      {!activeDeckId && <th style={{ padding: '8px 6px' }}>Deck</th>}
                      <th style={{ padding: '8px 6px' }}>Low</th>
                      <th style={{ padding: '8px 6px' }}>Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportInsights.weakCards.map((card) => (
                      <tr key={`${card.deckId}-${card.cardId}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 6px' }}>{card.label}</td>
                        {!activeDeckId && <td style={{ padding: '8px 6px' }}>{card.deckName}</td>}
                        <td style={{ padding: '8px 6px' }}>{card.lowQualityCount}</td>
                        <td style={{ padding: '8px 6px' }}>{formatQuality(card.avgQuality)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px' }}>Recent sessions</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '8px 6px' }}>Started</th>
                    {!activeDeckId && <th style={{ padding: '8px 6px' }}>Deck</th>}
                    <th style={{ padding: '8px 6px' }}>Answers</th>
                    <th style={{ padding: '8px 6px' }}>Avg</th>
                    <th style={{ padding: '8px 6px' }}>Low</th>
                  </tr>
                </thead>
                <tbody>
                  {reportInsights.recentSessions.map((session) => (
                    <tr key={session.id || `${session.deckId}-${session.startedAt}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 6px' }}>{formatReportDate(session.startedAt)}</td>
                      {!activeDeckId && <td style={{ padding: '8px 6px' }}>{session.deckName}</td>}
                      <td style={{ padding: '8px 6px' }}>{session.total}</td>
                      <td style={{ padding: '8px 6px' }}>{formatQuality(session.avgQuality)}</td>
                      <td style={{ padding: '8px 6px' }}>{session.lowQualityCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  </div>
)}

{/* Students modal */}
{studentsVisible && (
  <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Students" style={{ overflowY: 'auto' }}>
    <div
      className="panel"
      style={{
        maxWidth: 640,
        width: '92%',
        padding: 18,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Students</h3>
          <div className="text-small muted" style={{ marginTop: 6 }}>Paste names once, then select them in Test Mode.</div>
        </div>
        <button className="btn btn--ghost" onClick={() => setStudentsVisible(false)}>Close</button>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="text-small muted">Add students</label>
        <textarea
          value={studentsDraft}
          onChange={(e) => setStudentsDraft(e.target.value)}
          placeholder={'One name per line, or separate names with commas'}
          rows={5}
          style={{ width: '100%', padding: 8, marginTop: 6, borderRadius: 8 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button className="btn" onClick={handleAddStudents} disabled={!studentsDraft.trim()}>Add</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="text-small muted" style={{ marginBottom: 8 }}>{students.length} students</div>
        {studentsLoading ? (
          <div className="muted text-small">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="muted text-small">No students yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {students.map((student) => (
              <div key={student.id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{student.name}</div>
                <button className="btn btn--ghost btn--small" onClick={() => handleRemoveStudent(student.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}


      {/* Clear all confirmation modal */}
      {clearConfirmVisible && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('clearAll')}>
          <div className="panel" style={{ maxWidth: 520, width: '92%', padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>{t('clearAll')}</h3>
            <p className="muted">This will erase all locally stored decks, sessions, and settings. This action cannot be undone.</p>

            <div style={{ marginTop: 12 }}>
              <label className="text-small">Type <code>clear all</code> to confirm</label>
              <input
                type="text"
                value={clearConfirmInput}
                onChange={(e) => setClearConfirmInput(e.target.value)}
                placeholder="Type clear all to confirm"
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn btn--ghost" onClick={() => { setClearConfirmVisible(false); setClearConfirmInput(''); }}>Cancel</button>
              <button
                className="btn btn--danger"
                onClick={performClearAll}
                disabled={clearConfirmInput.trim() !== 'clear all'}
                title={clearConfirmInput.trim() !== 'clear all' ? 'Type "clear all" to enable' : 'Clear all data'}
              >
                {t('clearAll')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

