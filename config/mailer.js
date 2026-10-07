const nodemailer = require('nodemailer');
require('dotenv').config();

// SMTP settings, e.g. Gmail: smtp.gmail.com / 465 / your address / a Google App Password.
// Any other SMTP provider (Brevo, etc.) works by changing these variables only.
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;

const isConfigured = () => Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SUPPORT_INBOX
);

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

// Startup check so wrong credentials show up in the logs, not on the first ticket.
const verifyMailer = async () => {
    if (!isConfigured()) {
        console.warn('Email is not configured: support tickets will be saved but not emailed. Set SMTP_* and SUPPORT_INBOX in .env.');
        return;
    }
    try {
        await getTransporter().verify();
        console.log('SMTP connection verified');
    } catch (err) {
        console.error('SMTP verification failed:', err.message || err);
    }
};

// Header values must be single-line.
const oneLine = (text) => String(text).replace(/[\r\n]+/g, ' ').trim();

// Emails a support ticket to SUPPORT_INBOX; replying goes straight to the user.
const sendSupportEmail = async (ticket, user) => {
    if (!isConfigured()) {
        throw new Error('Email is not configured');
    }
    const from = process.env.SMTP_FROM || `"Quick Receipt Support" <${process.env.SMTP_USER}>`;
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

    await getTransporter().sendMail({
        from,
        to: process.env.SUPPORT_INBOX,
        replyTo: { name: oneLine(ticket.name), address: ticket.email },
        subject: oneLine(`[Quick Receipt Support #${ticket.id}] ${ticket.subject} - ${user.business_name}`),
        // Plain text only, so nothing the user typed is rendered as HTML.
        text,
    });
};

module.exports = { isConfigured, verifyMailer, sendSupportEmail };
