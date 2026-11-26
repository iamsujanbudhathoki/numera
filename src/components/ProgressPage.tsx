import {
  computeAccuracy,
  computeAverageTimeMs,
  computeBestTimeMs,
  computeDailyHistory,
  computeDifficultyBreakdown,
  computeImprovementAreas,
  computeOperationBreakdown,
  formatAccuracy,
  formatDurationMs,
  getRecentMistakes,
} from '../domain/analytics';
import { OPERATION_META } from '../domain/levels';
import type { Operation, UserData } from '../domain/types';

interface ProgressPageProps {
  userData: UserData;
  onPracticeOperation?: (operation: Operation) => void;
}

export function ProgressPage({
  userData,
  onPracticeOperation,
}: ProgressPageProps) {
  const { attempts } = userData;
  const totalAttempts = attempts.length;
  const overallAcc = computeAccuracy(attempts);
  const avgTime = computeAverageTimeMs(attempts);
  const bestTime = computeBestTimeMs(attempts);

  const dailyHistory = computeDailyHistory(attempts, 14);
  const activeDays = dailyHistory.filter((d) => d.count > 0).reverse();
  const maxDaily = Math.max(1, ...dailyHistory.map((d) => d.count));

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

      {activeDays.length > 0 && (
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
