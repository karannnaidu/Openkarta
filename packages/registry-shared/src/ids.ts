const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeBase32Random(byteLength: number, charLength: number): string {
  const rand = new Uint8Array(byteLength);
  crypto.getRandomValues(rand);
  let out = "";
  for (let i = 0; i < charLength; i++) {
    const b = rand[i % byteLength] ?? 0;
    out += CROCKFORD[b % 32];
  }
  return out;
}

export function ulid(): string {
  const ts = Date.now();
  let n = ts;
  const tsChars: string[] = [];
  for (let i = 0; i < 10; i++) {
    tsChars.unshift(CROCKFORD[n % 32]!);
    n = Math.floor(n / 32);
  }
  return tsChars.join("") + encodeBase32Random(16, 16);
}

export function verificationToken(): string {
  return `okv-${encodeBase32Random(24, 24)}`;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function sessionId(): string {
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  return base64url(rand);
}
