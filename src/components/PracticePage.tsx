import { useCallback, useEffect, useRef, useState } from 'react';
import {
  generateAdaptiveQuestion,
  updateAdaptiveState,
  type AdaptiveState,
} from '../domain/adaptive';
import {
  computeAccuracy,
  computeAverageTimeMs,
  computeBestTimeMs,
  formatAccuracy,
  formatDurationMs,
} from '../domain/analytics';
import { generateQuestion } from '../domain/generator';
import {
  getLevelDefinition,
  MODE_META,
  OPERATION_META,
  OPERATIONS,
} from '../domain/levels';
import type {
  Attempt,
  DifficultyLevel,
  Operation,
  Question,
  SessionRecord,
  TrainingMode,
  UserData,
} from '../domain/types';

interface PracticePageProps {
  userData: UserData;
  initialOperation: Operation | 'mixed';
  initialMode: TrainingMode;
  initialLevelOverride?: DifficultyLevel;
  autoStart?: boolean;
  onSessionActiveChange: (active: boolean) => void;
  onRecordAttempt: (attempt: Attempt) => void;
  onCompleteSession: (
    session: SessionRecord,
    sessionAttempts: Attempt[],
  ) => DifficultyLevel | undefined;
  onExitToOverview: () => void;
}

type Phase = 'setup' | 'active' | 'summary';

interface FeedbackState {
  isCorrect: boolean;
  userAnswer: number | null;
  correctAnswer: number;
  responseTimeMs: number;
  strategy?: string;
}

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5, 6, 7];
const MODES: TrainingMode[] = ['practice', 'speed', 'mental', 'adaptive'];
const QUESTION_COUNTS: Array<15 | 20 | 30 | 50> = [15, 20, 30, 50];

