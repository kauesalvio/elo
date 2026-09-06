import { describe, it, expect, vi } from 'vitest';
import { issueHostCookie, hasHostSession } from '../lib/host-session';
const secret = 'secure-host-key-'.repeat(5);
const req = (cookie: string) =>
  new Request('https://elo.test/', {
    headers: { cookie: cookie.split(';')[0] },
  });
describe('host session', () => {
  it('uses a signed Secure HttpOnly cookie instead of storing the host key in browser JavaScript', async () => {
    const cookie = await issueHostCookie(secret);
    expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict');
    expect(cookie).not.toContain(secret);
    expect(await hasHostSession(req(cookie), secret)).toBe(true);
  });
  it('rejects tampering and a rotated host key', async () => {
    const cookie = await issueHostCookie(secret);
    expect(
      await hasHostSession(
        req(cookie.replace(/\.[a-f0-9]{64}/, '.' + '0'.repeat(64))),
        secret,
      ),
    ).toBe(false);
    expect(await hasHostSession(req(cookie), secret + 'changed')).toBe(false);
  });
  it('expires in seven days', async () => {
    vi.useFakeTimers();
    try {
      const cookie = await issueHostCookie(secret);
      vi.setSystemTime(Date.now() + 7 * 86400000);
      expect(await hasHostSession(req(cookie), secret)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it('rejects absent or malformed cookies', async () => {
    expect(await hasHostSession(new Request('https://elo.test/'), secret)).toBe(
      false,
    );
    expect(await hasHostSession(req('__Host-elo-host=garbage'), secret)).toBe(
      false,
    );
  });
});
