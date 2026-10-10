const nodemailer = require('nodemailer');
require('dotenv').config();

// Two ways to send email:
// 1. Brevo HTTP API (BREVO_API_KEY): goes over HTTPS, so it works on hosts that block
//    SMTP ports, like Render's free plan. BREVO_SENDER must be a sender verified in Brevo.
// 2. SMTP, e.g. Gmail: smtp.gmail.com / 465 / your address / a Google App Password.
const BREVO_API = 'https://api.brevo.com/v3';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
const SENDER_NAME = 'Quick Receipt Support';

const useBrevo = () => Boolean(process.env.BREVO_API_KEY);

const isConfigured = () => Boolean(process.env.SUPPORT_INBOX) && (useBrevo()
    ? Boolean(process.env.BREVO_SENDER || process.env.SMTP_USER)
    : Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));

let transporter = null;
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: SMTP_PORT,
            // 465 = TLS from the start; 587 = STARTTLS upgrade.
            secure: SMTP_PORT === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return transporter;
};

const brevoRequest = async (path, options = {}) => {
    const res = await fetch(`${BREVO_API}${path}`, {
        ...options,
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
            accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(`Brevo ${res.status}: ${data?.message || res.statusText}`);
    }
    return res;
};

// Startup check so wrong credentials show up in the logs, not on the first ticket.
const verifyMailer = async () => {
    if (!isConfigured()) {
        console.warn('Email is not configured: support tickets will be saved but not emailed. Set BREVO_* or SMTP_*, and SUPPORT_INBOX, in .env.');
        return;
    }
    try {
        if (useBrevo()) {
            await brevoRequest('/account');
            console.log('Brevo email API verified');
        } else {
            await getTransporter().verify();
            console.log('SMTP connection verified');
        }
    } catch (err) {
        console.error(`${useBrevo() ? 'Brevo' : 'SMTP'} verification failed:`, err.message || err);
    }
};

// Header values must be single-line.
const oneLine = (text) => String(text).replace(/[\r\n]+/g, ' ').trim();

// Emails a support ticket to SUPPORT_INBOX; replying goes straight to the user.
const sendSupportEmail = async (ticket, user) => {
    if (!isConfigured()) {
        throw new Error('Email is not configured');
    }
    const subject = oneLine(`[Quick Receipt Support #${ticket.id}] ${ticket.subject} - ${user.business_name}`);
    const text = [
        `Ticket #${ticket.id}`,
        `From: ${ticket.name} <${ticket.email}>`,
        `Account: ${user.name} <${user.email}> (user #${user.id})`,
        `Business: ${user.business_name}`,
        `Phone: ${user.phone_number}`,
        '',
        `Subject: ${ticket.subject}`,
        '',
        ticket.message,
    ].join('\n');

    if (useBrevo()) {
        await brevoRequest('/smtp/email', {
            method: 'POST',
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: process.env.BREVO_SENDER || process.env.SMTP_USER },
                to: [{ email: process.env.SUPPORT_INBOX }],
                replyTo: { name: oneLine(ticket.name), email: ticket.email },
                subject,
                // Plain text only, so nothing the user typed is rendered as HTML.
                textContent: text,
            }),
        });
        return;
    }

    const from = process.env.SMTP_FROM || `"${SENDER_NAME}" <${process.env.SMTP_USER}>`;
    await getTransporter().sendMail({
        from,
        to: process.env.SUPPORT_INBOX,
        replyTo: { name: oneLine(ticket.name), address: ticket.email },
        subject,
        // Plain text only, so nothing the user typed is rendered as HTML.
        text,
    });
};

// Email to users needs only a sender (no SUPPORT_INBOX).
const canEmailUsers = () => (useBrevo()
    ? Boolean(process.env.BREVO_SENDER || process.env.SMTP_USER)
    : Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));

// Plain-text email to a user; replies go to the support inbox when one is set.
const sendUserEmail = async ({ to, subject, text }) => {
    if (!canEmailUsers()) {
        throw new Error('Email is not configured');
    }
    const replyTo = process.env.SUPPORT_INBOX || undefined;
    if (useBrevo()) {
        await brevoRequest('/smtp/email', {
            method: 'POST',
            body: JSON.stringify({
                sender: { name: 'Quick Receipt', email: process.env.BREVO_SENDER || process.env.SMTP_USER },
                to: [{ email: to }],
                ...(replyTo && { replyTo: { email: replyTo } }),
                subject: oneLine(subject),
                textContent: text,
            }),
        });
        return;
    }
    await getTransporter().sendMail({
        from: process.env.SMTP_FROM || `"Quick Receipt" <${process.env.SMTP_USER}>`,
        to,
        replyTo,
        subject: oneLine(subject),
        text,
    });
};

module.exports = { isConfigured, verifyMailer, sendSupportEmail, canEmailUsers, sendUserEmail };
