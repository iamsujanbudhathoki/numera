import { describe, expect, it } from 'vitest';
import {
  evaluateLevelAdvancement,
  identifyWeakestOperation,
  updateAdaptiveState,
  type AdaptiveState,
} from './adaptive';
import {
  computeAccuracy,
  computeAverageTimeMs,
  computeDailyHistory,
  computeStreakDays,
} from './analytics';
import { generateQuestion } from './generator';
import { OPERATIONS } from './levels';
import type { Attempt, DifficultyLevel } from './types';

describe('Question Generator', () => {
  const levels: DifficultyLevel[] = [1, 2, 3, 4, 5, 6, 7];

  for (const op of OPERATIONS) {
    for (const level of levels) {
      it(`generates valid ${op} questions at level ${level}`, () => {
        const recent = new Set<string>();
        for (let i = 0; i < 30; i++) {
          const q = generateQuestion(op, level, recent);
          expect(q.operation).toBe(op);
          expect(q.level).toBe(level);
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThanOrEqual(0);

          if (op === 'addition') {
            expect(q.a + q.b).toBe(q.answer);
          } else if (op === 'subtraction') {
            expect(q.a - q.b).toBe(q.answer);
            expect(q.a).toBeGreaterThanOrEqual(q.b);
          } else if (op === 'multiplication') {
            expect(q.a * q.b).toBe(q.answer);
          } else if (op === 'division') {
            expect(q.b).toBeGreaterThan(0);
            expect(q.a % q.b).toBe(0);
            expect(q.a / q.b).toBe(q.answer);
          }
        }
      });
    }
  }

  it('avoids repeating identical questions in a session', () => {
    const recent = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const q = generateQuestion('multiplication', 4, recent);
      const canonical = `${Math.min(q.a, q.b)}x${Math.max(q.a, q.b)}`;
      expect(seen.has(canonical)).toBe(false);
      seen.add(canonical);
    }
  });
});

describe('Level Advancement & Adaptive Logic', () => {
  function makeAttempts(
    count: number,
    overrides: Partial<Attempt> = {},
  ): Attempt[] {
    return Array.from({ length: count }, (_, idx) => ({
      id: `a-${idx}`,
      timestamp: Date.now() - (count - idx) * 1000,
      operation: 'addition',
      level: 1,
      mode: 'practice',
      expression: '3 + 4',
      correctAnswer: 7,
      userAnswer: 7,
      isCorrect: true,
      responseTimeMs: 1800,
      ...overrides,
    }));
  }

  it('does not advance with insufficient attempts or only 1 session', () => {
    const attempts = makeAttempts(20);
    const res = evaluateLevelAdvancement(
      'addition',
      { currentLevel: 1, sessionsAtCurrentLevel: 1 },
      attempts,
    );
    expect(res.shouldAdvance).toBe(false);
  });

  it('advances when accuracy, speed, consistency, and sessions meet criteria', () => {
    const attempts = makeAttempts(20);
    const res = evaluateLevelAdvancement(
      'addition',
      { currentLevel: 1, sessionsAtCurrentLevel: 2 },
      attempts,
    );
    expect(res.shouldAdvance).toBe(true);
    expect(res.nextLevel).toBe(2);
  });

  it('does not advance if response time is too slow', () => {
    const attempts = makeAttempts(20, { responseTimeMs: 6000 });
    const res = evaluateLevelAdvancement(
      'addition',
      { currentLevel: 1, sessionsAtCurrentLevel: 3 },
      attempts,
    );
    expect(res.shouldAdvance).toBe(false);
  });

  it('identifies weakest operation and adapts difficulty', () => {
    const good = makeAttempts(10, { operation: 'addition', isCorrect: true, responseTimeMs: 1500 });
    const weak = makeAttempts(10, { operation: 'division', isCorrect: false, responseTimeMs: 5000 });
    const mult = makeAttempts(10, { operation: 'multiplication', isCorrect: true, responseTimeMs: 2000 });
    const sub = makeAttempts(10, { operation: 'subtraction', isCorrect: true, responseTimeMs: 1800 });

    expect(identifyWeakestOperation([...good, ...weak, ...mult, ...sub])).toBe('division');

    let state: AdaptiveState = {
      currentLevel: 2,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      reinforcementQueue: [],
    };
    for (let i = 0; i < 3; i++) {
      state = updateAdaptiveState(state, {
        operation: 'addition',
        level: 2,
        isCorrect: true,
        responseTimeMs: 2000,
      });
    }
    expect(state.currentLevel).toBe(3);

    state = updateAdaptiveState(state, {
      operation: 'addition',
      level: 3,
      isCorrect: false,
      responseTimeMs: 4000,
    });
    expect(state.reinforcementQueue.length).toBe(1);
    state = updateAdaptiveState(state, {
      operation: 'addition',
      level: 3,
      isCorrect: false,
      responseTimeMs: 4000,
    });
    expect(state.currentLevel).toBe(2);
  });
});

describe('Analytics', () => {
  it('computes accuracy, average time, streak, and daily history', () => {
    const now = new Date(2026, 10, 26, 12, 0, 0).getTime();
    const dayMs = 86_400_000;
    const attempts: Attempt[] = [
      {
        id: '1',
        timestamp: now - 2 * dayMs,
        operation: 'addition',
        level: 1,
        mode: 'practice',
        expression: '2 + 3',
        correctAnswer: 5,
        userAnswer: 5,
        isCorrect: true,
        responseTimeMs: 1500,
      },
      {
        id: '2',
        timestamp: now - dayMs,
        operation: 'addition',
        level: 1,
        mode: 'practice',
        expression: '4 + 5',
        correctAnswer: 9,
        userAnswer: 8,
        isCorrect: false,
        responseTimeMs: 2500,
      },
      {
        id: '3',
        timestamp: now,
        operation: 'multiplication',
        level: 1,
        mode: 'speed',
        expression: '6 × 7',
        correctAnswer: 42,
        userAnswer: 42,
        isCorrect: true,
        responseTimeMs: 2000,
      },
    ];

    expect(computeAccuracy(attempts)).toBeCloseTo(66.666, 1);
    expect(computeAverageTimeMs(attempts)).toBe(2000);
    expect(computeStreakDays(attempts, now)).toBe(3);

    const history = computeDailyHistory(attempts, 7, now);
    expect(history).toHaveLength(7);
    expect(history[6].count).toBe(1);
    expect(history[5].count).toBe(1);
    expect(history[4].count).toBe(1);
  });
});
