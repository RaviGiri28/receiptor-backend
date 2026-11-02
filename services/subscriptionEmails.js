// Subscription emails: "your trial has started", "your trial ends in 24 hours" and the order confirmation.
// Sent in the background: a failure is logged and never affects the request.
const { canEmailUsers, sendUserEmail } = require('../config/mailer');
const { appUrl } = require('../config/appUrl');

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

const formatDateTime = (date) => new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
});

const layout = ({ preheader, icon, heading, paragraphs, highlight, button, footer }) => `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fc;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px -18px rgba(26,60,140,0.35);">
        <tr><td style="background:linear-gradient(135deg,#1a3c8c,#2f5fd0);background-color:#1a3c8c;padding:32px;text-align:center;">
          <div style="font-size:42px;line-height:1;">${icon}</div>
          <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-top:14px;opacity:0.85;">Quick Receipt</div>
          <h1 style="color:#ffffff;font-size:24px;line-height:1.3;margin:8px 0 0;">${escapeHtml(heading)}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          ${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;color:#0f1f47;margin:0 0 12px;">${p}</p>`).join('')}
        </td></tr>
        <tr><td style="padding:4px 32px 20px;">
          <div style="background:#f6f8fd;border:1px solid #e3e9f7;border-radius:14px;padding:16px;text-align:center;">
            <div style="font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#5b6478;">${escapeHtml(highlight.label)}</div>
            <div style="font-size:18px;font-weight:800;color:#1a3c8c;margin-top:4px;">${escapeHtml(highlight.value)}</div>
          </div>
        </td></tr>${button ? `
        <tr><td align="center" style="padding:4px 32px 28px;">
          <a href="${escapeHtml(button.url)}" style="display:inline-block;background:#1a3c8c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:999px;">${escapeHtml(button.label)} &rarr;</a>
        </td></tr>` : ''}
        <tr><td style="padding:0 32px 32px;font-size:15px;line-height:1.6;color:#0f1f47;">
          Questions? Just reply to this email, we are happy to help.<br><br>
          Warm regards,<br><strong>The Quick Receipt Team</strong>
        </td></tr>
      </table>
      <p style="max-width:560px;font-size:12px;line-height:1.5;color:#8a93a6;margin:16px auto 0;text-align:center;">${escapeHtml(footer)}</p>
    </td></tr>
  </table>
</body>
</html>`;

const send = (user, label, email) => {
    if (!canEmailUsers()) return;
    sendUserEmail({ to: user.email, ...email })
        .catch((err) => console.error(`${label} email to user #${user.id} failed:`, err.message || err));
};

const buildPlanStartedEmail = (user, { days }) => {
    const url = appUrl();
    const name = firstName(user.name);
    const until = formatDateTime(user.plan_expires_at);
    const paid = user.plan === 'paid';
    const subject = paid
        ? `${days} days added to your Quick Receipt plan`
        : `Your ${days}-day Quick Receipt free trial has started 🎉`;
    const intro = paid
        ? `We have added ${days} days to your Quick Receipt plan.`
        : `Your ${days}-day free trial of Quick Receipt is now active. Create and print as many receipts as you like.`;
    const text = [
        `Hi ${name},`,
        '',
        intro,
        `Your access is active until ${until}.`,
        paid ? null : 'You can upgrade to a paid plan any time with the "Upgrade now" button in the app.',
        '',
        url ? `Open Quick Receipt: ${url}/create` : null,
        '',
        'Warm regards,',
        'The Quick Receipt Team',
    ].filter((line) => line !== null).join('\n');
    const html = layout({
        preheader: `Active until ${until}.`,
        icon: '🎉',
        heading: paid ? 'Days added to your plan' : `Your ${days}-day free trial has started`,
        paragraphs: [
            `Hi ${escapeHtml(name)},`,
            escapeHtml(intro),
            ...(paid ? [] : ['You can upgrade to a paid plan any time with the <strong>Upgrade now</strong> button in the app.']),
        ],
        highlight: { label: 'Active until', value: until },
        button: url ? { url: `${url}/create`, label: 'Create a receipt' } : null,
        footer: `You are receiving this because you have a Quick Receipt account with ${user.email}.`,
    });
    return { subject, text, html };
};

const buildExpiryReminderEmail = (user) => {
    const url = appUrl();
    const name = firstName(user.name);
    const until = formatDateTime(user.plan_expires_at);
    const what = user.plan === 'paid' ? 'Quick Receipt plan' : 'Quick Receipt free trial';
    const subject = `Your ${what} ends in 24 hours`;
    const text = [
        `Hi ${name},`,
        '',
        `Your ${what} ends on ${until}.`,
        'After that you can still log in and view your past receipts, but you cannot create new receipts until you choose a plan.',
        '',
        'Plans start at Rs. 249 per month.',
        url ? `Upgrade now: ${url}/?upgrade=1` : null,
        '',
        'Warm regards,',
        'The Quick Receipt Team',
    ].filter((line) => line !== null).join('\n');
    const html = layout({
        preheader: `Ends on ${until}. Upgrade to keep creating receipts.`,
        icon: '⏰',
        heading: `Your ${user.plan === 'paid' ? 'plan' : 'free trial'} ends in 24 hours`,
        paragraphs: [
            `Hi ${escapeHtml(name)},`,
            `Your ${escapeHtml(what)} is ending soon. After that you can still log in and view your past receipts, but you cannot create new receipts until you choose a plan.`,
            'Plans start at just <strong>&#8377;249 per month</strong>.',
        ],
        highlight: { label: 'Ends on', value: until },
        button: url ? { url: `${url}/?upgrade=1`, label: 'Upgrade now' } : null,
        footer: `You are receiving this because you have a Quick Receipt account with ${user.email}.`,
    });
    return { subject, text, html };
};