export function PracticePage({
  userData,
  initialOperation,
  initialMode,
  initialLevelOverride,
  autoStart = false,
  onSessionActiveChange,
  onRecordAttempt,
  onCompleteSession,
  onExitToOverview,
}: PracticePageProps) {
  const initialLevel: DifficultyLevel =
    initialLevelOverride ??
    (initialOperation === 'mixed'
      ? (Math.round(
          OPERATIONS.reduce(
            (sum, op) => sum + userData.operations[op].currentLevel,
            0,
          ) / OPERATIONS.length,
        ) as DifficultyLevel)
      : userData.operations[initialOperation].currentLevel);
  const [phase, setPhase] = useState<Phase>(autoStart ? 'active' : 'setup');
  const [selectedOp, setSelectedOp] = useState<Operation | 'mixed'>(
    initialOperation,
  );
  const [selectedMode, setSelectedMode] = useState<TrainingMode>(initialMode);
  const [selectedLevel, setSelectedLevel] =
    useState<DifficultyLevel>(initialLevel);
  const [targetCount, setTargetCount] = useState<number>(
    userData.settings.defaultSessionLength,
  );
  const [showCustomize, setShowCustomize] = useState<boolean>(false);

  const recentKeysRef = useRef<Set<string>>(new Set());

  // Active session state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(() => {
    if (!autoStart) return null;
    const op =
      initialOperation === 'mixed'
        ? OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)]
        : initialOperation;
    return generateQuestion(op, initialLevel);
  });
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionAttempts, setSessionAttempts] = useState<Attempt[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(() =>
    autoStart ? Date.now() : 0,
  );
  const [remainingSec, setRemainingSec] = useState<number>(
    userData.settings.speedModeDurationSec,
  );
  const [elapsedQuestionSec, setElapsedQuestionSec] = useState<number>(0);
  const [leveledUpTo, setLeveledUpTo] = useState<DifficultyLevel | undefined>(
    undefined,
  );

  const questionStartRef = useRef<number>(0);
  const pausedAccumulatedRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const adaptiveStateRef = useRef<AdaptiveState>({
    currentLevel: initialLevel,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    reinforcementQueue: [],
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const didAutoStartRef = useRef<boolean>(false);

  useEffect(() => {
    if (autoStart && !didAutoStartRef.current) {
      didAutoStartRef.current = true;
      questionStartRef.current = performance.now();
      if (currentQuestion) {
        recentKeysRef.current.add(
          `${currentQuestion.operation}:${currentQuestion.a}:${currentQuestion.b}`,
        );
      }
      onSessionActiveChange(true);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [autoStart, currentQuestion, onSessionActiveChange]);

  const handleSelectOperation = (op: Operation | 'mixed') => {
    setSelectedOp(op);
    if (op !== 'mixed') {
      setSelectedLevel(userData.operations[op].currentLevel);
    }
  };

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const buildNextQuestion = useCallback(
    (index: number, op: Operation | 'mixed', mode: TrainingMode, lvl: DifficultyLevel) => {
      if (mode === 'adaptive') {
        const { question, nextState } = generateAdaptiveQuestion(
          op,
          adaptiveStateRef.current,
          userData.attempts,
          index,
          recentKeysRef.current,
        );
        adaptiveStateRef.current = nextState;
        return question;
      }

      const resolvedOp =
        op === 'mixed'
          ? OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)]
          : op;
      return generateQuestion(resolvedOp, lvl, recentKeysRef.current);
    },
    [userData.attempts],
  );

  const finishSession = useCallback(
    (attemptsList: Attempt[]) => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      onSessionActiveChange(false);

      if (attemptsList.length === 0) {
        setPhase('setup');
        return;
      }

      const correctCount = attemptsList.filter((a) => a.isCorrect).length;
      const avgMs = computeAverageTimeMs(attemptsList) ?? 0;
      const bestMs = computeBestTimeMs(attemptsList);

      const session: SessionRecord = {
        id: `sess-${Date.now()}`,
        startedAt: sessionStartedAt,
        endedAt: Date.now(),
        mode: selectedMode,
        operation: selectedOp,
        level: selectedLevel,
        totalQuestions: attemptsList.length,
        correctCount,
        averageResponseTimeMs: Math.round(avgMs),
        bestResponseTimeMs: bestMs,
      };

      const unlocked = onCompleteSession(session, attemptsList);
      setLeveledUpTo(unlocked);
      setPhase('summary');
    },
    [
      onCompleteSession,
      onSessionActiveChange,
      selectedLevel,
      selectedMode,
      selectedOp,
      sessionStartedAt,
    ],
  );

  const startSession = useCallback(
    (
      overrideOp?: Operation | 'mixed',
      overrideMode?: TrainingMode,
      overrideLevel?: DifficultyLevel,
    ) => {
      const op = overrideOp ?? selectedOp;
      const mode = overrideMode ?? selectedMode;
      const lvl = overrideLevel ?? selectedLevel;

      recentKeysRef.current = new Set();
      adaptiveStateRef.current = {
        currentLevel: lvl,
        consecutiveCorrect: 0,
        consecutiveWrong: 0,
        reinforcementQueue: [],
      };

      const firstQ = buildNextQuestion(0, op, mode, lvl);
      setCurrentQuestion(firstQ);
      setInputValue('');
      setFeedback(null);
      setRetryCount(0);
      setIsPaused(false);
      setSessionAttempts([]);
      setLeveledUpTo(undefined);
      setSessionStartedAt(Date.now());
      setRemainingSec(userData.settings.speedModeDurationSec);
      setElapsedQuestionSec(0);
      questionStartRef.current = performance.now();
      pausedAccumulatedRef.current = 0;
      pauseStartRef.current = null;
      setPhase('active');
      onSessionActiveChange(true);
      focusInput();
    },
    [
      buildNextQuestion,
      focusInput,
      onSessionActiveChange,
      selectedLevel,
      selectedMode,
      selectedOp,
      userData.settings.speedModeDurationSec,
    ],
  );

  // Speed Mode countdown & Practice timer
  useEffect(() => {
    if (phase !== 'active' || isPaused) return;

    const interval = window.setInterval(() => {
      if (selectedMode === 'speed') {
        setRemainingSec((prev) => {
          if (prev <= 1) {
            window.clearInterval(interval);
            finishSession(sessionAttempts);
            return 0;
          }
          return prev - 1;
        });
      } else if (
        selectedMode === 'practice' &&
        userData.settings.showTimerInPractice
      ) {
        const elapsed = Math.floor(
          (performance.now() -
            questionStartRef.current -
            pausedAccumulatedRef.current) /
            1000,
        );
        setElapsedQuestionSec(Math.max(0, elapsed));
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    finishSession,
    isPaused,
    phase,
    selectedMode,
    sessionAttempts,
    userData.settings.showTimerInPractice,
  ]);

  const advanceToNextQuestion = useCallback(
    (updatedAttempts: Attempt[]) => {
      if (
        selectedMode !== 'speed' &&
        updatedAttempts.length >= targetCount
      ) {
        finishSession(updatedAttempts);
        return;
      }

      const nextQ = buildNextQuestion(
        updatedAttempts.length,
        selectedOp,
        selectedMode,
        selectedLevel,
      );
      setCurrentQuestion(nextQ);
      setInputValue('');
      setFeedback(null);
      setRetryCount(0);
      setElapsedQuestionSec(0);
      questionStartRef.current = performance.now();
      pausedAccumulatedRef.current = 0;
      pauseStartRef.current = null;
      focusInput();
    },
    [
      buildNextQuestion,
      finishSession,
      focusInput,
      selectedLevel,
      selectedMode,
      selectedOp,
      targetCount,
    ],
  );

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      if (!prev) {
        pauseStartRef.current = performance.now();
        return true;
      }
      if (pauseStartRef.current !== null) {
        pausedAccumulatedRef.current +=
          performance.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      focusInput();
      return false;
    });
  }, [focusInput]);

  // Escape key to pause/resume
  useEffect(() => {
    if (phase !== 'active') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleTogglePause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePause, phase]);

  const submitAnswer = useCallback(
    (parsed: number | null, forceReveal = false) => {
      if (!currentQuestion || isPaused) return;

      const now = performance.now();
      const rawTime =
        now - questionStartRef.current - pausedAccumulatedRef.current;
      const responseTimeMs = Math.max(100, Math.round(rawTime));
      const isCorrect = parsed !== null && parsed === currentQuestion.answer;

      if (isCorrect) {
        const attempt: Attempt = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          operation: currentQuestion.operation,
          level: currentQuestion.level,
          mode: selectedMode,
          expression: currentQuestion.expression,
          correctAnswer: currentQuestion.answer,
          userAnswer: parsed,
          isCorrect: true,
          responseTimeMs,
          strategy: currentQuestion.strategy,
          skillTag: currentQuestion.skillTag,
        };

        if (selectedMode === 'adaptive') {
          adaptiveStateRef.current = updateAdaptiveState(
            adaptiveStateRef.current,
            {
              operation: currentQuestion.operation,
              level: currentQuestion.level,
              isCorrect: true,
              responseTimeMs,
            },
          );
        }

        // Only record attempt if not already recorded on 1st miss
        const updatedAttempts =
          retryCount === 0
            ? [...sessionAttempts, attempt]
            : sessionAttempts;
        if (retryCount === 0) {
          onRecordAttempt(attempt);
          setSessionAttempts(updatedAttempts);
        }

        setFeedback({
          isCorrect: true,
          userAnswer: parsed,
          correctAnswer: currentQuestion.answer,
          responseTimeMs,
          strategy: currentQuestion.strategy,
        });

        const delay = userData.settings.autoAdvanceDelayMs;
        if (delay === 0) {
          advanceToNextQuestion(updatedAttempts);
        } else {
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            autoAdvanceTimerRef.current = null;
            advanceToNextQuestion(updatedAttempts);
          }, delay);
        }
        return;
      }

      // Wrong answer or reveal
      if (retryCount === 0 && !forceReveal) {
        const attempt: Attempt = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          operation: currentQuestion.operation,
          level: currentQuestion.level,
          mode: selectedMode,
          expression: currentQuestion.expression,
          correctAnswer: currentQuestion.answer,
          userAnswer: parsed,
          isCorrect: false,
          responseTimeMs,
          strategy: currentQuestion.strategy,
          skillTag: currentQuestion.skillTag,
        };

        if (selectedMode === 'adaptive') {
          adaptiveStateRef.current = updateAdaptiveState(
            adaptiveStateRef.current,
            {
              operation: currentQuestion.operation,
              level: currentQuestion.level,
              isCorrect: false,
              responseTimeMs,
            },
          );
        }

        onRecordAttempt(attempt);
        setSessionAttempts((prev) => [...prev, attempt]);
        setRetryCount(1);
        setInputValue('');
        focusInput();
        return;
      }

      // 2nd miss or explicit Reveal
      if (retryCount === 0 && forceReveal) {
        const attempt: Attempt = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          operation: currentQuestion.operation,
          level: currentQuestion.level,
          mode: selectedMode,
          expression: currentQuestion.expression,
          correctAnswer: currentQuestion.answer,
          userAnswer: parsed,
          isCorrect: false,
          responseTimeMs,
          strategy: currentQuestion.strategy,
          skillTag: currentQuestion.skillTag,
        };
        onRecordAttempt(attempt);
        setSessionAttempts((prev) => [...prev, attempt]);
      }

      setFeedback({
        isCorrect: false,
        userAnswer: parsed,
        correctAnswer: currentQuestion.answer,
        responseTimeMs,
        strategy: currentQuestion.strategy,
      });
    },
    [
      advanceToNextQuestion,
      currentQuestion,
      focusInput,
      isPaused,
      onRecordAttempt,
      retryCount,
      selectedMode,
      sessionAttempts,
      userData.settings.autoAdvanceDelayMs,
    ],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || isPaused) return;

    // If reviewing an incorrect answer, Enter/Submit advances
    if (feedback && !feedback.isCorrect) {
      advanceToNextQuestion(sessionAttempts);
      return;
    }

    // Ignore duplicate submit while correct auto-advance is pending
    if (feedback && feedback.isCorrect) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      advanceToNextQuestion(sessionAttempts);
      return;
    }

    const trimmed = inputValue.trim();
    if (trimmed === '' || trimmed === '-') {
      if (retryCount > 0) {
        submitAnswer(null, true);
      }
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;

    submitAnswer(parsed);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  if (phase === 'setup') {
    const activeOpForLevel = selectedOp === 'mixed' ? 'addition' : selectedOp;
    const earnedLevel =
      selectedOp === 'mixed'
        ? undefined
        : userData.operations[selectedOp].currentLevel;

    return (
      <main className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Practice</h1>
            <p className="page-subtitle">
              Configure your session and begin immediately.
            </p>
          </div>
        </div>

        <div className="setup-grid">
          <div>
            <span className="setup-group-label">Operation</span>
            <div className="segmented-row">
              {OPERATIONS.map((op) => (
                <button
                  key={op}
                  type="button"
                  className={`segment-btn${selectedOp === op ? ' selected' : ''}`}
                  onClick={() => handleSelectOperation(op)}
                >
                  {OPERATION_META[op].label} ({OPERATION_META[op].symbol})
                </button>
              ))}
              <button
                type="button"
                className={`segment-btn${selectedOp === 'mixed' ? ' selected' : ''}`}
                onClick={() => handleSelectOperation('mixed')}
              >
                Mixed
              </button>
            </div>
          </div>

          <div>
            <span className="setup-group-label">Mode</span>
            <div className="segmented-row">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`segment-btn${selectedMode === mode ? ' selected' : ''}`}
                  onClick={() => setSelectedMode(mode)}
                >
                  {MODE_META[mode].label}
                </button>
              ))}
            </div>
            <p className="page-subtitle" style={{ marginTop: 8 }}>
              {MODE_META[selectedMode].description}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startSession()}
              >
                Start Session
              </button>
              <span className="page-subtitle" style={{ margin: 0 }}>
                Level {selectedLevel} ·{' '}
                {selectedMode === 'speed'
                  ? `${userData.settings.speedModeDurationSec}s sprint`
                  : `${targetCount} questions`}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              style={{ paddingLeft: 0, fontSize: 13 }}
              onClick={() => setShowCustomize((v) => !v)}
            >
              {showCustomize
                ? 'Hide level & length options'
                : 'Customize level & length'}
            </button>
          </div>

          {showCustomize && (
            <>
              <div>
                <span className="setup-group-label">
                  {selectedMode === 'adaptive'
                    ? 'Starting Level'
                    : 'Difficulty Level'}
                </span>
                <div className="segmented-row">
                  {LEVELS.map((lvl) => {
                    const isEarned = earnedLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        className={`segment-btn${selectedLevel === lvl ? ' selected' : ''}`}
                        onClick={() => setSelectedLevel(lvl)}
                        title={getLevelDefinition(activeOpForLevel, lvl).name}
                      >
                        L{lvl}
                        {isEarned ? ' · Current' : ''}
                      </button>
                    );
                  })}
                </div>
                {selectedOp !== 'mixed' && (
                  <p className="page-subtitle" style={{ marginTop: 8 }}>
                    Level {selectedLevel}:{' '}
                    {getLevelDefinition(selectedOp, selectedLevel).name}
                  </p>
                )}
              </div>

              {selectedMode !== 'speed' && (
                <div>
                  <span className="setup-group-label">Questions</span>
                  <div className="segmented-row">
                    {QUESTION_COUNTS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={`segment-btn${targetCount === count ? ' selected' : ''}`}
                        onClick={() => setTargetCount(count)}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  if (phase === 'active' && currentQuestion) {
    const runningAccuracy = computeAccuracy(sessionAttempts);
    const opLabel = OPERATION_META[currentQuestion.operation].label;
    const isMental = selectedMode === 'mental';
    const progressLabel =
      selectedMode === 'speed'
        ? `Question ${sessionAttempts.length + 1}`
        : `${Math.min(sessionAttempts.length + 1, targetCount)} / ${targetCount}`;

    const formatCountdown = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    const inputClass =
      feedback === null
        ? 'answer-input'
        : feedback.isCorrect
          ? 'answer-input state-correct'
          : 'answer-input state-wrong';

    return (
      <div className="practice-arena">
        <header className="arena-topbar">
          <div className="arena-meta">
            <span>
              {opLabel} · Level {currentQuestion.level}
            </span>
            {!isMental && runningAccuracy !== null && (
              <span>· {Math.round(runningAccuracy)}%</span>
            )}
          </div>

          <div className="arena-controls">
            {selectedMode === 'speed' && (
              <span style={{ marginRight: 8 }}>
                {formatCountdown(remainingSec)}
              </span>
            )}
            {selectedMode === 'practice' &&
              userData.settings.showTimerInPractice && (
                <span style={{ marginRight: 8 }}>{elapsedQuestionSec}s</span>
              )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleTogglePause}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => finishSession(sessionAttempts)}
            >
              Exit
            </button>
          </div>
        </header>

        <main className="arena-center">
          {isPaused ? (
            <div style={{ textAlign: 'center' }}>
              <p className="arena-progress-label">Session paused</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleTogglePause}
                >
                  Resume
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => finishSession(sessionAttempts)}
                >
                  End Session
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="arena-progress-label">{progressLabel}</div>

              <div
                className="expression-display"
                aria-live="polite"
                aria-label={`Calculate ${currentQuestion.expression}`}
              >
                {currentQuestion.expression}
              </div>

              <form className="answer-form" onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode={
                    userData.settings.showTouchNumpad ? 'none' : 'numeric'
                  }
                  pattern="[0-9-]*"
                  autoComplete="off"
                  autoFocus
                  className={inputClass}
                  placeholder={retryCount > 0 ? 'Try again' : 'Your answer'}
                  aria-label="Your answer"
                  value={inputValue}
                  onChange={(e) => {
                    if (feedback) return;
                    const cleaned = e.target.value.replace(/[^0-9-]/g, '');
                    setInputValue(cleaned);
                    if (
                      !userData.settings.requireSubmitButton &&
                      cleaned !== '' &&
                      cleaned !== '-' &&
                      Number(cleaned) === currentQuestion.answer
                    ) {
                      submitAnswer(Number(cleaned));
                    }
                  }}
                />

                {userData.settings.showTouchNumpad && !feedback && (
                  <div className="numpad-grid" role="group" aria-label="Number pad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '↵'].map(
                      (key) => (
                        <button
                          key={key}
                          type="button"
                          className="numpad-key"
                          onClick={() => {
                            if (key === '⌫') {
                              setInputValue((v) => v.slice(0, -1));
                              return;
                            }
                            if (key === '↵') {
                              const trimmed = inputValue.trim();
                              if (trimmed === '' || trimmed === '-') {
                                if (retryCount > 0) submitAnswer(null, true);
                              } else {
                                const parsed = Number(trimmed);
                                if (Number.isFinite(parsed)) submitAnswer(parsed);
                              }
                              return;
                            }
                            const next = inputValue + key;
                            setInputValue(next);
                            if (
                              !userData.settings.requireSubmitButton &&
                              Number(next) === currentQuestion.answer
                            ) {
                              submitAnswer(Number(next));
                            }
                          }}
                        >
                          {key}
                        </button>
                      ),
                    )}
                  </div>
                )}

                {!feedback ? (
                  userData.settings.requireSubmitButton ? (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      disabled={inputValue.trim() === ''}
                    >
                      Submit
                    </button>
                  ) : retryCount > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => submitAnswer(null, true)}
                    >
                      Reveal answer
                    </button>
                  ) : null
                ) : !feedback.isCorrect ? (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    Continue
                  </button>
                ) : null}
              </form>

              <div className="feedback-slot" aria-live="polite">
                {feedback?.isCorrect && (
                  <div className="feedback-correct">
                    Correct · {formatDurationMs(feedback.responseTimeMs)}
                  </div>
                )}

                {!feedback && retryCount > 0 && (
                  <div className="feedback-wrong">
                    <div className="feedback-wrong-line">
                      Not quite — try again
                    </div>
                  </div>
                )}

                {feedback && !feedback.isCorrect && (
                  <div className="feedback-wrong">
                    <div className="feedback-wrong-line">
                      {feedback.userAnswer !== null
                        ? `Your answer: ${feedback.userAnswer} · `
                        : ''}
                      Correct: {feedback.correctAnswer}
                    </div>
                    {feedback.strategy && (
                      <div className="feedback-strategy">
                        {feedback.strategy}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  // Summary phase
  const accuracy = computeAccuracy(sessionAttempts);
  const avgTime = computeAverageTimeMs(sessionAttempts);
  const bestTime = computeBestTimeMs(sessionAttempts);
  const mistakes = sessionAttempts.filter((a) => !a.isCorrect);

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Session Complete</h1>
          <p className="page-subtitle">
            {MODE_META[selectedMode].label} ·{' '}
            {selectedOp === 'mixed'
              ? 'Mixed Operations'
              : OPERATION_META[selectedOp].label}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPhase('setup');
              onExitToOverview();
            }}
          >
            Overview
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => startSession()}
          >
            Practice Again
          </button>
        </div>
      </div>

      {leveledUpTo && selectedOp !== 'mixed' && (
        <div
          style={{
            padding: '12px 16px',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 28,
            fontSize: 14,
          }}
        >
          Level unlocked: <strong>{OPERATION_META[selectedOp].label} Level {leveledUpTo}</strong> —{' '}
          {getLevelDefinition(selectedOp, leveledUpTo).name}
        </div>
      )}

      <section className="metrics-strip">
        <div className="metric-cell">
          <div className="metric-label">Completed</div>
          <div className="metric-value">{sessionAttempts.length}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">Accuracy</div>
          <div className="metric-value">{formatAccuracy(accuracy)}</div>
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

      {mistakes.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Review Mistakes</h2>
          </div>
          <div className="row-list">
            {mistakes.map((m) => (
              <div key={m.id} className="row-item" style={{ alignItems: 'flex-start' }}>
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
                    Answered {m.userAnswer}
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
