import { Hono } from 'hono';
import { magicLinkRouter } from './auth/magic-link.js';
import { meRouter } from './auth/me.js';
import { makeResendClient, type EmailClient } from './email/resend.js';

export type Bindings = {
  DB: D1Database;
  VERIFY_QUEUE: Queue;
  RESEND_API_KEY: string;
  GITHUB_OAUTH_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  PUBLIC_BASE_URL: string;
  WEB_BASE_URL: string;
};

export type Variables = {
  // populated by requireSession middleware
  account?: { id: string; email: string };
};

// Indirected for tests: vitest's environment overrides this with a stub.
let emailClientFactory: (env: Bindings) => EmailClient = (env) =>
  makeResendClient(env.RESEND_API_KEY);

export function setEmailClientFactory(f: (env: Bindings) => EmailClient): void {
  emailClientFactory = f;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.get('/health', (c) => c.json({ ok: true }));

app.route('/auth', magicLinkRouter((env) => emailClientFactory(env)));
app.route('/auth', meRouter());

export default app;
