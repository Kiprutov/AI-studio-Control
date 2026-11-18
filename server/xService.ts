import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';

export type XAuthMode = 'oauth1' | 'oauth2' | 'none';

export interface XUser {
  id: string;
  name: string;
  username: string;
}

export interface XTweetMetrics {
  impression_count: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  bookmark_count: number;
}

export interface XPostRecord {
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

interface OAuth2Session {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  user?: XUser;
}

interface PendingPkce {
  codeVerifier: string;
  createdAt: number;
  redirectUri: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const POSTS_FILE = path.join(DATA_DIR, 'x-posts.json');
const SESSION_COOKIE_NAME = 'shuleni_x_sid';

const pendingPkceStore = new Map<string, PendingPkce>();
const oauth2Sessions = new Map<string, OAuth2Session>();
let latestOAuth2SessionId: string | null = null;
let cachedOAuth1User: XUser | null = null;
let postsCache: XPostRecord[] | null = null;
let schedulerTimer: NodeJS.Timeout | null = null;
let schedulerRunning = false;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPosts(): XPostRecord[] {
  if (postsCache !== null) return postsCache;
  try {
    if (fs.existsSync(POSTS_FILE)) {
      const raw = fs.readFileSync(POSTS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        postsCache = parsed as XPostRecord[];
        return postsCache;
      }
    }
  } catch {
    // Ignore corrupt disk state and reset cleanly
  }
  postsCache = [];
  return postsCache;
}

function savePosts(posts: XPostRecord[]): void {
  postsCache = posts;
  try {
    ensureDataDir();
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist X posts log:', err);
  }
}

export function getAppBaseUrl(): string {
  const raw = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  return raw.replace(/\/+$/, '');
}

export function getXCallbackUrl(): string {
  return `${getAppBaseUrl()}/auth/x/callback`;
}

function isOAuth1Configured(): boolean {
  return Boolean(
    process.env.X_API_KEY?.trim() &&
      process.env.X_API_SECRET?.trim() &&
      process.env.X_ACCESS_TOKEN?.trim() &&
      process.env.X_ACCESS_TOKEN_SECRET?.trim(),
  );
}

function isOAuth2Configured(): boolean {
  return Boolean(process.env.X_CLIENT_ID?.trim());
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function isSecureContext(req: Request): boolean {
  if (getAppBaseUrl().startsWith('https://')) return true;
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  return typeof proto === 'string' && proto.split(',')[0].trim() === 'https';
}

function setSessionCookie(req: Request, res: Response, sid: string): void {
  const secure = isSecureContext(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sid)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=2592000',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureContext(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function percentEncode(input: string): string {
  return encodeURIComponent(input).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildOAuth1Header(method: string, url: string): string {
  const apiKey = process.env.X_API_KEY!.trim();
  const apiSecret = process.env.X_API_SECRET!.trim();
  const accessToken = process.env.X_ACCESS_TOKEN!.trim();
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET!.trim();

  const parsedUrl = new URL(url);
  const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams: [string, string][] = [];
  parsedUrl.searchParams.forEach((value, key) => {
    allParams.push([key, value]);
  });
  for (const [k, v] of Object.entries(oauthParams)) {
    allParams.push([k, v]);
  }

  allParams.sort((a, b) => {
    const ka = percentEncode(a[0]);
    const kb = percentEncode(b[0]);
    if (ka !== kb) return ka < kb ? -1 : 1;
    const va = percentEncode(a[1]);
    const vb = percentEncode(b[1]);
    return va < vb ? -1 : va > vb ? 1 : 0;
  });

  const paramString = allParams
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerParts = Object.keys(headerParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`);

  return `OAuth ${headerParts.join(', ')}`;
}

async function refreshOAuth2TokenIfNeeded(sid: string, session: OAuth2Session): Promise<OAuth2Session> {
  if (Date.now() < session.expiresAt - 60_000) {
    return session;
  }
  if (!session.refreshToken || !isOAuth2Configured()) {
    return session;
  }

  const clientId = process.env.X_CLIENT_ID!.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: clientId,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  }

  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  if (!res.ok) {
    return session;
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return session;

  const updated: OAuth2Session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    user: session.user,
  };
  oauth2Sessions.set(sid, updated);
  return updated;
}

function getActiveOAuth2Session(req?: Request): { sid: string; session: OAuth2Session } | null {
  if (req) {
    const cookies = parseCookies(req);
    const sid = cookies[SESSION_COOKIE_NAME];
    if (sid && oauth2Sessions.has(sid)) {
      return { sid, session: oauth2Sessions.get(sid)! };
    }
  }
  if (latestOAuth2SessionId && oauth2Sessions.has(latestOAuth2SessionId)) {
    return { sid: latestOAuth2SessionId, session: oauth2Sessions.get(latestOAuth2SessionId)! };
  }
  return null;
}

class XApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function xApiRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  req?: Request,
  jsonBody?: Record<string, unknown>,
): Promise<T> {
  const oauth2 = getActiveOAuth2Session(req);
  let authHeader: string;

  if (oauth2) {
    const fresh = await refreshOAuth2TokenIfNeeded(oauth2.sid, oauth2.session);
    authHeader = `Bearer ${fresh.accessToken}`;
  } else if (isOAuth1Configured()) {
    authHeader = buildOAuth1Header(method, url);
  } else {
    throw new XApiError('X account is not connected. Add X API credentials or connect via OAuth 2.0.', 401);
  }

  const headers: Record<string, string> = {
    Authorization: authHeader,
  };
  if (jsonBody !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { detail: text };
  }

  if (!res.ok) {
    const errMsg =
      (typeof parsed.detail === 'string' && parsed.detail) ||
      (typeof parsed.title === 'string' && parsed.title) ||
      (typeof parsed.error_description === 'string' && parsed.error_description) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      `X API returned status ${res.status}`;
    throw new XApiError(errMsg, res.status);
  }

  return parsed as T;
}

async function fetchMe(req?: Request): Promise<XUser | null> {
  const oauth2 = getActiveOAuth2Session(req);
  if (oauth2?.session.user) {
    return oauth2.session.user;
  }
  if (!oauth2 && cachedOAuth1User) {
    return cachedOAuth1User;
  }

  try {
    const me = await xApiRequest<{ data?: XUser }>('GET', 'https://api.x.com/2/users/me', req);
    if (me.data) {
      if (oauth2) {
        oauth2.session.user = me.data;
      } else if (isOAuth1Configured()) {
        cachedOAuth1User = me.data;
      }
      return me.data;
    }
  } catch {
    return null;
  }
  return null;
}

async function publishPostRecord(record: XPostRecord, req?: Request): Promise<XPostRecord> {
  try {
    const me = await fetchMe(req);
    const created = await xApiRequest<{ data?: { id: string; text: string } }>(
      'POST',
      'https://api.x.com/2/tweets',
      req,
      { text: record.text },
    );

    const tweetId = created.data?.id ?? null;
    const username = me?.username ?? record.username ?? null;
    const tweetUrl =
      tweetId && username
        ? `https://x.com/${username}/status/${tweetId}`
        : tweetId
        ? `https://x.com/i/web/status/${tweetId}`
        : null;

    return {
      ...record,
      status: 'published',
      publishedAt: new Date().toISOString(),
      tweetId,
      tweetUrl,
      username,
      error: null,
      metrics: {
        impression_count: 0,
        like_count: 0,
        retweet_count: 0,
        reply_count: 0,
        quote_count: 0,
        bookmark_count: 0,
      },
      lastMetricsAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to post to X.';
    return {
      ...record,
      status: 'failed',
      error: message,
    };
  }
}

async function runDueScheduledPosts(): Promise<void> {
  if (schedulerRunning) return;
  if (!getActiveOAuth2Session() && !isOAuth1Configured()) return;

  schedulerRunning = true;
  try {
    const posts = loadPosts();
    const now = Date.now();
    let changed = false;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      if (post.status !== 'scheduled' || !post.scheduledFor) continue;
      const dueAt = new Date(post.scheduledFor).getTime();
      if (!Number.isFinite(dueAt) || dueAt > now) continue;

      posts[i] = await publishPostRecord(post);
      changed = true;
    }

    if (changed) {
      savePosts(posts);
    }
  } finally {
    schedulerRunning = false;
  }
}

export function startXScheduler(): void {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    void runDueScheduledPosts();
  }, 15_000);
}

export async function handleXStatus(req: Request, res: Response): Promise<void> {
  const oauth2 = getActiveOAuth2Session(req);
  const oauth1 = isOAuth1Configured();
  const authMode: XAuthMode = oauth2 ? 'oauth2' : oauth1 ? 'oauth1' : 'none';
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  let user: XUser | null = oauth2 ? oauth2.session.user ?? null : oauth1 ? cachedOAuth1User : null;
  let connectionError: string | null = null;
  let rateLimited = false;

  if (authMode !== 'none' && (!user || forceRefresh)) {
    try {
      const me = await xApiRequest<{ data?: XUser }>('GET', 'https://api.x.com/2/users/me', req);
      user = me.data ?? null;
      if (oauth2 && user) oauth2.session.user = user;
      if (!oauth2 && oauth1 && user) cachedOAuth1User = user;
    } catch (err) {
      if (err instanceof XApiError && err.statusCode === 429) {
        rateLimited = true;
      } else {
        connectionError = err instanceof Error ? err.message : 'Failed to verify X account.';
      }
    }
  }

  res.json({
    connected: authMode !== 'none' && (!connectionError || rateLimited),
    authMode,
    user,
    connectionError,
    rateLimited,
    oauth1Configured: oauth1,
    oauth2Configured: isOAuth2Configured(),
    callbackUrl: getXCallbackUrl(),
  });
}

export function handleXOAuthUrl(_req: Request, res: Response): void {
  if (!isOAuth2Configured()) {
    res.status(400).json({
      error: 'X_CLIENT_ID is not configured in environment variables.',
    });
    return;
  }

  // Clean stale PKCE states older than 15 min
  const cutoff = Date.now() - 15 * 60_000;
  for (const [k, v] of pendingPkceStore.entries()) {
    if (v.createdAt < cutoff) pendingPkceStore.delete(k);
  }

  const state = crypto.randomBytes(20).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const redirectUri = getXCallbackUrl();

  pendingPkceStore.set(state, {
    codeVerifier,
    createdAt: Date.now(),
    redirectUri,
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  res.json({
    url: `https://x.com/i/oauth2/authorize?${params.toString()}`,
    callbackUrl: redirectUri,
  });
}

export async function handleXOAuthCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

  if (oauthError) {
    res.status(400).send(`
      <html>
        <body style="font-family:system-ui;background:#0B0E11;color:#f1f5f9;padding:24px;">
          <h3>X Authorization Cancelled</h3>
          <p>${oauthError}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', provider: 'x', error: ${JSON.stringify(oauthError)} }, '*');
              setTimeout(() => window.close(), 1200);
            }
          </script>
        </body>
      </html>
    `);
    return;
  }

  const pending = pendingPkceStore.get(state);
  pendingPkceStore.delete(state);

  if (!code || !pending) {
    res.status(400).send('Invalid or expired OAuth state. Please close this window and try again.');
    return;
  }

  try {
    const clientId = process.env.X_CLIENT_ID!.trim();
    const clientSecret = process.env.X_CLIENT_SECRET?.trim();

    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.codeVerifier,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (clientSecret) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${basic}`;
    }

    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
      error?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Token exchange failed.');
    }

    const meRes = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const meJson = (await meRes.json().catch(() => ({}))) as { data?: XUser };

    const sid = crypto.randomBytes(24).toString('hex');
    oauth2Sessions.set(sid, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in ?? 7200) * 1000,
      user: meJson.data,
    });
    latestOAuth2SessionId = sid;
    setSessionCookie(req, res, sid);

    res.send(`
      <html>
        <body style="font-family:system-ui;background:#0B0E11;color:#f1f5f9;padding:24px;">
          <p>X account connected. This window will close automatically.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'x' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth token exchange failed.';
    res.status(500).send(`
      <html>
        <body style="font-family:system-ui;background:#0B0E11;color:#f1f5f9;padding:24px;">
          <h3>Failed to Connect X</h3>
          <p>${message}</p>
        </body>
      </html>
    `);
  }
}

export function handleXDisconnect(req: Request, res: Response): void {
  const cookies = parseCookies(req);
  const sid = cookies[SESSION_COOKIE_NAME];
  if (sid) {
    oauth2Sessions.delete(sid);
    if (latestOAuth2SessionId === sid) latestOAuth2SessionId = null;
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
}

export function handleListXPosts(_req: Request, res: Response): void {
  const posts = loadPosts().slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ posts });
}

export async function handleCreateXPost(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as {
    text?: unknown;
    scheduledFor?: unknown;
  };

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    res.status(400).json({ error: 'Post text is required.' });
    return;
  }
  if (text.length > 280) {
    res.status(400).json({ error: 'Post text must be 280 characters or fewer.' });
    return;
  }

