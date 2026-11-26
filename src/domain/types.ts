export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';

export type TrainingMode = 'practice' | 'speed' | 'mental' | 'adaptive';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type NavTab = 'overview' | 'practice' | 'progress' | 'settings';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Question {
  id: string;
  operation: Operation;
  level: DifficultyLevel;
  a: number;
  b: number;
  /** Formatted display expression, e.g. "48 × 25" */
  expression: string;
  answer: number;
  /** Optional concise mental calculation strategy shown on error or review */
  strategy?: string;
  /** Optional tag for weak-area tracking, e.g. "carrying", "borrowing", "x25", "div-2digit" */
  skillTag?: string;
}

export interface Attempt {
  id: string;
  timestamp: number;
  operation: Operation;
  level: DifficultyLevel;
  mode: TrainingMode;
  expression: string;
  correctAnswer: number;
  userAnswer: number | null;
  isCorrect: boolean;
  responseTimeMs: number;
  strategy?: string;
  skillTag?: string;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  mode: TrainingMode;
  operation: Operation | 'mixed';
  level: DifficultyLevel;
  totalQuestions: number;
  correctCount: number;
  averageResponseTimeMs: number;
  bestResponseTimeMs: number | null;
  leveledUpTo?: DifficultyLevel;
}

export interface OperationState {
  currentLevel: DifficultyLevel;
  /** Number of distinct sessions completed at current level */
  sessionsAtCurrentLevel: number;
}

export interface UserSettings {
  theme: ThemePreference;
  defaultSessionLength: 15 | 20 | 30 | 50;
  speedModeDurationSec: 60 | 90 | 120;
  showTimerInPractice: boolean;
  dailyGoal: 20 | 30 | 50 | 100;
  autoAdvanceDelayMs: 0 | 350 | 700;
  requireSubmitButton: boolean;
  showTouchNumpad: boolean;
  soundEnabled: boolean;
}

export interface UserData {
  settings: UserSettings;
  operations: Record<Operation, OperationState>;
  attempts: Attempt[];
  sessions: SessionRecord[];
  lastOperation: Operation;
  lastMode: TrainingMode;
}

export interface LevelDefinition {
  level: DifficultyLevel;
  name: string;
  shortLabel: string;
  targetTimeMs: number;
}
