import { Hono } from 'hono';
import { magicLinkRouter } from './auth/magic-link.js';
import { meRouter } from './auth/me.js';
import { githubRouter } from './auth/github.js';
import type { SessionAccount } from './auth/session.js';
import { agentsCreateRouter } from './routes/agents-create.js';
import { agentsVerifyRouter } from './routes/agents-verify.js';
import { agentsPublicRouter } from './routes/agents-public.js';
import { agentsUpdateRouter } from './routes/agents-update.js';
import { agentsDeleteRouter } from './routes/agents-delete.js';
import { agentsReverifyRouter } from './routes/agents-reverify.js';
import { agentsTransferRouter } from './routes/agents-transfer.js';
import { makeResendClient, type EmailClient } from '@openkarta/registry-shared';

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
  account?: SessionAccount;
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
app.route('/auth', githubRouter());

app.route('/v1', agentsCreateRouter());
app.route('/v1', agentsVerifyRouter());
app.route('/v1', agentsPublicRouter());
app.route('/v1', agentsUpdateRouter());
app.route('/v1', agentsDeleteRouter());
app.route('/v1', agentsReverifyRouter());
app.route('/v1', agentsTransferRouter((env) => emailClientFactory(env)));

app.onError((err, c) => {
  console.error('registry-api error', err);
  return c.json({ error: { code: 'internal_error', message: 'an unexpected error occurred' } }, 500);
});

export default app;