  const hasAuth = Boolean(getActiveOAuth2Session(req) || isOAuth1Configured());
  if (!hasAuth) {
    res.status(401).json({
      error: 'Connect your X account or configure X API credentials before posting.',
    });
    return;
  }

  const rawScheduled = typeof body.scheduledFor === 'string' ? body.scheduledFor.trim() : '';
  let scheduledIso: string | null = null;
  if (rawScheduled) {
    const parsedTime = new Date(rawScheduled).getTime();
    if (!Number.isFinite(parsedTime)) {
      res.status(400).json({ error: 'Invalid schedule timestamp.' });
      return;
    }
    if (parsedTime > Date.now() + 5_000) {
      scheduledIso = new Date(parsedTime).toISOString();
    }
  }

  const baseRecord: XPostRecord = {
    id: crypto.randomUUID(),
    text,
    status: scheduledIso ? 'scheduled' : 'published',
    createdAt: new Date().toISOString(),
    scheduledFor: scheduledIso,
    publishedAt: null,
    tweetId: null,
    tweetUrl: null,
    username: null,
    error: null,
    metrics: null,
    lastMetricsAt: null,
  };

  const finalRecord = scheduledIso ? baseRecord : await publishPostRecord(baseRecord, req);

  const posts = loadPosts();
  posts.unshift(finalRecord);
  savePosts(posts);

