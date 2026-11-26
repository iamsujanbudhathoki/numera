import type { UserData, UserSettings } from '../domain/types';

const STORAGE_KEY = 'numera_user_data_v1';
const MAX_STORED_ATTEMPTS = 5000;
const MAX_STORED_SESSIONS = 500;

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  defaultSessionLength: 20,
  speedModeDurationSec: 90,
  showTimerInPractice: false,
  dailyGoal: 30,
  autoAdvanceDelayMs: 350,
};

export function createDefaultUserData(): UserData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    operations: {
      addition: { currentLevel: 1, sessionsAtCurrentLevel: 0 },
      subtraction: { currentLevel: 1, sessionsAtCurrentLevel: 0 },
      multiplication: { currentLevel: 1, sessionsAtCurrentLevel: 0 },
      division: { currentLevel: 1, sessionsAtCurrentLevel: 0 },
    },
    attempts: [],
    sessions: [],
    lastOperation: 'addition',
    lastMode: 'practice',
  };
}

export function loadUserData(): UserData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultUserData();
    const parsed = JSON.parse(raw) as Partial<UserData>;
    const defaults = createDefaultUserData();
    return {
      settings: { ...defaults.settings, ...(parsed.settings ?? {}) },
      operations: {
        addition: parsed.operations?.addition ?? defaults.operations.addition,
        subtraction: parsed.operations?.subtraction ?? defaults.operations.subtraction,
        multiplication:
          parsed.operations?.multiplication ?? defaults.operations.multiplication,
        division: parsed.operations?.division ?? defaults.operations.division,
      },
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      lastOperation: parsed.lastOperation ?? defaults.lastOperation,
      lastMode: parsed.lastMode ?? defaults.lastMode,
    };
  } catch {
    return createDefaultUserData();
  }
}

export function saveUserData(data: UserData): void {
  try {
    const trimmed: UserData = {
      ...data,
      attempts: data.attempts.slice(-MAX_STORED_ATTEMPTS),
      sessions: data.sessions.slice(-MAX_STORED_SESSIONS),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function clearUserData(): UserData {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return createDefaultUserData();
}
