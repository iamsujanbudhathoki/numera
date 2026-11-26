import { useState } from 'react';
import type { ThemePreference, UserSettings } from '../domain/types';
import { isSupabaseConfigured, supabase } from '../storage/supabaseClient';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface SettingsPageProps {
  settings: UserSettings;
  userEmail: string | null;
  syncStatus: SyncStatus;
  onSyncNow: () => void;
  onUpdateSettings: (partial: Partial<UserSettings>) => void;
  onResetProgress: () => void;
}

export function SettingsPage({
  settings,
  userEmail,
  syncStatus,
  onSyncNow,
  onUpdateSettings,
  onResetProgress,
}: SettingsPageProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      if (authMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMessage('Check your email to confirm your account.');
        }
      }
      setPassword('');
    } catch (err) {
      setAuthMessage(
        err instanceof Error ? err.message : 'Authentication failed.',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Training preferences and interface behavior.
          </p>
        </div>
      </div>

      <section className="section" aria-label="Account and sync">
        <div className="section-header">
          <h2 className="section-title">Account & Sync</h2>
        </div>

        <div className="row-list">
          {!isSupabaseConfigured ? (
            <div className="setting-row">
              <div>
                <div className="setting-label">Local Storage Mode</div>
                <div className="setting-desc">
                  Data is saved on this device. Add VITE_SUPABASE_URL and
                  VITE_SUPABASE_ANON_KEY to enable cloud sync.
                </div>
              </div>
            </div>
          ) : userEmail ? (
            <div className="setting-row">
              <div>
                <div className="setting-label">{userEmail}</div>
                <div className="setting-desc">
                  {syncStatus === 'syncing'
                    ? 'Syncing...'
                    : syncStatus === 'error'
                      ? 'Sync error — changes saved locally'
                      : 'Synced across devices'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={onSyncNow}
                  disabled={syncStatus === 'syncing'}
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
              <div>
                <div className="setting-label">Optional Cloud Sync</div>
                <div className="setting-desc">
                  Currently saving locally. Sign in to sync progress and
                  analytics across devices.
                </div>
              </div>

              <form
                onSubmit={handleAuthSubmit}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
              >
                <input
                  type="email"
                  required
                  placeholder="Email"
                  aria-label="Email"
                  className="select-input"
                  style={{ minWidth: 200 }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password"
                  aria-label="Password"
                  className="select-input"
                  style={{ minWidth: 160 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={authLoading}
                >
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                    setAuthMessage(null);
                  }}
                >
                  {authMode === 'signin' ? 'Need an account?' : 'Have an account?'}
                </button>
              </form>

              {authMessage && (
                <div className="setting-desc" style={{ color: 'var(--text)' }}>
                  {authMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section" aria-label="Preferences">
        <div className="row-list">
          <div className="setting-row">
            <div>
              <div className="setting-label">Appearance</div>
              <div className="setting-desc">
                Choose light, dark, or match your system theme.
              </div>
            </div>
            <select
              className="select-input"
              aria-label="Appearance"
              value={settings.theme}
              onChange={(e) =>
                onUpdateSettings({ theme: e.target.value as ThemePreference })
              }
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Default Session Length</div>
              <div className="setting-desc">
                Number of questions in Practice, Mental, and Adaptive sessions.
              </div>
            </div>
            <select
              className="select-input"
              aria-label="Default Session Length"
              value={settings.defaultSessionLength}
              onChange={(e) =>
                onUpdateSettings({
                  defaultSessionLength: Number(e.target.value) as 15 | 20 | 30 | 50,
                })
              }
            >
              <option value={15}>15 questions</option>
              <option value={20}>20 questions</option>
              <option value={30}>30 questions</option>
              <option value={50}>50 questions</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Speed Mode Duration</div>
              <div className="setting-desc">
                Countdown length for timed Speed Mode sprints.
              </div>
            </div>
            <select
              className="select-input"
              aria-label="Speed Mode Duration"
              value={settings.speedModeDurationSec}
              onChange={(e) =>
                onUpdateSettings({
                  speedModeDurationSec: Number(e.target.value) as 60 | 90 | 120,
                })
              }
            >
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
              <option value={120}>120 seconds</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Daily Goal</div>
              <div className="setting-desc">
                Target number of questions per day on Overview.
              </div>
            </div>
            <select
              className="select-input"
              aria-label="Daily Goal"
              value={settings.dailyGoal}
              onChange={(e) =>
                onUpdateSettings({
                  dailyGoal: Number(e.target.value) as 20 | 30 | 50 | 100,
                })
              }
            >
              <option value={20}>20 questions</option>
              <option value={30}>30 questions</option>
              <option value={50}>50 questions</option>
              <option value={100}>100 questions</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Practice Mode Timer</div>
              <div className="setting-desc">
                Display elapsed seconds during untimed Practice Mode.
              </div>
            </div>
            <select
              className="select-input"
              aria-label="Practice Mode Timer"
              value={settings.showTimerInPractice ? 'on' : 'off'}
              onChange={(e) =>
                onUpdateSettings({
                  showTimerInPractice: e.target.value === 'on',
                })
              }
            >
              <option value="off">Hidden</option>
              <option value="on">Visible</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Transition Pace</div>
              <div className="setting-desc">
                Delay before advancing after a correct answer.
              </div>
            </div>
            <select
              className="select-input"
              aria-label="Transition Pace"
              value={settings.autoAdvanceDelayMs}
              onChange={(e) =>
                onUpdateSettings({
                  autoAdvanceDelayMs: Number(e.target.value) as 0 | 350 | 700,
                })
              }
            >
              <option value={0}>Instant</option>
              <option value={350}>Fast (0.35s)</option>
              <option value={700}>Relaxed (0.7s)</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Reset Progress</div>
              <div className="setting-desc">
                Clear all recorded attempts, sessions, and difficulty levels.
              </div>
            </div>
            {!confirmReset ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setConfirmReset(true)}
              >
                Reset Data
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                  }}
                >
                  Confirm Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
