import { gitMirrorSnapshot } from './git-mirror.js';

export type Bindings = {
  DB: D1Database;
  VERIFY_QUEUE: Queue;
  GITHUB_BOT_PAT: string;
  GITHUB_REPO: string;
  GIT_MIRROR_BRANCH: string;
  PUBLIC_BASE_URL: string;
};

export const REVERIFY_CRON = '0 2 * * *';
export const MIRROR_CRON = '0 3 * * *';

type AgentToReverify = { id: string; base_url: string };

export async function enqueueReverify(env: Bindings): Promise<number> {
  const { results } = await env.DB
    .prepare(
      "SELECT id, base_url FROM agents WHERE verification_status = 'verified' AND health_status != 'delisted'",
    )
    .all<AgentToReverify>();
  for (const row of results) {
    await env.VERIFY_QUEUE.send({ agentId: row.id, baseUrl: row.base_url });
  }
  return results.length;
}

export default {
  async fetch(): Promise<Response> {
    return new Response(null, { status: 204 });
  },
  async scheduled(
    controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (controller.cron === REVERIFY_CRON) {
      ctx.waitUntil(enqueueReverify(env).then(() => {}));
      return;
    }
    if (controller.cron === MIRROR_CRON) {
      ctx.waitUntil(gitMirrorSnapshot(env).then(() => {}));
      return;
    }
    console.warn('unknown cron', controller.cron);
  },
};
