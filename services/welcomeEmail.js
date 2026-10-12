const { canEmailUsers, sendUserEmail } = require('../config/mailer');
const { appUrl } = require('../config/appUrl');

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstName = (name) => String(name).trim().split(/\s+/)[0] || 'there';

const steps = [
    { icon: '🏪', title: 'Add your logo', text: 'Upload your shop logo in Profile. It prints at the top of every receipt.' },
    { icon: '📋', title: 'Paste and go', text: 'Paste a bank SMS or customer message into Smart Paste. The details fill in by themselves.' },
    { icon: '🖨️', title: 'Print in seconds', text: 'Print on your 58mm or 80mm thermal printer, with a customer and shop copy if you like.' },
];

const buildWelcomeEmail = (user) => {
    const url = appUrl();
    const name = firstName(user.name);
    const subject = `Welcome to Quick Receipt, ${name}! 🎉`;

    const text = [
        `Hi ${name},`,
        '',
        `Welcome to Quick Receipt! Your account for ${user.business_name} is ready, and we are really glad to have you with us.`,
        '',
        'Get started in three steps:',
        ...steps.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`),
        '',
        url ? `Create your first receipt: ${url}/create` : null,
        'When you first log in, a short guided tour will show you around.',
        '',
        'Questions? Just reply to this email, we are happy to help.',
        '',
        'Warm regards,',
        'The Quick Receipt Team',
        '',
        `You are receiving this because you created a Quick Receipt account with ${user.email}.`,
    ].filter((line) => line !== null).join('\n');

    const button = url ? `
              <tr><td align="center" style="padding:8px 32px 28px;">
                <a href="${escapeHtml(url)}/create" style="display:inline-block;background:#1a3c8c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:999px;">Create your first receipt &rarr;</a>
              </td></tr>` : '';

    const stepRows = steps.map((s, i) => `
                  <tr>
                    <td valign="top" style="padding:10px 14px 10px 0;width:44px;">
                      <div style="width:44px;height:44px;line-height:44px;text-align:center;font-size:22px;background:#eef3ff;border-radius:12px;">${s.icon}</div>
                    </td>
                    <td valign="top" style="padding:10px 0;">
                      <div style="font-size:15px;font-weight:700;color:#0f1f47;">${i + 1}. ${s.title}</div>
                      <div style="font-size:14px;line-height:1.5;color:#5b6478;margin-top:2px;">${s.text}</div>
                    </td>
                  </tr>`).join('');

    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fc;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Your account is ready. Here is how to print your first receipt in under a minute.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px -18px rgba(26,60,140,0.35);">
        <tr><td style="background:linear-gradient(135deg,#1a3c8c,#2f5fd0);background-color:#1a3c8c;padding:36px 32px;text-align:center;">
          <div style="font-size:44px;line-height:1;">🧾</div>
          <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-top:14px;opacity:0.85;">Quick Receipt</div>
          <h1 style="color:#ffffff;font-size:26px;line-height:1.25;margin:8px 0 0;">Welcome aboard, ${escapeHtml(name)}!</h1>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="font-size:16px;line-height:1.6;color:#0f1f47;margin:0 0 12px;">
            Your account for <strong>${escapeHtml(user.business_name)}</strong> is ready, and we are really glad to have you with us. 🎉
          </p>
          <p style="font-size:15px;line-height:1.6;color:#5b6478;margin:0;">
            Quick Receipt turns a pasted transaction message into a neat, printed receipt in seconds. Here is how to get started:
          </p>
        </td></tr>
        <tr><td style="padding:12px 32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stepRows}
          </table>
        </td></tr>${button}
        <tr><td style="padding:0 32px 28px;">
          <div style="background:#f6f8fd;border:1px solid #e3e9f7;border-radius:14px;padding:14px 16px;font-size:14px;line-height:1.5;color:#5b6478;">
            💡 <strong style="color:#0f1f47;">Tip:</strong> when you first log in, a short guided tour shows you around and prints a demo receipt with you.
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 32px;font-size:15px;line-height:1.6;color:#0f1f47;">
          Questions? Just reply to this email, we are happy to help.<br><br>
          Warm regards,<br><strong>The Quick Receipt Team</strong>
        </td></tr>
      </table>
      <p style="max-width:560px;font-size:12px;line-height:1.5;color:#8a93a6;margin:16px auto 0;text-align:center;">
        You are receiving this because you created a Quick Receipt account with ${escapeHtml(user.email)}.
      </p>
    </td></tr>
  </table>
</body>
</html>`;

    return { subject, text, html };
};

// Sends the welcome email in the background: a failure is logged and never affects signup.
const sendWelcomeEmail = (user) => {
    if (!canEmailUsers()) return;
    const { subject, text, html } = buildWelcomeEmail(user);
    sendUserEmail({ to: user.email, subject, text, html })
        .catch((err) => console.error(`Welcome email to user #${user.id} failed:`, err.message || err));
};

module.exports = { buildWelcomeEmail, sendWelcomeEmail };
