export type Bindings = {
  DB: D1Database;
  RESEND_API_KEY: string;
};

export type VerifyMessage = {
  agentId: string;
  baseUrl: string;
};

export default {
  async fetch(): Promise<Response> {
    return new Response(null, { status: 204 });
  },
  async queue(_batch: MessageBatch<VerifyMessage>, _env: Bindings): Promise<void> {
    // Implemented in Phase 5 (Task 5.2).
  },
};
