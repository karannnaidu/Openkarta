import crypto from 'node:crypto';

export interface QuoteTokenPayload {
  cartId: string;
  totalMinor: number;
  currency: string;
  expiresAt: string; // ISO
}

const b64u = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64uDecode = (s: string): Buffer => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length/4)*4, '=');
  return Buffer.from(padded, 'base64');
};

export const signQuoteToken = (payload: QuoteTokenPayload, secret: string): string => {
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  const sig  = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
};

export const verifyQuoteToken = (token: string, secret: string): QuoteTokenPayload => {
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new Error('quote_invalid: malformed');
  const expected = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  const aBuf = Buffer.from(sig);
  const eBuf = Buffer.from(expected);
  if (aBuf.length !== eBuf.length || !crypto.timingSafeEqual(aBuf, eBuf)) {
    throw new Error('quote_invalid: signature mismatch');
  }
  const payload = JSON.parse(b64uDecode(body).toString('utf8')) as QuoteTokenPayload;
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new Error('quote_expired');
  }
  return payload;
};
