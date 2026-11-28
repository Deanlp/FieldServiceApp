export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A uniformly random 6-digit code, e.g. "042917". */
export function sixDigitCode(): string {
  const limit = 4_294_000_000; // largest multiple of 1e6 below 2^32, avoids modulo bias
  let n: number;
  do n = crypto.getRandomValues(new Uint32Array(1))[0]!;
  while (n >= limit);
  return String(n % 1_000_000).padStart(6, "0");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
