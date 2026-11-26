import { generateQuestion } from './generator';
import { getLevelDefinition, OPERATIONS } from './levels';
import type {
  Attempt,
  DifficultyLevel,
  Operation,
  OperationState,
  Question,
} from './types';

export interface AdvancementResult {
  shouldAdvance: boolean;
  nextLevel: DifficultyLevel;
  reason?: string;
}

/**
 * Evaluates whether a user should advance to the next difficulty level
 * for a given operation based on accuracy, speed, consistency, and
 * repeated performance across sessions.
 */
export function evaluateLevelAdvancement(
  operation: Operation,
  opState: OperationState,
  allAttempts: Attempt[],
): AdvancementResult {
  const current = opState.currentLevel;
  if (current >= 7) {
    return { shouldAdvance: false, nextLevel: current };
  }

  const levelAttempts = allAttempts.filter(
    (a) => a.operation === operation && a.level === current,
  );

  // Require at least 20 attempts and at least 2 sessions (or 30+ attempts)
  if (
    levelAttempts.length < 20 ||
    (opState.sessionsAtCurrentLevel < 2 && levelAttempts.length < 30)
  ) {
    return { shouldAdvance: false, nextLevel: current };
  }

  const recent20 = levelAttempts.slice(-20);
  const accuracy20 =
    recent20.filter((a) => a.isCorrect).length / recent20.length;

  const recent10 = levelAttempts.slice(-10);
  const errorsInLast10 = recent10.filter((a) => !a.isCorrect).length;

  const correctTimes = recent20
    .filter((a) => a.isCorrect)
    .map((a) => a.responseTimeMs);
  const avgTimeMs =
    correctTimes.length > 0
      ? correctTimes.reduce((sum, t) => sum + t, 0) / correctTimes.length
      : Infinity;

  const targetTimeMs = getLevelDefinition(operation, current).targetTimeMs;

  const meetsAccuracy = accuracy20 >= 0.9;
  const meetsConsistency = errorsInLast10 <= 1;
  const meetsSpeed = avgTimeMs <= targetTimeMs * 1.15;

  if (meetsAccuracy && meetsConsistency && meetsSpeed) {
    const nextLevel = (current + 1) as DifficultyLevel;
    return {
      shouldAdvance: true,
      nextLevel,
      reason: `${Math.round(accuracy20 * 100)}% accuracy · ${(avgTimeMs / 1000).toFixed(1)}s avg`,
    };
  }

  return { shouldAdvance: false, nextLevel: current };
}

export interface AdaptiveState {
  currentLevel: DifficultyLevel;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  /** Queue of weak (operation, level) pairs to reinforce */
  reinforcementQueue: Array<{ operation: Operation; level: DifficultyLevel }>;
}

/**
 * Scores each operation to find the user's weakest area for Adaptive Mode.
 */
export function identifyWeakestOperation(
  attempts: Attempt[],
  fallback: Operation = 'addition',
): Operation {
  if (attempts.length < 5) return fallback;

  let weakest: Operation = fallback;
  let lowestScore = Infinity;

  for (const op of OPERATIONS) {
    const opAttempts = attempts.filter((a) => a.operation === op).slice(-30);
    if (opAttempts.length === 0) {
      // Unpracticed operation gets high priority
      return op;
    }
    const accuracy =
      opAttempts.filter((a) => a.isCorrect).length / opAttempts.length;
    const avgMs =
      opAttempts.reduce((s, a) => s + a.responseTimeMs, 0) / opAttempts.length;
    // Higher accuracy and lower time = higher score
    const score = accuracy * 100 - Math.min(avgMs / 1000, 15) * 2;
    if (score < lowestScore) {
      lowestScore = score;
      weakest = op;
    }
  }

  return weakest;
}

export function updateAdaptiveState(
  state: AdaptiveState,
  lastAttempt: {
    operation: Operation;
    level: DifficultyLevel;
    isCorrect: boolean;
    responseTimeMs: number;
  },
): AdaptiveState {
  const targetMs = getLevelDefinition(
    lastAttempt.operation,
    lastAttempt.level,
  ).targetTimeMs;

  if (lastAttempt.isCorrect) {
    const isFluent = lastAttempt.responseTimeMs <= targetMs * 1.25;
    const consecutiveCorrect = isFluent ? state.consecutiveCorrect + 1 : 1;
    let nextLevel = state.currentLevel;
    let resetStreak = consecutiveCorrect;

    if (consecutiveCorrect >= 3 && state.currentLevel < 7) {
      nextLevel = (state.currentLevel + 1) as DifficultyLevel;
      resetStreak = 0;
    }

    return {
      ...state,
      currentLevel: nextLevel,
      consecutiveCorrect: resetStreak,
      consecutiveWrong: 0,
    };
  }

  // Incorrect: queue reinforcement and step down if struggling
  const consecutiveWrong = state.consecutiveWrong + 1;
  let nextLevel = state.currentLevel;
  if (consecutiveWrong >= 2 && state.currentLevel > 1) {
    nextLevel = (state.currentLevel - 1) as DifficultyLevel;
  }

  return {
    currentLevel: nextLevel,
    consecutiveCorrect: 0,
    consecutiveWrong,
    reinforcementQueue: [
      ...state.reinforcementQueue,
      { operation: lastAttempt.operation, level: lastAttempt.level },
    ],
  };
}

export function generateAdaptiveQuestion(
  selectedOperation: Operation | 'mixed',
  adaptiveState: AdaptiveState,
  allAttempts: Attempt[],
  questionIndex: number,
  recentKeys: Set<string>,
): { question: Question; nextState: AdaptiveState } {
  // Every 3rd question, reinforce a previously missed pattern if queued
  if (
    adaptiveState.reinforcementQueue.length > 0 &&
    questionIndex > 0 &&
    questionIndex % 3 === 0
  ) {
    const [reinforce, ...rest] = adaptiveState.reinforcementQueue;
    const q = generateQuestion(reinforce.operation, reinforce.level, recentKeys);
    return {
      question: q,
      nextState: { ...adaptiveState, reinforcementQueue: rest },
    };
  }

  const operation =
    selectedOperation === 'mixed'
      ? Math.random() < 0.5
        ? identifyWeakestOperation(allAttempts)
        : OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)]
      : selectedOperation;

  const q = generateQuestion(operation, adaptiveState.currentLevel, recentKeys);
  return { question: q, nextState: adaptiveState };
}
