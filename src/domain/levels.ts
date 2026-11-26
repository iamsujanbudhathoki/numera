import type { DifficultyLevel, LevelDefinition, Operation, TrainingMode } from './types';

export const OPERATIONS: Operation[] = [
  'addition',
  'subtraction',
  'multiplication',
  'division',
];

export const OPERATION_META: Record<
  Operation,
  { label: string; symbol: string; short: string }
> = {
  addition: { label: 'Addition', symbol: '+', short: 'Add' },
  subtraction: { label: 'Subtraction', symbol: '−', short: 'Sub' },
  multiplication: { label: 'Multiplication', symbol: '×', short: 'Mul' },
  division: { label: 'Division', symbol: '÷', short: 'Div' },
};

export const MODE_META: Record<
  TrainingMode,
  { label: string; description: string }
> = {
  practice: {
    label: 'Practice',
    description: 'Untimed, accuracy-focused at your own pace.',
  },
  speed: {
    label: 'Speed',
    description: 'Timed sprint measuring calculation speed and accuracy.',
  },
  mental: {
    label: 'Mental',
    description: 'Distraction-free, no timer or running metrics.',
  },
  adaptive: {
    label: 'Adaptive',
    description: 'Adjusts difficulty and reinforces weak patterns.',
  },
};

export const LEVEL_DEFINITIONS: Record<Operation, LevelDefinition[]> = {
  addition: [
    { level: 1, name: 'Single-digit addition', shortLabel: 'Single-digit', targetTimeMs: 2500 },
    { level: 2, name: 'Double-digit without carrying', shortLabel: 'No carrying', targetTimeMs: 3500 },
    { level: 3, name: 'Addition with carrying', shortLabel: 'Carrying', targetTimeMs: 4500 },
    { level: 4, name: 'Three-digit addition', shortLabel: 'Three-digit', targetTimeMs: 6500 },
    { level: 5, name: 'Large-number addition', shortLabel: 'Large numbers', targetTimeMs: 8500 },
    { level: 6, name: 'Mental calculation strategies', shortLabel: 'Mental strategies', targetTimeMs: 5500 },
    { level: 7, name: 'Advanced calculations', shortLabel: 'Advanced', targetTimeMs: 9500 },
  ],
  subtraction: [
    { level: 1, name: 'Single-digit subtraction', shortLabel: 'Single-digit', targetTimeMs: 2500 },
    { level: 2, name: 'Double-digit without borrowing', shortLabel: 'No borrowing', targetTimeMs: 3500 },
    { level: 3, name: 'Subtraction with borrowing', shortLabel: 'Borrowing', targetTimeMs: 4800 },
    { level: 4, name: 'Three-digit subtraction', shortLabel: 'Three-digit', targetTimeMs: 6800 },
    { level: 5, name: 'Large-number subtraction', shortLabel: 'Large numbers', targetTimeMs: 9000 },
    { level: 6, name: 'Mental calculation strategies', shortLabel: 'Mental strategies', targetTimeMs: 5800 },
    { level: 7, name: 'Advanced calculations', shortLabel: 'Advanced', targetTimeMs: 10000 },
  ],
  multiplication: [
    { level: 1, name: 'Single-digit multiplication', shortLabel: 'Single-digit', targetTimeMs: 2800 },
    { level: 2, name: 'Two-digit by single-digit', shortLabel: '2×1 digit', targetTimeMs: 4500 },
    { level: 3, name: 'Teens & carrying products', shortLabel: 'Carrying', targetTimeMs: 6000 },
    { level: 4, name: 'Two-digit by two-digit', shortLabel: '2×2 digit', targetTimeMs: 9500 },
    { level: 5, name: 'Three-digit multiplication', shortLabel: 'Three-digit', targetTimeMs: 11000 },
    { level: 6, name: 'Mental calculation strategies', shortLabel: 'Mental strategies', targetTimeMs: 6000 },
    { level: 7, name: 'Advanced calculations', shortLabel: 'Advanced', targetTimeMs: 12000 },
  ],
  division: [
    { level: 1, name: 'Single-digit divisors', shortLabel: 'Basic facts', targetTimeMs: 3000 },
    { level: 2, name: 'Two-digit by single-digit', shortLabel: '2÷1 digit', targetTimeMs: 4500 },
    { level: 3, name: 'Three-digit by single-digit', shortLabel: '3÷1 digit', targetTimeMs: 6500 },
    { level: 4, name: 'Two-digit divisors', shortLabel: '2-digit divisor', targetTimeMs: 8500 },
    { level: 5, name: 'Large-number exact division', shortLabel: 'Large numbers', targetTimeMs: 10500 },
    { level: 6, name: 'Mental calculation strategies', shortLabel: 'Mental strategies', targetTimeMs: 6000 },
    { level: 7, name: 'Advanced calculations', shortLabel: 'Advanced', targetTimeMs: 12000 },
  ],
};

export function getLevelDefinition(
  operation: Operation,
  level: DifficultyLevel,
): LevelDefinition {
  return LEVEL_DEFINITIONS[operation][level - 1];
}