  if (finalRecord.status === 'failed') {
    res.status(502).json({ error: finalRecord.error || 'Failed to publish to X.', post: finalRecord });
    return;
  }

  res.status(201).json({ post: finalRecord });
}

export async function handleRefreshXMetrics(req: Request, res: Response): Promise<void> {
  const posts = loadPosts();
  const published = posts.filter((p) => p.status === 'published' && p.tweetId);

  if (published.length === 0) {
    res.json({ posts });
    return;
  }

  const hasAuth = Boolean(getActiveOAuth2Session(req) || isOAuth1Configured());
  if (!hasAuth) {
    res.status(401).json({ error: 'X account is not connected.' });
    return;
  }

  try {
    const ids = published.slice(0, 100).map((p) => p.tweetId!).join(',');
    const url = `https://api.x.com/2/tweets?ids=${encodeURIComponent(ids)}&tweet.fields=public_metrics,created_at`;
    const result = await xApiRequest<{
      data?: Array<{
        id: string;
        public_metrics?: Partial<XTweetMetrics>;
      }>;
    }>('GET', url, req);

    const byId = new Map<string, XTweetMetrics>();
    for (const item of result.data ?? []) {
      const m = item.public_metrics ?? {};
      byId.set(item.id, {
        impression_count: m.impression_count ?? 0,
        like_count: m.like_count ?? 0,
        retweet_count: m.retweet_count ?? 0,
        reply_count: m.reply_count ?? 0,
        quote_count: m.quote_count ?? 0,
        bookmark_count: m.bookmark_count ?? 0,
      });
    }

    const nowIso = new Date().toISOString();
    const updated = posts.map((p) => {
      if (!p.tweetId || !byId.has(p.tweetId)) return p;
      return {
        ...p,
        metrics: byId.get(p.tweetId)!,
        lastMetricsAt: nowIso,
      };
    });

    savePosts(updated);
    res.json({ posts: updated.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to refresh X metrics.';
    res.status(502).json({ error: message });
  }
}

export function handleDeleteXPost(req: Request, res: Response): void {
  const id = req.params.id;
  const posts = loadPosts();
  const next = posts.filter((p) => p.id !== id);
  savePosts(next);
  res.json({ posts: next.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
}
