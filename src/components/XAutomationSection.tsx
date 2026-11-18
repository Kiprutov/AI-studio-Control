import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Unlink,
} from 'lucide-react';
import { apiUrl, getApiBaseUrl } from '../lib/api';

interface XUser {
  id: string;
  name: string;
  username: string;
}

interface XStatusResponse {
  connected: boolean;
  authMode: 'oauth1' | 'oauth2' | 'none';
  user: XUser | null;
  connectionError: string | null;
  rateLimited?: boolean;
  oauth1Configured: boolean;
  oauth2Configured: boolean;
  callbackUrl: string;
}

interface XTweetMetrics {
  impression_count: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  bookmark_count: number;
}

interface XPostRecord {
  id: string;
  text: string;
  status: 'scheduled' | 'published' | 'failed';
  createdAt: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  tweetId: string | null;
  tweetUrl: string | null;
  username: string | null;
  error: string | null;
  metrics: XTweetMetrics | null;
  lastMetricsAt: string | null;
}

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STARTER_TEST_COPY =
  'Testing automated X posting from Shuleni Launch Studio — measuring delivery and live engagement metrics.';

export default function XAutomationSection() {
  const [status, setStatus] = useState<XStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [posts, setPosts] = useState<XPostRecord[]>([]);
  const [text, setText] = useState(STARTER_TEST_COPY);
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'schedule'>('now');
  const [scheduledLocal, setScheduledLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60_000)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [refreshingMetrics, setRefreshingMetrics] = useState(false);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null,
  );

  const loadStatus = useCallback(async (forceRefresh = false) => {
    try {
      const url = apiUrl(forceRefresh ? '/api/x/status?refresh=1' : '/api/x/status');
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load X connection status.');
      const data = (await res.json()) as XStatusResponse;
      setStatus(data);
    } catch (err) {
      const hasCustomApi = Boolean(getApiBaseUrl());
      setFeedback({
        type: 'error',
        message: hasCustomApi
          ? err instanceof Error
            ? err.message
            : 'Unable to reach X automation server.'
          : 'Backend server not connected in standalone APK build. Set VITE_API_BASE_URL in GitHub Actions to enable X Automation.',
      });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/x/posts'), { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { posts?: XPostRecord[] };
      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
    } catch {
      // Silent background poll failure
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadPosts();
  }, [loadStatus, loadPosts]);

  // Listen for OAuth 2.0 popup callback
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'x') {
        setConnectingOAuth(false);
        setFeedback({ type: 'success', message: 'X account connected.' });
        void loadStatus();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR' && event.data?.provider === 'x') {
        setConnectingOAuth(false);
        setFeedback({
          type: 'error',
          message: String(event.data?.error || 'X authorization was cancelled.'),
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadStatus]);

  const hasScheduledPosts = useMemo(
    () => posts.some((p) => p.status === 'scheduled'),
    [posts],
  );

  // Poll while scheduled posts are pending so UI transitions cleanly when published
  useEffect(() => {
    if (!hasScheduledPosts) return;
    const id = window.setInterval(() => {
      void loadPosts();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [hasScheduledPosts, loadPosts]);

  const handleConnectOAuth = async () => {
    setFeedback(null);
    setConnectingOAuth(true);
    try {
      const res = await fetch(apiUrl('/api/x/auth/url'), { credentials: 'include' });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not initialize X OAuth flow.');
      }

      const popup = window.open(data.url, 'x_oauth_popup', 'width=600,height=720');
      if (!popup) {
        setConnectingOAuth(false);
        setFeedback({
          type: 'error',
          message: 'Popup blocked by your browser. Allow popups for this preview and try again.',
        });
      }
    } catch (err) {
      setConnectingOAuth(false);
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to start X login.',
      });
    }
  };

  const handleDisconnect = async () => {
    setFeedback(null);
    await fetch(apiUrl('/api/x/disconnect'), { method: 'POST', credentials: 'include' });
    await loadStatus();
  };

  const handleCopyCallback = async () => {
    if (!status?.callbackUrl) return;
    try {
      await navigator.clipboard.writeText(status.callbackUrl);
      setCopiedCallback(true);
      window.setTimeout(() => setCopiedCallback(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const setDelayMinutes = (minutes: number) => {
    setDeliveryMode('schedule');
    setScheduledLocal(toLocalDateTimeInputValue(new Date(Date.now() + minutes * 60_000)));
  };

  const handlePublishOrSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'Enter post text before sending.' });
      return;
    }
    if (trimmed.length > 280) {
      setFeedback({ type: 'error', message: 'X posts cannot exceed 280 characters.' });
      return;
    }

    let scheduledFor: string | undefined;
    if (deliveryMode === 'schedule') {
      const parsed = new Date(scheduledLocal);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now() + 5_000) {
        setFeedback({
          type: 'error',
          message: 'Choose a scheduled time at least 1 minute in the future.',
        });
        return;
      }
      scheduledFor = parsed.toISOString();
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/x/posts'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, scheduledFor }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        post?: XPostRecord;
        error?: string;
      };
      if (!res.ok) {
        await loadPosts();
        throw new Error(data.error || `Request failed with status ${res.status}.`);
      }

      if (data.post) {
        setPosts((prev) => [data.post!, ...prev.filter((p) => p.id !== data.post!.id)]);
      } else {
        await loadPosts();
      }
      setFeedback({
        type: 'success',
        message:
          deliveryMode === 'schedule'
            ? `Scheduled for ${formatDateTime(scheduledFor ?? null)}.`
            : 'Test post published to X.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to publish post.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshMetrics = async () => {
    setFeedback(null);
    setRefreshingMetrics(true);
    try {
      const res = await fetch(apiUrl('/api/x/posts/refresh-metrics'), {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as {
        posts?: XPostRecord[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh X metrics.');
      }
      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not fetch X metrics.',
      });
    } finally {
      setRefreshingMetrics(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    const res = await fetch(apiUrl(`/api/x/posts/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as { posts?: XPostRecord[] };
      if (Array.isArray(data.posts)) setPosts(data.posts);
    }
  };

  const charCount = text.length;
  const overLimit = charCount > 280;
  const isConnected = Boolean(status?.connected);

  return (
    <section id="x-automation" className="border-t border-white/[0.07] py-14 bg-[#0E1217]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              04. X (Twitter) Automation & Performance Lab
            </h2>
            <p className="mt-1.5 text-sm text-slate-400 max-w-2xl">
              Publish a live text test post or schedule automated posts to X, then inspect real impressions and engagement metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {loadingStatus ? (
              <span className="inline-flex items-center gap-2 text-xs text-slate-400 px-3 py-1.5 rounded-lg border border-white/10">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking X credentials...</span>
              </span>
            ) : isConnected ? (
              <>
                <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-3 py-1.5 rounded-lg">
                  <span>{status?.user ? `Connected @${status.user.username}` : 'Connected to X'}</span>
                  <span className="text-emerald-400/70">·</span>
                  <span className="uppercase text-[10px] tracking-wider">
                    {status?.authMode === 'oauth1' ? 'OAuth 1.0a' : 'OAuth 2.0'}
                  </span>
                </span>
                {status?.authMode === 'oauth2' && (
                  <button
                    type="button"
                    onClick={() => void handleDisconnect()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 hover:border-white/30 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                )}
              </>
            ) : (
              <>
                {status?.oauth2Configured && (
                  <button
                    type="button"
                    onClick={() => void handleConnectOAuth()}
                    disabled={connectingOAuth}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-xs font-semibold text-emerald-950 transition-colors cursor-pointer"
                  >
                    {connectingOAuth ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Link2 className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {connectingOAuth
                        ? 'Waiting for X...'
                        : status.authMode === 'oauth2'
                        ? 'Reconnect X Account'
                        : 'Connect X Account'}
                    </span>
                  </button>
                )}
                {status?.authMode === 'oauth2' && (
                  <button
                    type="button"
                    onClick={() => void handleDisconnect()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 hover:border-white/30 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Reset Session</span>
                  </button>
                )}
                {status?.authMode !== 'none' && (
                  <button
                    type="button"
                    onClick={() => void loadStatus(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 hover:border-white/30 text-xs text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-check</span>
                  </button>
                )}
                {!status?.oauth2Configured && !status?.oauth1Configured && (
                  <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                    X API credentials required in Secrets
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Credentials / Callback Guidance when not yet connected */}
        {!loadingStatus && !isConnected && (
          <div className="mb-8 rounded-xl bg-[#12161C] border border-white/[0.08] p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-white">
                {status?.connectionError
                  ? 'X API Connection Error'
                  : 'What you need from the X Developer Portal'}
              </h3>
              <a
                href="https://developer.x.com/en/portal/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                <span>Open X Developer Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {status?.connectionError && (
              <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-amber-300">
                  X API response: {status.connectionError}
                </p>
                {status.connectionError.toLowerCase().includes('attached to a project') && (
                  <div className="text-slate-200 space-y-1 pt-1">
                    <p className="font-medium text-white">How to fix this in 30 seconds:</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300">
                      <li>
                        Open <strong>Projects &amp; Apps</strong> in the X Developer Portal.
                      </li>
                      <li>
                        Your App is currently a <strong>Standalone App</strong>. Create a <strong>Project</strong> (the Free tier includes 1 Project) and attach/move this App inside that Project.
                      </li>
                      <li>
                        Click <strong>Re-check</strong> (or <strong>Reconnect X Account</strong>) above once the App is inside a Project.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="rounded-lg bg-[#0B0E11] border border-white/[0.07] p-4 space-y-2">
                <p className="font-semibold text-white">
                  Option A · OAuth 1.0a Keys (Simplest for Automation)
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Set app permissions to <strong className="text-slate-200">Read and Write</strong>, generate User Access Token & Secret, and add these 4 Secrets:
                </p>
                <ul className="font-mono-tabular text-[11px] text-emerald-300 space-y-1 pt-1">
                  <li>X_API_KEY</li>
                  <li>X_API_SECRET</li>
                  <li>X_ACCESS_TOKEN</li>
                  <li>X_ACCESS_TOKEN_SECRET</li>
                </ul>
              </div>

              <div className="rounded-lg bg-[#0B0E11] border border-white/[0.07] p-4 space-y-2">
                <p className="font-semibold text-white">
                  Option B · OAuth 2.0 PKCE (Interactive Sign-In)
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Add <code className="text-emerald-300">X_CLIENT_ID</code> and <code className="text-emerald-300">X_CLIENT_SECRET</code> to Secrets, and register this exact Callback URI in X User Authentication Settings:
                </p>
                {status?.callbackUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <code className="flex-1 truncate px-2.5 py-1.5 rounded bg-[#12161C] border border-white/10 text-[11px] text-slate-200 font-mono-tabular">
                      {status.callbackUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyCallback()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/15 text-[11px] text-white cursor-pointer shrink-0"
                    >
                      {copiedCallback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCallback ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Simple Text Composer & Scheduler */}
          <form
            onSubmit={(e) => void handlePublishOrSchedule(e)}
            className="lg:col-span-5 bg-[#12161C] border border-white/[0.07] rounded-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-white">
                Compose Text Test Post
              </h3>
              <button
                type="button"
                onClick={() => setText(STARTER_TEST_COPY)}
                className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                Reset sample text
              </button>
            </div>

            <div>
              <textarea
                aria-label="X test post text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a simple test post to publish on X..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0E11] border border-white/10 focus:border-emerald-500 focus:outline-none text-sm text-white leading-relaxed resize-y"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500">Plain text post (X API v2)</span>
                <span
                  className={`font-mono-tabular ${
                    overLimit ? 'text-amber-400 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {charCount} / 280
                </span>
              </div>
            </div>

            {/* Delivery Mode */}
            <div className="space-y-3 pt-2 border-t border-white/[0.07]">
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B0E11] border border-white/[0.08] rounded-lg">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('now')}
                  className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    deliveryMode === 'now'
                      ? 'bg-emerald-500 text-emerald-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Post Now
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode('schedule')}
                  className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    deliveryMode === 'schedule'
                      ? 'bg-emerald-500 text-emerald-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Schedule Auto-Post
                </button>
              </div>

              {deliveryMode === 'schedule' && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDelayMinutes(1)}
                      className="px-2.5 py-1 rounded bg-[#0B0E11] border border-white/10 hover:border-emerald-500/40 text-[11px] text-slate-300 cursor-pointer"
                    >
                      In 1 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelayMinutes(5)}
                      className="px-2.5 py-1 rounded bg-[#0B0E11] border border-white/10 hover:border-emerald-500/40 text-[11px] text-slate-300 cursor-pointer"
                    >
                      In 5 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelayMinutes(60)}
                      className="px-2.5 py-1 rounded bg-[#0B0E11] border border-white/10 hover:border-emerald-500/40 text-[11px] text-slate-300 cursor-pointer"
                    >
                      In 1 hour
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    aria-label="Scheduled publish date and time"
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0E11] border border-white/10 focus:border-emerald-500 focus:outline-none text-xs text-white font-mono-tabular"
                  />
                </div>
              )}
            </div>

            {feedback && (
              <p
                className={`text-xs rounded-lg px-3 py-2 border ${
                  feedback.type === 'error'
                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                    : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                }`}
              >
                {feedback.message}
              </p>
            )}

            <button
              type="submit"
              disabled={!isConnected || submitting || !text.trim() || overLimit}
              className="w-full py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{deliveryMode === 'schedule' ? 'Scheduling...' : 'Publishing to X...'}</span>
                </>
              ) : deliveryMode === 'schedule' ? (
                <>
                  <CalendarClock className="w-4 h-4" />
                  <span>Queue Automated Post</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Test Post to X</span>
                </>
              )}
            </button>
          </form>

          {/* Automated Queue & Real Performance Metrics */}
          <div className="lg:col-span-7 bg-[#12161C] border border-white/[0.07] rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display text-base font-semibold text-white">
                  Test Posts & Live Performance
                </h3>
              </div>

              <button
                type="button"
                onClick={() => void handleRefreshMetrics()}
                disabled={!isConnected || refreshingMetrics || posts.every((p) => p.status !== 'published')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 hover:border-white/30 disabled:opacity-45 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingMetrics ? 'animate-spin' : ''}`} />
                <span>{refreshingMetrics ? 'Refreshing...' : 'Refresh Metrics'}</span>
              </button>
            </div>

            {posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-[#0B0E11] p-8 text-center space-y-1.5">
                <p className="text-sm font-medium text-slate-300">No X test posts sent yet</p>
                <p className="text-xs text-slate-500">
                  Connect your X account, send a simple test post, and refresh metrics to track impressions, likes, and replies.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-lg bg-[#0B0E11] border border-white/[0.07] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-medium ${
                            post.status === 'published'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : post.status === 'scheduled'
                              ? 'bg-sky-500/15 text-sky-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {post.status === 'published'
                            ? 'Published'
                            : post.status === 'scheduled'
                            ? 'Scheduled'
                            : 'Failed'}
                        </span>
                        <span className="text-slate-400 font-mono-tabular">
                          {post.status === 'scheduled'
                            ? `Runs ${formatDateTime(post.scheduledFor)}`
                            : formatDateTime(post.publishedAt ?? post.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {post.tweetUrl && (
                          <a
                            href={post.tweetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            <span>View on X</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteRecord(post.id)}
                          aria-label="Remove post record"
                          className="p-1 text-slate-500 hover:text-slate-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {post.text}
                    </p>

                    {post.error && (
                      <p className="text-xs text-amber-300">Error: {post.error}</p>
                    )}

                    {post.status === 'published' && post.metrics && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                        <div>
                          <span className="block text-[11px] text-slate-500">Impressions</span>
                          <span className="font-mono-tabular font-semibold text-white">
                            {post.metrics.impression_count.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Likes</span>
                          <span className="font-mono-tabular font-semibold text-white">
                            {post.metrics.like_count.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Reposts</span>
                          <span className="font-mono-tabular font-semibold text-white">
                            {post.metrics.retweet_count.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Replies</span>
                          <span className="font-mono-tabular font-semibold text-white">
                            {post.metrics.reply_count.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Bookmarks</span>
                          <span className="font-mono-tabular font-semibold text-white">
                            {post.metrics.bookmark_count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
