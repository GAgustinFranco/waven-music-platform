import { RESEND_API_URL, ResendMailDriver } from './resend-mail.driver.js';

const message = { to: 'fan@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('ResendMailDriver', () => {
  it('posts the message to the Resend API with the key', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    const driver = new ResendMailDriver({ apiKey: 're_test', from: 'Waven <hi@waven.app>', fetch });

    await driver.send(message);

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESEND_API_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test' });
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'Waven <hi@waven.app>',
      to: ['fan@example.com'],
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('fails with only the status, never the response body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"message":"fan@example.com is invalid"}', { status: 422 }));
    const driver = new ResendMailDriver({ apiKey: 're_test', from: 'Waven <hi@waven.app>', fetch });

    await expect(driver.send(message)).rejects.toThrow(/^Resend answered 422$/);
  });
});
