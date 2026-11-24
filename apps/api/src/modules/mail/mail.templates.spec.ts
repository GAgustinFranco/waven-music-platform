import { escapeHtml, premiumWelcomeEmail, welcomeEmail } from './mail.templates.js';
import { maskEmail } from './mail.types.js';

const VERIFY_URL = 'http://localhost:3000/verify-email?token=abc_DEF-123';

describe('email templates', () => {
  it('includes the verification link in the HTML and the plain text', () => {
    const email = welcomeEmail({ displayName: 'Fan', verifyUrl: VERIFY_URL });

    expect(email.subject).toBe('Welcome to Waven');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain(`href="${VERIFY_URL}"`);
    expect(email.text).toContain(`Verify my email: ${VERIFY_URL}`);
    expect(email.text).toContain('Welcome, Fan!');
  });

  it('leaves the link out when there is nothing to verify', () => {
    const email = welcomeEmail({ displayName: 'Fan' });

    expect(email.html).not.toContain('verify-email');
    expect(email.text).not.toContain('verify-email');
  });

  it('escapes what the user typed', () => {
    const email = welcomeEmail({ displayName: '<script>"x"</script>' });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
    expect(escapeHtml(`a&b'`)).toBe('a&amp;b&#39;');
  });

  it('lists theme switching as a Premium benefit', () => {
    const email = premiumWelcomeEmail({ displayName: 'Fan', appUrl: 'http://localhost:3000/' });

    expect(email.subject).toBe('Welcome to Waven Premium');
    expect(email.text).toContain('switch between themes');
    expect(email.text).not.toMatch(/kbps|quality/i);
    expect(email.text).toContain('Open Waven: http://localhost:3000/');
  });

  it('masks emails for logs', () => {
    expect(maskEmail('fan@example.com')).toBe('f***@example.com');
    expect(maskEmail('broken')).toBe('***');
  });
});
