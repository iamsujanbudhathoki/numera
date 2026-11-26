import { useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from './components/Nav';
import { OverviewPage } from './components/OverviewPage';
import { PracticePage } from './components/PracticePage';
import { ProgressPage } from './components/ProgressPage';
import { SettingsPage, type SyncStatus } from './components/SettingsPage';
import { evaluateLevelAdvancement } from './domain/adaptive';
import type {
  Attempt,
  DifficultyLevel,
  NavTab,
  Operation,
  SessionRecord,
  TrainingMode,
  UserData,
  UserSettings,
} from './domain/types';
import {
  clearUserData,
  loadUserData,
  saveUserData,
} from './storage/persistence';
import { supabase } from './storage/supabaseClient';
import {
  clearCloudUserData,
  fetchCloudUserData,
  mergeUserData,
  pushAttemptToCloud,
  pushFullUserDataToCloud,
  pushProfileToCloud,
  pushSessionAndProfileToCloud,
} from './storage/sync';

function getInitialRoute(): {
  tab: NavTab;
  isStartRoute: boolean;
} {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (path === '/start') return { tab: 'practice', isStartRoute: true };
  if (path === '/practice') return { tab: 'practice', isStartRoute: false };
  if (path === '/progress') return { tab: 'progress', isStartRoute: false };
  if (path === '/settings') return { tab: 'settings', isStartRoute: false };
  return { tab: 'overview', isStartRoute: false };
}

function syncUrlForTab(tab: NavTab): void {
  const target = tab === 'overview' ? '/' : `/${tab}`;
  if (window.location.pathname !== target) {
    window.history.replaceState(null, '', target);
  }
}

export function App() {
  const [userData, setUserData] = useState<UserData>(() => loadUserData());
  const initialRoute = getInitialRoute();
  const [activeTab, setActiveTab] = useState<NavTab>(initialRoute.tab);
  const [sessionActive, setSessionActive] = useState(false);

  const [practiceOp, setPracticeOp] = useState<Operation | 'mixed'>(
    initialRoute.isStartRoute ? 'mixed' : userData.lastOperation,
  );
  const [practiceMode, setPracticeMode] = useState<TrainingMode>(
    initialRoute.isStartRoute ? 'adaptive' : userData.lastMode,
  );
  const [autoStartPractice, setAutoStartPractice] = useState<boolean>(
    initialRoute.isStartRoute,
  );
  const [practiceKey, setPracticeKey] = useState<number>(0);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const userDataRef = useRef<UserData>(userData);
  useEffect(() => {
    userDataRef.current = userData;
  }, [userData]);

  // Persist userData locally whenever it changes
  useEffect(() => {
    saveUserData(userData);
  }, [userData]);

  const syncWithCloud = useCallback(async (uid: string) => {
    setSyncStatus('syncing');
    try {
      const cloud = await fetchCloudUserData(uid);
      const merged = mergeUserData(userDataRef.current, cloud);
      setUserData(merged);
      await pushFullUserDataToCloud(uid, merged);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  // Listen to optional Supabase auth state
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);
      if (user) {
        void syncWithCloud(user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);
      if (user) {
        void syncWithCloud(user.id);
      } else {
        setSyncStatus('idle');
      }
    });

    return () => subscription.unsubscribe();
  }, [syncWithCloud]);

  // Apply theme preference
  useEffect(() => {
    const applyTheme = () => {
      const pref = userData.settings.theme;
      const resolved =
        pref === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : pref;
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [userData.settings.theme]);

  const handleStartPracticeFromOverview = useCallback(
    (operation: Operation, mode?: TrainingMode) => {
      setPracticeOp(operation);
      setPracticeMode(mode ?? userData.lastMode);
      setAutoStartPractice(true);
      setPracticeKey((n) => n + 1);
      setActiveTab('practice');
      syncUrlForTab('practice');
    },
    [userData.lastMode],
  );

  const handleSelectTab = useCallback((tab: NavTab) => {
    if (tab === 'practice') {
      setAutoStartPractice(false);
    }
    setActiveTab(tab);
    syncUrlForTab(tab);
  }, []);

  const handleRecordAttempt = useCallback(
    (attempt: Attempt) => {
      setUserData((prev) => ({
        ...prev,
        attempts: [...prev.attempts, attempt],
      }));
      if (userId) {
        void pushAttemptToCloud(userId, attempt).catch(() =>
          setSyncStatus('error'),
        );
      }
    },
    [userId],
  );

  const handleCompleteSession = useCallback(
    (
      session: SessionRecord,
      sessionAttempts: Attempt[],
    ): DifficultyLevel | undefined => {
      let unlockedLevel: DifficultyLevel | undefined;

      if (session.operation !== 'mixed') {
        const op = session.operation;
        const currentOpState = userData.operations[op];
        if (session.level === currentOpState.currentLevel) {
          const incrementedState = {
            ...currentOpState,
            sessionsAtCurrentLevel: currentOpState.sessionsAtCurrentLevel + 1,
          };
          const mergedAttempts = [
            ...userData.attempts,
            ...sessionAttempts.filter(
              (sa) => !userData.attempts.some((a) => a.id === sa.id),
            ),
          ];
          const advancement = evaluateLevelAdvancement(
            op,
            incrementedState,
            mergedAttempts,
          );
          if (advancement.shouldAdvance) {
            unlockedLevel = advancement.nextLevel;
          }
        }
      }

      setUserData((prev) => {
        const nextOps = { ...prev.operations };
        let updatedSession = session;

        if (session.operation !== 'mixed') {
          const op = session.operation;
          const currentOpState = prev.operations[op];

          if (session.level === currentOpState.currentLevel) {
            if (unlockedLevel) {
              nextOps[op] = {
                currentLevel: unlockedLevel,
                sessionsAtCurrentLevel: 0,
              };
              updatedSession = {
                ...session,
                leveledUpTo: unlockedLevel,
              };
            } else {
              nextOps[op] = {
                ...currentOpState,
                sessionsAtCurrentLevel:
                  currentOpState.sessionsAtCurrentLevel + 1,
              };
            }
          }
        }

        const nextData: UserData = {
          ...prev,
          operations: nextOps,
          sessions: [...prev.sessions, updatedSession],
          lastOperation:
            session.operation === 'mixed'
              ? prev.lastOperation
              : session.operation,
          lastMode: session.mode,
        };

        if (userId) {
          void pushSessionAndProfileToCloud(userId, updatedSession, nextData)
            .then(() => setSyncStatus('synced'))
            .catch(() => setSyncStatus('error'));
        }

        return nextData;
      });

      return unlockedLevel;
    },
    [userData.attempts, userData.operations, userId],
  );

  const handleUpdateSettings = useCallback(
    (partial: Partial<UserSettings>) => {
      setUserData((prev) => {
        const next: UserData = {
          ...prev,
          settings: { ...prev.settings, ...partial },
        };
        if (userId) {
          void pushProfileToCloud(userId, next).catch(() =>
            setSyncStatus('error'),
          );
        }
        return next;
      });
    },
    [userId],
  );

  const handleResetProgress = useCallback(() => {
    const fresh = clearUserData();
    setUserData(fresh);
    if (userId) {
      void clearCloudUserData(userId)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }
  }, [userId]);

  return (
    <div className="app-shell">
      {!sessionActive && (
        <Nav activeTab={activeTab} onSelectTab={handleSelectTab} />
      )}

      {activeTab === 'overview' && (
        <OverviewPage
          userData={userData}
          onStartPractice={handleStartPracticeFromOverview}
        />
      )}

      {activeTab === 'practice' && (
        <PracticePage
          key={practiceKey}
          userData={userData}
          initialOperation={practiceOp}
          initialMode={practiceMode}
          autoStart={autoStartPractice}
          onSessionActiveChange={setSessionActive}
          onRecordAttempt={handleRecordAttempt}
          onCompleteSession={handleCompleteSession}
          onExitToOverview={() => handleSelectTab('overview')}
        />
      )}

      {activeTab === 'progress' && <ProgressPage userData={userData} />}

      {activeTab === 'settings' && (
        <SettingsPage
          settings={userData.settings}
          userEmail={userEmail}
          syncStatus={syncStatus}
          onSyncNow={() => {
            if (userId) void syncWithCloud(userId);
          }}
          onUpdateSettings={handleUpdateSettings}
          onResetProgress={handleResetProgress}
        />
      )}
    </div>
  );
}

export default App;
