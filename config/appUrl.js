// Address of the web app, for links in emails: APP_URL, else the first CORS origin, else
// the local dev server outside production. Never taken from the request (a forged Host or
// Origin header must not be able to point a password-reset link at another site).
const appUrl = () => {
    const configured = process.env.APP_URL || (process.env.CORS_ORIGIN || '').split(',')[0];
    const url = configured.trim() || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080');
    return url.replace(/\/+$/, '');
};

module.exports = { appUrl };
