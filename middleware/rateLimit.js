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

// Only accounts actually created count, so a mistyped coupon code doesn't use up the tries.
const registerLimiter = limiter(60, 5, 'Too many accounts created from this network. Try again later.', {
    skipFailedRequests: true,
});

const changePasswordLimiter = limiter(15, 5, 'Too many attempts. Try again in 15 minutes.', {
    skipSuccessfulRequests: true,
});

// Per account (runs after protect), so shop staff sharing one network don't block each other.
const supportLimiter = limiter(60, 5, 'Too many support messages. Please try again in an hour.', {
    keyGenerator: (req) => `user:${req.user.id}`,
});

// Forgot password, per network: limits reset emails sent to any one inbox.
const forgotPasswordLimiter = limiter(60, 5, 'Too many reset requests. Please try again in an hour.');

// Reset links tried with a new password, per network (failed tries only).
const resetPasswordLimiter = limiter(15, 10, 'Too many attempts. Try again in 15 minutes.', {
    skipSuccessfulRequests: true,
});

// Landing-page Contact form, per network (visitors have no account).
const contactLimiter = limiter(60, 5, 'Too many messages from this network. Please try again in an hour.');

// Wrong app passcodes, per account (runs after protect): a 4-digit code must not be guessable.
const passcodeLimiter = limiter(15, 5, 'Too many wrong passcodes. Try again in 15 minutes.', {
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `passcode:${req.user.id}`,
});

// Wrong coupon codes, per account (runs after protect), so codes can't be guessed.
const couponLimiter = limiter(15, 10, 'Too many wrong coupon codes. Try again in 15 minutes.', {
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `coupon:${req.user.id}`,
});

const paymentLimiter = limiter(15, 20, 'Too many payment attempts. Try again in 15 minutes.', {
    keyGenerator: (req) => `payment:${req.user.id}`,
});

module.exports = {
    loginLimiter, registerLimiter, changePasswordLimiter, forgotPasswordLimiter, resetPasswordLimiter, supportLimiter,
    contactLimiter, passcodeLimiter, couponLimiter, paymentLimiter,
};
