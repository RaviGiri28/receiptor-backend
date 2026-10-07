const { rateLimit } = require('express-rate-limit');

// Per-IP limits on the auth endpoints, to slow down password guessing and signup spam.
const limiter = (windowMinutes, limit, message, extra = {}) => rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message },
    ...extra,
});

// Only failed attempts count, so a user who logs in correctly is never locked out.
const loginLimiter = limiter(15, 10, 'Too many failed login attempts. Try again in 15 minutes.', {
    skipSuccessfulRequests: true,
});

const registerLimiter = limiter(60, 5, 'Too many accounts created from this network. Try again later.');

const changePasswordLimiter = limiter(15, 5, 'Too many attempts. Try again in 15 minutes.', {
    skipSuccessfulRequests: true,
});

// Per account (runs after protect), so shop staff sharing one network don't block each other.
const supportLimiter = limiter(60, 5, 'Too many support messages. Please try again in an hour.', {
    keyGenerator: (req) => `user:${req.user.id}`,
});

module.exports = { loginLimiter, registerLimiter, changePasswordLimiter, supportLimiter };
