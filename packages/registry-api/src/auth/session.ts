import { sessionId as newSessionId } from "@openkarta/registry-shared";

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface SessionAccount {
  id: string;
  email: string;
  displayName: string | null;
  githubLogin: string | null;
}

export async function createSession(env: { DB: D1Database }, accountId: string): Promise<string> {
  const id = newSessionId();
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  await env.DB.prepare("INSERT INTO sessions (id, account_id, expires_at) VALUES (?,?,?)")
    .bind(id, accountId, expiresAt)
    .run();
  return id;
}

export async function readSession(
  env: { DB: D1Database },
  id: string,
): Promise<SessionAccount | null> {
  const row = await env.DB.prepare(
    `SELECT s.account_id, s.expires_at, a.email, a.display_name, a.github_login
       FROM sessions s
       JOIN accounts a ON a.id = s.account_id
      WHERE s.id = ?`,
  )
    .bind(id)
    .first<{
      account_id: string;
      expires_at: number;
      email: string;
      display_name: string | null;
      github_login: string | null;
    }>();
  if (!row) return null;
  if (row.expires_at < Math.floor(Date.now() / 1000)) return null;
  return {
    id: row.account_id,
    email: row.email,
    displayName: row.display_name,
    githubLogin: row.github_login,
  };
}

export async function clearSession(env: { DB: D1Database }, id: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}

export const SESSION_COOKIE = "okr_sess";

export function sessionCookieValue(id: string, expiresInSeconds: number = TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${id}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=${expiresInSeconds}`;
}

export const SESSION_CLEAR_COOKIE = `${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0`;

export function readCookieFromHeader(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const m = new RegExp(`(?:^|; )${name}=([^;]+)`).exec(cookieHeader);
  return m ? m[1] : undefined;
}
