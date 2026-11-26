import { OPERATIONS } from '../domain/levels';
import type {
  Attempt,
  DifficultyLevel,
  Operation,
  OperationState,
  SessionRecord,
  TrainingMode,
  UserData,
  UserSettings,
} from '../domain/types';
import { createDefaultUserData, DEFAULT_SETTINGS } from './persistence';
import { supabase } from './supabaseClient';

interface DbProfileRow {
  user_id: string;
  settings: Partial<UserSettings> | null;
  operations: Partial<Record<Operation, OperationState>> | null;
  last_operation: Operation | null;
  last_mode: TrainingMode | null;
}

interface DbAttemptRow {
  id: string;
  user_id: string;
  timestamp: number;
  operation: Operation;
  level: DifficultyLevel;
  mode: TrainingMode;
  expression: string;
  correct_answer: number;
  user_answer: number | null;
  is_correct: boolean;
  response_time_ms: number;
  strategy: string | null;
  skill_tag: string | null;
}

interface DbSessionRow {
  id: string;
  user_id: string;
  started_at: number;
  ended_at: number;
  mode: TrainingMode;
  operation: Operation | 'mixed';
  level: DifficultyLevel;
  total_questions: number;
  correct_count: number;
  average_response_time_ms: number;
  best_response_time_ms: number | null;
  leveled_up_to: DifficultyLevel | null;
}

function toDbAttempt(userId: string, a: Attempt): DbAttemptRow {
  return {
    id: a.id,
    user_id: userId,
    timestamp: a.timestamp,
    operation: a.operation,
    level: a.level,
    mode: a.mode,
    expression: a.expression,
    correct_answer: a.correctAnswer,
    user_answer: a.userAnswer,
    is_correct: a.isCorrect,
    response_time_ms: a.responseTimeMs,
    strategy: a.strategy ?? null,
    skill_tag: a.skillTag ?? null,
  };
}

function fromDbAttempt(row: DbAttemptRow): Attempt {
  return {
    id: row.id,
    timestamp: Number(row.timestamp),
    operation: row.operation,
    level: row.level,
    mode: row.mode,
    expression: row.expression,
    correctAnswer: row.correct_answer,
    userAnswer: row.user_answer,
    isCorrect: row.is_correct,
    responseTimeMs: row.response_time_ms,
    strategy: row.strategy ?? undefined,
    skillTag: row.skill_tag ?? undefined,
  };
}

function toDbSession(userId: string, s: SessionRecord): DbSessionRow {
  return {
    id: s.id,
    user_id: userId,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    mode: s.mode,
    operation: s.operation,
    level: s.level,
    total_questions: s.totalQuestions,
    correct_count: s.correctCount,
    average_response_time_ms: s.averageResponseTimeMs,
    best_response_time_ms: s.bestResponseTimeMs,
    leveled_up_to: s.leveledUpTo ?? null,
  };
}

function fromDbSession(row: DbSessionRow): SessionRecord {
  return {
    id: row.id,
    startedAt: Number(row.started_at),
    endedAt: Number(row.ended_at),
    mode: row.mode,
    operation: row.operation,
    level: row.level,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    averageResponseTimeMs: row.average_response_time_ms,
    bestResponseTimeMs: row.best_response_time_ms,
    leveledUpTo: row.leveled_up_to ?? undefined,
  };
}

export async function fetchCloudUserData(userId: string): Promise<UserData> {
  if (!supabase) return createDefaultUserData();

  const defaults = createDefaultUserData();

  const [profileRes, attemptsRes, sessionsRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true })
      .limit(5000),
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('ended_at', { ascending: true })
      .limit(500),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (attemptsRes.error) throw attemptsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  const profile = profileRes.data as DbProfileRow | null;
  const attempts = ((attemptsRes.data ?? []) as DbAttemptRow[]).map(
    fromDbAttempt,
  );
  const sessions = ((sessionsRes.data ?? []) as DbSessionRow[]).map(
    fromDbSession,
  );

  return {
    settings: { ...DEFAULT_SETTINGS, ...(profile?.settings ?? {}) },
    operations: {
      addition: profile?.operations?.addition ?? defaults.operations.addition,
      subtraction:
        profile?.operations?.subtraction ?? defaults.operations.subtraction,
      multiplication:
        profile?.operations?.multiplication ??
        defaults.operations.multiplication,
      division: profile?.operations?.division ?? defaults.operations.division,
    },
    attempts,
    sessions,
    lastOperation: profile?.last_operation ?? defaults.lastOperation,
    lastMode: profile?.last_mode ?? defaults.lastMode,
  };
}

