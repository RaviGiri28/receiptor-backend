const crypto = require('crypto');

// A short, human-readable device label from the User-Agent, e.g. "Chrome on Windows".
// Only shown to the user; never used for security decisions.
const deviceLabel = (userAgent = '') => {
    const ua = String(userAgent);
    const browser =
        /Edg\//.test(ua) ? 'Edge'
        : /OPR\/|Opera/.test(ua) ? 'Opera'
        : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
        : /Firefox\//.test(ua) ? 'Firefox'
        : /Chrome\//.test(ua) ? 'Chrome'
        : /Safari\//.test(ua) ? 'Safari'
        : 'a browser';
    const os =
        /Android/.test(ua) ? 'Android'
        : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Windows/.test(ua) ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
        : /Linux/.test(ua) ? 'Linux'
        : 'another device';
    return `${browser} on ${os}`.slice(0, 100);
};

// Starts a new session for the user: every token of earlier sessions stops working.
// Returns the new session id, to put in the token as "sid".
const startSession = async (repo, userId, req) => {
    const sessionId = crypto.randomUUID();
    await repo.update({ id: userId }, {
        session_id: sessionId,
        session_started_at: new Date(),
        session_device: deviceLabel(req.headers['user-agent']),
    });
    return sessionId;
};

module.exports = { deviceLabel, startSession };
