import { useState } from 'react';
import {
  computeAccuracy,
  computeAverageTimeMs,
  computeDailyHistory,
  computeDaySessions,
  computeDifficultyBreakdown,
  computeImprovementAreas,
  computeOperationBreakdown,
  computeTotalSessionTimeMs,
  formatAccuracy,
  formatDurationMs,
  formatTotalTimeMs,
  getRecentMistakes,
} from '../domain/analytics';
import { MODE_META, OPERATION_META } from '../domain/levels';
import type { Operation, UserData } from '../domain/types';

interface ProgressPageProps {
  userData: UserData;
  onPracticeOperation?: (operation: Operation) => void;
}

type ProgressView = 'summary' | 'sessions' | 'focus';

export function ProgressPage({
  userData,
  onPracticeOperation,
}: ProgressPageProps) {
  const { attempts, sessions } = userData;
  const [view, setView] = useState<ProgressView>('summary');

  const totalAttempts = attempts.length;
  const overallAcc = computeAccuracy(attempts);
  const avgTime = computeAverageTimeMs(attempts);
  const totalPracticeMs = computeTotalSessionTimeMs(sessions);

  const dailyHistory = computeDailyHistory(attempts, 14);
  const daySessions = computeDaySessions(sessions, 14);
  const maxDaily = Math.max(1, ...dailyHistory.map((d) => d.count));

  const [expandedDay, setExpandedDay] = useState<string | null>(
    daySessions[0]?.dateKey ?? null,
  );

  const opBreakdown = computeOperationBreakdown(attempts);
  const diffBreakdown = computeDifficultyBreakdown(attempts);
  const recentMistakes = getRecentMistakes(attempts, 8);
  const improvementAreas = computeImprovementAreas(attempts);

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">
            Fluency metrics, session history, and areas to practice.
          </p>
        </div>

        <div className="segmented-row" role="tablist" aria-label="Progress view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'summary'}
            className={`segment-btn${view === 'summary' ? ' selected' : ''}`}
            onClick={() => setView('summary')}
          >
            Summary
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'sessions'}
            className={`segment-btn${view === 'sessions' ? ' selected' : ''}`}
            onClick={() => setView('sessions')}
          >
            Daily Sessions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'focus'}
            className={`segment-btn${view === 'focus' ? ' selected' : ''}`}
            onClick={() => setView('focus')}
          >
            Focus & Mistakes
          </button>
        </div>
      </div>

      <section className="metrics-strip" aria-label="Overall statistics">
        <div className="metric-cell">
          <div className="metric-label">Questions</div>
          <div className="metric-value">{totalAttempts}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Accuracy</div>
          <div className="metric-value">{formatAccuracy(overallAcc)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Avg / Question</div>
          <div className="metric-value">{formatDurationMs(avgTime)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Total Time</div>
          <div className="metric-value">
            {formatTotalTimeMs(totalPracticeMs)}
          </div>
          <div className="metric-sub">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </div>
        </div>
      </section>

      {view === 'summary' && (
        <>
          <section className="section" aria-label="Daily practice volume">
            <div className="section-header">
              <h2 className="section-title">Last 14 Days</h2>
              <span
                className="page-subtitle"
                style={{ margin: 0, fontSize: 12 }}
              >
                Questions per day
              </span>
            </div>
            <div className="chart-container">
              <svg
                viewBox="0 0 560 96"
                width="100%"
                height="96"
                role="img"
                aria-label="14-day practice volume chart"
                style={{ display: 'block' }}
              >
                {dailyHistory.map((day, idx) => {
                  const barWidth = 28;
                  const gap = 12;
                  const x = idx * (barWidth + gap);
                  const maxBarHeight = 64;
                  const barHeight =
                    day.count > 0
                      ? Math.max(
                          4,
                          Math.round((day.count / maxDaily) * maxBarHeight),
                        )
                      : 2;
                  const y = 72 - barHeight;

                  return (
                    <g key={day.dateKey}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx={2}
                        fill={day.count > 0 ? 'var(--accent)' : 'var(--border)'}
                        opacity={day.count > 0 ? 0.85 : 1}
                      >
                        <title>
                          {day.label}: {day.count} questions
                          {day.accuracy !== null
                            ? ` (${day.accuracy.toFixed(0)}%)`
                            : ''}
                        </title>
                      </rect>
                      {(idx === 0 || idx === 6 || idx === 13) && (
                        <text
                          x={x + barWidth / 2}
                          y={90}
                          textAnchor="middle"
                          fontSize="10"
                          fill="var(--text-faint)"
                        >
                          {day.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </section>

          <section className="section" aria-label="Performance by operation">
            <div className="section-header">
              <h2 className="section-title">By Operation</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th className="num">Level</th>
                    <th className="num">Attempts</th>
                    <th className="num">Accuracy</th>
                    <th className="num">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {opBreakdown.map((row) => (
                    <tr key={row.operation}>
                      <td>
                        {OPERATION_META[row.operation].label}{' '}
                        <span className="muted-cell">
                          ({OPERATION_META[row.operation].symbol})
                        </span>
                      </td>
                      <td className="num">
                        L{userData.operations[row.operation].currentLevel}
                      </td>
                      <td className="num">{row.attempts}</td>
                      <td className="num">{formatAccuracy(row.accuracy)}</td>
                      <td className="num">{formatDurationMs(row.avgTimeMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section" aria-label="Performance by difficulty">
            <div className="section-header">
              <h2 className="section-title">By Difficulty</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th className="num">Attempts</th>
                    <th className="num">Accuracy</th>
                    <th className="num">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {diffBreakdown.map((row) => (
                    <tr key={row.level}>
                      <td>Level {row.level}</td>
                      <td className="num">{row.attempts}</td>
                      <td className="num">{formatAccuracy(row.accuracy)}</td>
                      <td className="num">{formatDurationMs(row.avgTimeMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {view === 'sessions' && (
        <section className="section" aria-label="Daily sessions">
          {daySessions.length === 0 ? (
            <p className="page-subtitle">
              Complete a practice session to see your daily session log.
            </p>
          ) : (
            <div className="row-list">
              {daySessions.map((day) => {
                const isExpanded = expandedDay === day.dateKey;
                const dayAcc =
                  day.totalQuestions > 0
                    ? (day.correctCount / day.totalQuestions) * 100
                    : null;

                return (
                  <div
                    key={day.dateKey}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <button
                      type="button"
                      className="row-item-interactive"
                      style={{ borderBottom: 'none' }}
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedDay(isExpanded ? null : day.dateKey)
                      }
                    >
                      <div>
                        <div className="op-name">{day.label}</div>
                        <div className="op-level">
                          {day.sessions.length}{' '}
                          {day.sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
                          {day.totalQuestions} questions ·{' '}
                          {formatAccuracy(dayAcc)} accuracy ·{' '}
                          {formatTotalTimeMs(day.totalTimeMs)} total
                        </div>
                      </div>
                      <span className="op-action-hint">
                        {isExpanded ? 'Hide' : 'Show'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="table-scroll" style={{ paddingBottom: 12 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Time</th>
                              <th>Session</th>
                              <th className="num">Score</th>
                              <th className="num">Accuracy</th>
                              <th className="num">Avg / Q</th>
                              <th className="num">Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {day.sessions.map((s) => {
                              const sessAcc =
                                s.totalQuestions > 0
                                  ? (s.correctCount / s.totalQuestions) * 100
                                  : null;
                              const opName =
                                s.operation === 'mixed'
                                  ? 'Mixed'
                                  : OPERATION_META[s.operation].label;
                              const timeStr = new Date(
                                s.endedAt,
                              ).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              });
                              const wholeTime = formatTotalTimeMs(
                                Math.max(0, s.endedAt - s.startedAt),
                              );

                              return (
                                <tr key={s.id}>
                                  <td className="muted-cell">{timeStr}</td>
                                  <td>
                                    {opName} · L{s.level}{' '}
                                    <span className="muted-cell">
                                      ({MODE_META[s.mode].label})
                                    </span>
                                  </td>
                                  <td className="num">
                                    {s.correctCount}/{s.totalQuestions}
                                  </td>
                                  <td className="num">
                                    {formatAccuracy(sessAcc)}
                                  </td>
                                  <td className="num">
                                    {formatDurationMs(s.averageResponseTimeMs)}
                                  </td>
                                  <td className="num">{wholeTime}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {view === 'focus' && (
        <>
          <section className="section" aria-label="Areas for improvement">
            <div className="section-header">
              <h2 className="section-title">Areas for Improvement</h2>
            </div>
            {attempts.length === 0 ? (
              <p className="page-subtitle">
                Complete a few questions to see personalized focus areas.
              </p>
            ) : improvementAreas.length > 0 ? (
              <div className="row-list">
                {improvementAreas.map((area) => (
                  <div
                    key={`${area.operation}-${area.level}`}
                    className="row-item"
                  >
                    <div>
                      <div className="op-name">{area.title}</div>
                      <div className="op-level">{area.detail}</div>
                    </div>
                    {onPracticeOperation && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => onPracticeOperation(area.operation)}
                      >
                        Practice
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="page-subtitle">
                No weak areas detected — accuracy and response times are on
                target.
              </p>
            )}
          </section>

          <section className="section" aria-label="Recent mistakes">
            <div className="section-header">
              <h2 className="section-title">Recent Mistakes</h2>
            </div>
            {recentMistakes.length === 0 ? (
              <p className="page-subtitle">No recent mistakes recorded.</p>
            ) : (
              <div className="row-list">
                {recentMistakes.map((m, idx) => (
                  <div
                    key={`${m.timestamp}-${idx}`}
                    className="row-item"
                    style={{ alignItems: 'flex-start' }}
                  >
                    <div>
                      <div className="op-name tabular">
                        {m.expression} = {m.correctAnswer}
                      </div>
                      {m.strategy && (
                        <div className="op-level" style={{ marginTop: 2 }}>
                          {m.strategy}
                        </div>
                      )}
                    </div>
                    <div className="op-stats">
                      <span style={{ color: 'var(--error)' }}>
                        Answered {m.userAnswer ?? '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
