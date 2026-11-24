/** The subject, HTML and plain text of an email, before it gets a recipient. */
export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

interface Block {
  /** One paragraph of plain text (escaped for the HTML version). */
  paragraph?: string;
  /** A call to action: a real link, so it works with images and styles off. */
  button?: { label: string; url: string };
}

/**
 * A single-column layout with inline styles (email clients drop `<style>`),
 * high contrast and a `lang` attribute. Every link is also printed as text.
 */
function layout(subject: string, heading: string, blocks: Block[]): MailContent {
  const body = blocks
    .map(({ paragraph, button }) => {
      if (button) {
        const url = escapeHtml(button.url);
        return (
          `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#5b21b6;color:#ffffff;` +
          `padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>` +
          `<p style="margin:0 0 16px;font-size:14px;color:#3f3f46">If the button does not work, copy this link into your browser:<br>` +
          `<a href="${url}" style="color:#5b21b6;word-break:break-all">${url}</a></p>`
        );
      }
      return `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(paragraph ?? '')}</p>`;
    })
    .join('');

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:24px;background:#f4f4f5;color:#18181b;font-family:Arial,Helvetica,sans-serif;font-size:16px">` +
    `<main style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">` +
    `<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#5b21b6">Waven</p>` +
    `<h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(heading)}</h1>${body}` +
    `<p style="margin:24px 0 0;font-size:14px;color:#3f3f46">— The Waven team</p>` +
    `</main></body></html>`;

  const text = [
    heading,
    '',
    ...blocks.flatMap(({ paragraph, button }) =>
      button ? [`${button.label}: ${button.url}`, ''] : [paragraph ?? '', ''],
    ),
    '— The Waven team',
  ].join('\n');

  return { subject, html, text };
}

/** Sent once when an account is created; password accounts also get the verification link. */
export function welcomeEmail(input: { displayName: string; verifyUrl?: string }): MailContent {
  const blocks: Block[] = [
    {
      paragraph:
        'Thanks for joining Waven. Your account is ready: search the catalog, build playlists and keep your favorites in one place.',
    },
  ];
  if (input.verifyUrl) {
    blocks.push(
      {
        paragraph:
          'Please confirm this is your email address. The link works once and expires in 24 hours.',
      },
      { button: { label: 'Verify my email', url: input.verifyUrl } },
      { paragraph: 'If you did not create a Waven account, you can ignore this email.' },
    );
  }
  return layout('Welcome to Waven', `Welcome, ${input.displayName}!`, blocks);
}

/** Sent once when a subscription becomes active after its first payment. */
export function premiumWelcomeEmail(input: { displayName: string; appUrl: string }): MailContent {
  return layout('Welcome to Waven Premium', `You are on Premium, ${input.displayName}!`, [
    { paragraph: 'Your payment went through and Premium is active.' },
    {
      paragraph:
        'You can now create unlimited playlists and switch between themes to make Waven look the way you like.',
    },
    { button: { label: 'Open Waven', url: input.appUrl } },
  ]);
}
