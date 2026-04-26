export interface EmailClient {
  sendMagicLink(args: { to: string; link: string }): Promise<{ id: string }>;
  sendVerificationPassed(args: { to: string; agentId: string }): Promise<{ id: string }>;
  sendHealthTransition(args: {
    to: string;
    agentId: string;
    kind: 'stale' | 'delisted' | 'back_to_healthy';
  }): Promise<{ id: string }>;
  sendTransferInvite(args: { to: string; agentId: string; link: string }): Promise<{ id: string }>;
}

const FROM_DEFAULT = 'OpenKarta <noreply@openkarta.org>';

export function makeResendClient(apiKey: string, from: string = FROM_DEFAULT): EmailClient {
  async function send(to: string, subject: string, html: string): Promise<{ id: string }> {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) {
      throw new Error(`resend ${r.status}: ${await r.text()}`);
    }
    return (await r.json()) as { id: string };
  }
  return {
    sendMagicLink: ({ to, link }) =>
      send(
        to,
        'Sign in to OpenKarta',
        `<p><a href="${link}">Sign in to OpenKarta</a> &mdash; this link expires in 15 minutes.</p>`,
      ),
    sendVerificationPassed: ({ to, agentId }) =>
      send(
        to,
        `Listing verified: ${agentId}`,
        `<p>Your agent <code>${agentId}</code> passed conformance and is now listed on the public registry.</p>`,
      ),
    sendHealthTransition: ({ to, agentId, kind }) =>
      send(
        to,
        `${agentId}: ${kind.replace(/_/g, ' ')}`,
        `<p>Your agent <code>${agentId}</code> is now <b>${kind.replace(/_/g, ' ')}</b>.</p>`,
      ),
    sendTransferInvite: ({ to, agentId, link }) =>
      send(
        to,
        `Transfer invite: ${agentId}`,
        `<p><a href="${link}">Accept ownership transfer of ${agentId}</a> &mdash; this invite expires in 24 hours.</p>`,
      ),
  };
}
