import { getLevelDefinition, OPERATION_META, OPERATIONS } from './levels';
import type { Attempt, DifficultyLevel, Operation } from './types';

export function toLocalDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayAttempts(attempts: Attempt[], now = Date.now()): Attempt[] {
  const today = toLocalDateKey(now);
  return attempts.filter((a) => toLocalDateKey(a.timestamp) === today);
}

export function computeAccuracy(attempts: Attempt[]): number | null {
  if (attempts.length === 0) return null;
  const correct = attempts.filter((a) => a.isCorrect).length;
  return (correct / attempts.length) * 100;
}

export function computeAverageTimeMs(attempts: Attempt[]): number | null {
  const valid = attempts.filter((a) => a.responseTimeMs > 0);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, a) => acc + a.responseTimeMs, 0);
  return sum / valid.length;
}

export function computeBestTimeMs(attempts: Attempt[]): number | null {
  const correct = attempts.filter((a) => a.isCorrect && a.responseTimeMs > 0);
  if (correct.length === 0) return null;
  return Math.min(...correct.map((a) => a.responseTimeMs));
}

export function computeStreakDays(attempts: Attempt[], now = Date.now()): number {
  if (attempts.length === 0) return 0;

  const activeDays = new Set(attempts.map((a) => toLocalDateKey(a.timestamp)));
  const todayKey = toLocalDateKey(now);
  const yesterdayKey = toLocalDateKey(now - 86_400_000);

  if (!activeDays.has(todayKey) && !activeDays.has(yesterdayKey)) {
    return 0;
  }

  let streak = 0;
  let cursor = activeDays.has(todayKey) ? now : now - 86_400_000;

  while (activeDays.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor -= 86_400_000;
  }

  return streak;
}

export interface DailyHistoryEntry {
  dateKey: string;
  label: string;
  count: number;
  accuracy: number | null;
}

export function computeDailyHistory(
  attempts: Attempt[],
  days = 14,
  now = Date.now(),
): DailyHistoryEntry[] {
  const grouped = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const key = toLocalDateKey(a.timestamp);
    const list = grouped.get(key);
    if (list) {
      list.push(a);
    } else {
      grouped.set(key, [a]);
    }
  }

  const result: DailyHistoryEntry[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * 86_400_000;
    const key = toLocalDateKey(ts);
    const d = new Date(ts);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayAttempts = grouped.get(key) ?? [];
    result.push({
      dateKey: key,
      label,
      count: dayAttempts.length,
      accuracy: computeAccuracy(dayAttempts),
    });
  }

  return result;
}

export interface OperationStats {
  operation: Operation;
  attempts: number;
  accuracy: number | null;
  avgTimeMs: number | null;
}

export function computeOperationBreakdown(attempts: Attempt[]): OperationStats[] {
  return OPERATIONS.map((operation) => {
    const filtered = attempts.filter((a) => a.operation === operation);
    return {
      operation,
      attempts: filtered.length,
      accuracy: computeAccuracy(filtered),
      avgTimeMs: computeAverageTimeMs(filtered),
    };
  });
}

export interface LevelStats {
  level: DifficultyLevel;
  attempts: number;
  accuracy: number | null;
  avgTimeMs: number | null;
}

export function computeDifficultyBreakdown(attempts: Attempt[]): LevelStats[] {
  const levels: DifficultyLevel[] = [1, 2, 3, 4, 5, 6, 7];
  return levels.map((level) => {
    const filtered = attempts.filter((a) => a.level === level);
    return {
      level,
      attempts: filtered.length,
      accuracy: computeAccuracy(filtered),
      avgTimeMs: computeAverageTimeMs(filtered),
    };
  });
}

export interface MistakeSummary {
  expression: string;
  operation: Operation;
  level: DifficultyLevel;
  userAnswer: number | null;
  correctAnswer: number;
  strategy?: string;
  timestamp: number;
}

export function getRecentMistakes(attempts: Attempt[], limit = 8): MistakeSummary[] {
  return attempts
    .filter((a) => !a.isCorrect)
    .slice(-limit)
    .reverse()
    .map((a) => ({
      expression: a.expression,
      operation: a.operation,
      level: a.level,
      userAnswer: a.userAnswer,
      correctAnswer: a.correctAnswer,
      strategy: a.strategy,
      timestamp: a.timestamp,
    }));
}

export interface ImprovementArea {
  operation: Operation;
  level: DifficultyLevel;
  title: string;
  detail: string;
}

export function computeImprovementAreas(attempts: Attempt[]): ImprovementArea[] {
  if (attempts.length === 0) return [];

  const buckets = new Map<string, { op: Operation; level: DifficultyLevel; items: Attempt[] }>();
  for (const a of attempts.slice(-150)) {
    const key = `${a.operation}:${a.level}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(a);
    } else {
      buckets.set(key, { op: a.operation, level: a.level, items: [a] });
    }
  }

  const areas: Array<ImprovementArea & { priority: number }> = [];

  for (const { op, level, items } of buckets.values()) {
    if (items.length < 3) continue;
    const acc = computeAccuracy(items) ?? 100;
    const avgMs = computeAverageTimeMs(items) ?? 0;
    const targetMs = getLevelDefinition(op, level).targetTimeMs;
    const opLabel = OPERATION_META[op].label;
    const lvlName = getLevelDefinition(op, level).shortLabel;

    if (acc < 85) {
      areas.push({
        operation: op,
        level,
        title: `${opLabel} · Level ${level} (${lvlName})`,
        detail: `${acc.toFixed(0)}% accuracy across ${items.length} questions`,
        priority: (100 - acc) * 2,
      });
    } else if (avgMs > targetMs * 1.25) {
      areas.push({
        operation: op,
        level,
        title: `${opLabel} · Level ${level} (${lvlName})`,
        detail: `${(avgMs / 1000).toFixed(1)}s avg vs ${(targetMs / 1000).toFixed(1)}s target`,
        priority: (avgMs / targetMs) * 15,
      });
    }
  }

  return areas
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4)
    .map(({ operation, level, title, detail }) => ({
      operation,
      level,
      title,
      detail,
    }));
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatAccuracy(acc: number | null): string {
  if (acc === null || !Number.isFinite(acc)) return '—';
  return `${acc.toFixed(1)}%`;
}
