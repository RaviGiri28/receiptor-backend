const crypto = require('crypto');
const { sendUserEmail } = require('../config/mailer');
const { appUrl } = require('../config/appUrl');

const RESET_TOKEN_MINUTES = 30;

// Only the SHA-256 of a reset token is stored, so a database leak can't be used to reset
// passwords. Tokens are random 256-bit values, so a fast hash is enough.
const hashResetToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const newResetToken = () => {
    const token = crypto.randomBytes(32).toString('base64url');
    return {
        token,
        hash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000),
    };
};

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// Simple branded card shared by both emails.
const emailHtml = ({ title, intro, button, outro }) => `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fc;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px -18px rgba(26,60,140,0.35);">
        <tr><td style="background-color:#1a3c8c;padding:26px 32px;text-align:center;">
          <div style="font-size:34px;line-height:1;">🔐</div>
          <div style="color:#ffffff;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-top:10px;opacity:0.85;">Quick Receipt Pro</div>
          <h1 style="color:#ffffff;font-size:22px;line-height:1.3;margin:6px 0 0;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;font-size:15px;line-height:1.6;color:#0f1f47;">${intro}</td></tr>${button ? `
        <tr><td align="center" style="padding:16px 32px 8px;">
          <a href="${escapeHtml(button.href)}" style="display:inline-block;background:#1a3c8c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:999px;">${escapeHtml(button.label)}</a>
        </td></tr>` : ''}
        <tr><td style="padding:16px 32px 32px;font-size:14px;line-height:1.6;color:#5b6478;">${outro}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const sendResetEmail = async (user, token) => {
    const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const name = firstName(user.name);
    const text = [
        `Hi ${name},`,
        '',
        'We received a request to reset the password for your Quick Receipt Pro account.',
        `Open this link to choose a new password (it works once, for ${RESET_TOKEN_MINUTES} minutes):`,
        '',
        link,
        '',
        'If you did not ask for this, you can ignore this email. Your password will not change.',
        '',
        'The Quick Receipt Pro Team',
    ].join('\n');
    const html = emailHtml({
        title: 'Reset your password',
        intro: `Hi ${escapeHtml(name)},<br><br>We received a request to reset the password for your Quick Receipt Pro account. Click the button below to choose a new one.`,
        button: { href: link, label: 'Choose a new password' },
        outro: `This link works once and expires in <strong>${RESET_TOKEN_MINUTES} minutes</strong>.<br><br>
          If you did not ask for this, you can ignore this email. Your password will not change.<br><br>
          <span style="font-size:12px;color:#8a93a6;">Button not working? Copy this link into your browser:<br>
          <a href="${escapeHtml(link)}" style="color:#1a3c8c;word-break:break-all;">${escapeHtml(link)}</a></span>`,
    });
    await sendUserEmail({ to: user.email, subject: 'Reset your Quick Receipt Pro password', text, html });
};

const sendPasswordChangedEmail = async (user) => {
    const name = firstName(user.name);
    const loginLink = `${appUrl()}/login`;
    const text = [
        `Hi ${name},`,
        '',
        'The password for your Quick Receipt Pro account was just changed, and you were signed out on all devices.',
        `If this was you, log in with your new password: ${loginLink}`,
        '',
        'If you did not do this, reset your password straight away and reply to this email so we can help.',
        '',
        'The Quick Receipt Pro Team',
    ].join('\n');
    const html = emailHtml({
        title: 'Your password was changed',
        intro: `Hi ${escapeHtml(name)},<br><br>The password for your Quick Receipt Pro account was just changed, and you were signed out on all devices.`,
        button: { href: loginLink, label: 'Log in' },
        outro: '<strong style="color:#0f1f47;">Wasn\'t you?</strong> Reset your password straight away and reply to this email so we can help.',
    });
    await sendUserEmail({ to: user.email, subject: 'Your Quick Receipt Pro password was changed', text, html });
};

const sendPasswordResetByAdminEmail = async (user) => {
    const name = firstName(user.name);
    const loginLink = `${appUrl()}/login`;
    const text = [
        `Hi ${name},`,
        '',
        'The Quick Receipt Pro team has reset the password for your account, and you were signed out on all devices.',
        'We will share your new password with you directly. After logging in, please change it in your Profile.',
        '',
        'If you did not ask for this, reply to this email straight away so we can help.',
        '',
        'The Quick Receipt Pro Team',
    ].join('\n');
    const html = emailHtml({
        title: 'Your password was reset',
        intro: `Hi ${escapeHtml(name)},<br><br>The Quick Receipt Pro team has reset the password for your account, and you were signed out on all devices. We will share your new password with you directly. After logging in, please change it in your Profile.`,
        button: { href: loginLink, label: 'Log in' },
        outro: '<strong style="color:#0f1f47;">Did not ask for this?</strong> Reply to this email straight away so we can help.',
    });
    await sendUserEmail({ to: user.email, subject: 'Your Quick Receipt Pro password was reset', text, html });
};

module.exports = {
    RESET_TOKEN_MINUTES, hashResetToken, newResetToken, sendResetEmail, sendPasswordChangedEmail, sendPasswordResetByAdminEmail,
};
