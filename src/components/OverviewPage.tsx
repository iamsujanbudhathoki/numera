import { ArrowRight, ChevronRight } from 'lucide-react';
import {
  computeAccuracy,
  computeAverageTimeMs,
  computeStreakDays,
  formatAccuracy,
  formatDurationMs,
  getTodayAttempts,
} from '../domain/analytics';
import {
  getLevelDefinition,
  OPERATION_META,
  OPERATIONS,
} from '../domain/levels';
import type { Operation, TrainingMode, UserData } from '../domain/types';

interface OverviewPageProps {
  userData: UserData;
  onStartPractice: (operation: Operation, mode?: TrainingMode) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

export function OverviewPage({ userData, onStartPractice }: OverviewPageProps) {
  const todayAttempts = getTodayAttempts(userData.attempts);
  const dailyGoal = userData.settings.dailyGoal;
  const todayPct = Math.min(100, (todayAttempts.length / dailyGoal) * 100);
  const streak = computeStreakDays(userData.attempts);
  const overallAccuracy = computeAccuracy(userData.attempts);
  const overallAvgTime = computeAverageTimeMs(userData.attempts);

  const lastOpLabel = OPERATION_META[userData.lastOperation].label;

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{getGreeting()}</h1>
          <p className="page-subtitle">
            Deliberate practice for numerical fluency.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            onStartPractice(userData.lastOperation, userData.lastMode)
          }
        >
          <span>Continue Practicing</span>
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>

      <section className="metrics-strip" aria-label="Training summary">
        <div className="metric-cell">
          <div className="metric-label">Today</div>
          <div className="metric-value">
            {todayAttempts.length} / {dailyGoal}
          </div>
          <div className="hairline-progress" aria-hidden="true">
            <div
              className="hairline-progress-fill"
              style={{ width: `${todayPct}%` }}
            />
          </div>
        </div>

        <div className="metric-cell">
          <div className="metric-label">Streak</div>
          <div className="metric-value">
            {streak} {streak === 1 ? 'day' : 'days'}
          </div>
          <div className="metric-sub">
            {todayAttempts.length > 0 ? 'Active today' : 'Not practiced today'}
          </div>
        </div>

        <div className="metric-cell">
          <div className="metric-label">Accuracy</div>
          <div className="metric-value">{formatAccuracy(overallAccuracy)}</div>
          <div className="metric-sub">
            {userData.attempts.length} total attempts
          </div>
        </div>

        <div className="metric-cell">
          <div className="metric-label">Avg Response</div>
          <div className="metric-value">{formatDurationMs(overallAvgTime)}</div>
          <div className="metric-sub">Last: {lastOpLabel}</div>
        </div>
      </section>

      <section className="section" aria-label="Arithmetic operations">
        <div className="section-header">
          <h2 className="section-title">Operations</h2>
          <div className="op-stats-header" aria-hidden="true">
            <span className="op-stat-col">Accuracy</span>
            <span className="op-stat-col">Avg Time</span>
            <span className="op-action-hint" style={{ visibility: 'hidden' }}>
              Practice
            </span>
          </div>
        </div>

        <div className="row-list">
          {OPERATIONS.map((op) => {
            const meta = OPERATION_META[op];
            const opState = userData.operations[op];
            const levelDef = getLevelDefinition(op, opState.currentLevel);
            const recent = userData.attempts
              .filter((a) => a.operation === op)
              .slice(-30);
            const acc = computeAccuracy(recent);
            const avgMs = computeAverageTimeMs(recent);

            return (
              <button
                key={op}
                type="button"
                className="row-item-interactive"
                onClick={() => onStartPractice(op)}
              >
                <div className="op-identity">
                  <span className="op-symbol" aria-hidden="true">
                    {meta.symbol}
                  </span>
                  <div>
                    <div className="op-name">{meta.label}</div>
                    <div className="op-level">
                      Level {opState.currentLevel} · {levelDef.shortLabel}
                    </div>
                  </div>
                </div>

                <div className="op-stats">
                  <span className="op-stat-col" title="Recent accuracy">
                    {formatAccuracy(acc)}
                  </span>
                  <span className="op-stat-col" title="Average response time">
                    {formatDurationMs(avgMs)}
                  </span>
                  <span
                    className="op-action-hint"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
                  >
                    Practice <ChevronRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
