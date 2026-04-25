export type Bindings = {
  DB: D1Database;
  VERIFY_QUEUE: Queue;
  GITHUB_BOT_PAT: string;
  GITHUB_REPO: string;
  GIT_MIRROR_BRANCH: string;
};

export default {
  async fetch(): Promise<Response> {
    return new Response(null, { status: 204 });
  },
  async scheduled(_controller: ScheduledController, _env: Bindings, _ctx: ExecutionContext): Promise<void> {
    // Implemented in Phase 6.
  },
};