export function mergeUserData(local: UserData, cloud: UserData): UserData {
  const attemptMap = new Map<string, Attempt>();
  for (const a of cloud.attempts) attemptMap.set(a.id, a);
  for (const a of local.attempts) attemptMap.set(a.id, a);
  const attempts = Array.from(attemptMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  const sessionMap = new Map<string, SessionRecord>();
  for (const s of cloud.sessions) sessionMap.set(s.id, s);
  for (const s of local.sessions) sessionMap.set(s.id, s);
  const sessions = Array.from(sessionMap.values()).sort(
    (a, b) => a.endedAt - b.endedAt,
  );

  const operations = { ...cloud.operations };
  for (const op of OPERATIONS) {
    const locOp = local.operations[op];
    const cldOp = cloud.operations[op];
    if (locOp.currentLevel > cldOp.currentLevel) {
      operations[op] = locOp;
    } else if (locOp.currentLevel === cldOp.currentLevel) {
      operations[op] = {
        currentLevel: locOp.currentLevel,
        sessionsAtCurrentLevel: Math.max(
          locOp.sessionsAtCurrentLevel,
          cldOp.sessionsAtCurrentLevel,
        ),
      };
    }
  }

  return {
    settings: cloud.attempts.length > 0 ? cloud.settings : local.settings,
    operations,
    attempts,
    sessions,
    lastOperation:
      cloud.sessions.length > 0 ? cloud.lastOperation : local.lastOperation,
    lastMode: cloud.sessions.length > 0 ? cloud.lastMode : local.lastMode,
  };
}

export async function pushProfileToCloud(
  userId: string,
  userData: UserData,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_profiles').upsert({
    user_id: userId,
    settings: userData.settings,
    operations: userData.operations,
    last_operation: userData.lastOperation,
    last_mode: userData.lastMode,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function pushAttemptToCloud(
  userId: string,
  attempt: Attempt,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('attempts')
    .upsert(toDbAttempt(userId, attempt));
  if (error) throw error;
}

export async function pushSessionAndProfileToCloud(
  userId: string,
  session: SessionRecord,
  userData: UserData,
): Promise<void> {
  if (!supabase) return;
  const [sessRes, profRes] = await Promise.all([
    supabase.from('sessions').upsert(toDbSession(userId, session)),
    supabase.from('user_profiles').upsert({
      user_id: userId,
      settings: userData.settings,
      operations: userData.operations,
      last_operation: userData.lastOperation,
      last_mode: userData.lastMode,
      updated_at: new Date().toISOString(),
    }),
  ]);
  if (sessRes.error) throw sessRes.error;
  if (profRes.error) throw profRes.error;
}

export async function pushFullUserDataToCloud(
  userId: string,
  userData: UserData,
): Promise<void> {
  if (!supabase) return;
  await pushProfileToCloud(userId, userData);

  if (userData.attempts.length > 0) {
    const rows = userData.attempts.map((a) => toDbAttempt(userId, a));
    const { error } = await supabase.from('attempts').upsert(rows);
    if (error) throw error;
  }

  if (userData.sessions.length > 0) {
    const rows = userData.sessions.map((s) => toDbSession(userId, s));
    const { error } = await supabase.from('sessions').upsert(rows);
    if (error) throw error;
  }
}

export async function clearCloudUserData(userId: string): Promise<void> {
  if (!supabase) return;
  await Promise.all([
    supabase.from('attempts').delete().eq('user_id', userId),
    supabase.from('sessions').delete().eq('user_id', userId),
    supabase.from('user_profiles').delete().eq('user_id', userId),
  ]);
}
