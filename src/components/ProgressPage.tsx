import { useState } from 'react';
import {
  computeAccuracy,
  computeAverageTimeMs,
  computeBestTimeMs,
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

export function ProgressPage({
  userData,
  onPracticeOperation,
}: ProgressPageProps) {
  const { attempts, sessions } = userData;
  const totalAttempts = attempts.length;
  const overallAcc = computeAccuracy(attempts);
  const avgTime = computeAverageTimeMs(attempts);
  const bestTime = computeBestTimeMs(attempts);
  const totalPracticeMs = computeTotalSessionTimeMs(sessions);

  const dailyHistory = computeDailyHistory(attempts, 14);
  const activeDays = dailyHistory.filter((d) => d.count > 0).reverse();
  const daySessions = computeDaySessions(sessions, 14);
  const maxDaily = Math.max(1, ...dailyHistory.map((d) => d.count));

  const [expandedDay, setExpandedDay] = useState<string | null>(
    daySessions[0]?.dateKey ?? null,
  );

  const opBreakdown = computeOperationBreakdown(attempts);
  const diffBreakdown = computeDifficultyBreakdown(attempts);
  const recentMistakes = getRecentMistakes(attempts, 6);
  const improvementAreas = computeImprovementAreas(attempts);
  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-subtitle">
            Numerical fluency metrics across all sessions.
          </p>
        </div>
      </div>

      <section className="metrics-strip" aria-label="Overall statistics">
        <div className="metric-cell">
          <div className="metric-label">Total Attempted</div>
          <div className="metric-value">{totalAttempts}</div>
          <div className="metric-sub">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
            {formatTotalTimeMs(totalPracticeMs)}
          </div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Overall Accuracy</div>
          <div className="metric-value">{formatAccuracy(overallAcc)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Avg Response</div>
          <div className="metric-value">{formatDurationMs(avgTime)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Best Response</div>
          <div className="metric-value">{formatDurationMs(bestTime)}</div>
        </div>
      </section>

      <section className="section" aria-label="Daily practice history">
        <div className="section-header">
          <h2 className="section-title">Last 14 Days</h2>
          <span className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>
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
                  ? Math.max(4, Math.round((day.count / maxDaily) * maxBarHeight))
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

      {daySessions.length > 0 ? (
        <section className="section" aria-label="Daily sessions and analytics">
          <div className="section-header">
            <h2 className="section-title">Daily Sessions</h2>
            <span className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>
              Click a day to view sessions
            </span>
          </div>
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
                        {day.totalQuestions} questions
                      </div>
                    </div>
                    <div className="op-stats">
                      <span>{formatAccuracy(dayAcc)}</span>
                      <span>{formatDurationMs(day.avgResponseTimeMs)} avg</span>
                      <span>{formatTotalTimeMs(day.totalTimeMs)}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div
                      style={{
                        padding: '0 8px 14px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {day.sessions.map((s) => {
                        const sessAcc =
                          s.totalQuestions > 0
                            ? (s.correctCount / s.totalQuestions) * 100
                            : null;
                        const opName =
                          s.operation === 'mixed'
                            ? 'Mixed'
                            : OPERATION_META[s.operation].label;
                        const timeStr = new Date(s.endedAt).toLocaleTimeString(
                          'en-US',
                          { hour: 'numeric', minute: '2-digit' },
                        );
                        const wholeTime = formatTotalTimeMs(
                          Math.max(0, s.endedAt - s.startedAt),
                        );

                        return (
                          <div
                            key={s.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                              padding: '8px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 13,
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 500 }}>
                                {opName} · L{s.level}
                              </span>{' '}
                              <span className="muted-cell">
                                ({MODE_META[s.mode].label} · {timeStr})
                              </span>
                            </div>
                            <div
                              className="tabular muted-cell"
                              style={{ display: 'flex', gap: 14 }}
                            >
                              <span>
                                {s.correctCount}/{s.totalQuestions} (
                                {formatAccuracy(sessAcc)})
                              </span>
                              <span>
                                {formatDurationMs(s.averageResponseTimeMs)}/q
                              </span>
                              <span>{wholeTime}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        activeDays.length > 0 && (
          <section className="section" aria-label="Daily records">
            <div className="section-header">
              <h2 className="section-title">Daily Records</h2>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Questions</th>
                    <th className="num">Accuracy</th>
                    <th className="num">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((day) => (
                    <tr key={day.dateKey}>
                      <td>{day.label}</td>
                      <td className="num">{day.count}</td>
                      <td className="num">{formatAccuracy(day.accuracy)}</td>
                      <td className="num">{formatDurationMs(day.avgTimeMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}

      {attempts.length > 0 && (
        <section className="section" aria-label="Areas requiring improvement">
          <div className="section-header">
            <h2 className="section-title">Areas for Improvement</h2>
          </div>
          {improvementAreas.length > 0 ? (
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
              No weak areas detected — accuracy and response times are on target.
            </p>
          )}
        </section>
      )}

      {recentMistakes.length > 0 && (
        <section className="section" aria-label="Recent mistakes">
          <div className="section-header">
            <h2 className="section-title">Recent Mistakes</h2>
          </div>
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
        </section>
      )}
    </main>
  );
}
