import { Hono } from 'hono';

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

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) => c.json({ ok: true }));

export default app;
