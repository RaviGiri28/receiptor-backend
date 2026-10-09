require('dotenv').config();

// Admins are configured by email (comma-separated), e.g. ADMIN_EMAILS=owner@example.com.
// Read on every call so a changed env value applies after a restart without code changes.
const adminEmails = () => (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) => Boolean(email) && adminEmails().includes(String(email).toLowerCase());

module.exports = { isAdminEmail };
