import { Logger } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { type MailDriver } from './mail.types.js';
import { MemoryMailDriver } from './memory-mail.driver.js';

const content = { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('MailService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands the message to the driver', async () => {
    const driver = new MemoryMailDriver();

    await new MailService(driver).send('fan@example.com', 'welcome', content);

    expect(driver.to('fan@example.com')).toEqual([{ to: 'fan@example.com', ...content }]);
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('SMTP is down'))],
    [
      'throws',
      () => {
        throw new Error('SMTP is down');
      },
    ],
  ])(
    'never fails the caller when the driver %s, and logs without the recipient',
    async (_case, send) => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const driver: MailDriver = { send: vi.fn(send) };

      await expect(
        new MailService(driver).send('fan@example.com', 'welcome', content),
      ).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledOnce();
      expect(JSON.stringify(error.mock.calls)).not.toContain('fan@example.com');
      expect(error.mock.calls[0]?.[0]).toEqual({ template: 'welcome', error: 'SMTP is down' });
    },
  );
});