const formatRupees = (paise) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
}).format(paise / 100);

// Order confirmation for a completed payment. amount is in paise.
const buildPaymentSuccessEmail = (user, { plan, amount, orderId, paymentId, paidAt }) => {
    const url = appUrl();
    const name = firstName(user.name);
    const total = formatRupees(amount);
    const until = formatDateTime(user.plan_expires_at);
    const rows = [
        ['Order ID', orderId],
        ['Payment ID', paymentId],
        ['Date', formatDateTime(paidAt)],
        ['Plan', `Quick Receipt ${plan.name}`],
        ['Duration', `${plan.days} days`],
        ['Plan active until', until],
    ];
    const subject = `Payment successful: your Quick Receipt ${plan.name} plan is active`;
    const text = [
        `Hi ${name},`,
        '',
        `Your payment of ${total} was successful and your Quick Receipt ${plan.name} plan is now active.`,
        '',
        'ORDER SUMMARY',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        `Total paid: ${total} (inclusive of all taxes)`,
        '',
        url ? `Start creating receipts: ${url}/create` : null,
        '',
        'Questions about this order? Reply to this email and include your Order ID.',
        '',
        'Warm regards,',
        'The Quick Receipt Team',
        '',
        'This is a payment confirmation, not a tax invoice.',
    ].filter((line) => line !== null).join('\n');
    const rowHtml = rows.map(([label, value]) => `
              <tr>
                <td style="padding:11px 0;border-bottom:1px solid #e9edf6;font-size:14px;color:#5b6478;">${escapeHtml(label)}</td>
                <td align="right" style="padding:11px 0 11px 16px;border-bottom:1px solid #e9edf6;font-size:14px;font-weight:600;color:#0f1f47;word-break:break-word;">${escapeHtml(value)}</td>
              </tr>`).join('');
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fc;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(`${total} received. Your plan is active until ${until}.`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e9f7;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:20px 32px;border-bottom:1px solid #e9edf6;">
          <span style="font-size:17px;font-weight:800;color:#1a3c8c;">Quick Receipt</span>
          <span style="float:right;font-size:13px;line-height:24px;color:#5b6478;">Order confirmation</span>
        </td></tr>
        <tr><td style="background:#ecfdf5;padding:28px 32px;text-align:center;border-bottom:1px solid #d1fae5;">
          <table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>
            <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;background:#059669;border-radius:24px;color:#ffffff;font-size:24px;font-weight:700;line-height:48px;">&#10003;</td>
          </tr></table>
          <h1 style="font-size:22px;line-height:1.3;color:#065f46;margin:14px 0 4px;">Payment successful</h1>
          <p style="font-size:14px;line-height:1.5;color:#047857;margin:0;">Your plan is purchased and active.</p>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="font-size:15px;line-height:1.6;color:#0f1f47;margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
          <p style="font-size:15px;line-height:1.6;color:#0f1f47;margin:0;">Thank you for your purchase. We have received your payment of <strong>${escapeHtml(total)}</strong> and your <strong>${escapeHtml(plan.name)}</strong> plan is ready to use.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#5b6478;margin-bottom:4px;">Order summary</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}
            <tr>
              <td style="padding:16px 0 4px;font-size:15px;font-weight:700;color:#0f1f47;">Total paid</td>
              <td align="right" style="padding:16px 0 4px 16px;font-size:20px;font-weight:800;color:#1a3c8c;">${escapeHtml(total)}</td>
            </tr>
            <tr><td colspan="2" align="right" style="font-size:12px;color:#8a93a6;">Inclusive of all taxes</td></tr>
          </table>
        </td></tr>${url ? `
        <tr><td align="center" style="padding:20px 32px 12px;">
          <a href="${escapeHtml(`${url}/create`)}" style="display:inline-block;background:#1a3c8c;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:999px;">Start creating receipts &rarr;</a>
        </td></tr>` : ''}
        <tr><td style="padding:16px 32px 28px;font-size:14px;line-height:1.6;color:#0f1f47;">
          Questions about this order? Reply to this email and include your Order ID.<br><br>
          Warm regards,<br><strong>The Quick Receipt Team</strong>
        </td></tr>
      </table>
      <p style="max-width:560px;font-size:12px;line-height:1.5;color:#8a93a6;margin:16px auto 0;text-align:center;">This is a payment confirmation, not a tax invoice. You are receiving it because you bought a plan with your Quick Receipt account ${escapeHtml(user.email)}.</p>
    </td></tr>
  </table>
</body>
</html>`;
    return { subject, text, html };
};

const sendPlanStartedEmail = (user, details) => send(user, 'Plan started', buildPlanStartedEmail(user, details));

const sendPaymentSuccessEmail = (user, details) => send(user, 'Payment success', buildPaymentSuccessEmail(user, details));

module.exports = {
    buildPlanStartedEmail, buildExpiryReminderEmail, buildPaymentSuccessEmail, sendPlanStartedEmail, sendPaymentSuccessEmail,
};
