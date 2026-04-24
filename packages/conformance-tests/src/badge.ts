import { createHmac } from 'node:crypto';
import type { Badge } from './types.js';

export type BadgePayload = Omit<Badge, 'signature'>;

const canonicalJson = (obj: BadgePayload): string => {
  const ordered: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) ordered[k] = (obj as Record<string, unknown>)[k];
  return JSON.stringify(ordered);
};

export const signBadge = (payload: BadgePayload, secret: string): Badge => {
  const signature = createHmac('sha256', secret)
    .update(canonicalJson(payload))
    .digest('base64url');
  return { ...payload, signature };
};
