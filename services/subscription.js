// Subscriptions: every account needs an active trial or paid plan to create receipts.
//  - Signup: a 7-day trial (DEFAULT_TRIAL_DAYS), or the coupon's days with a valid coupon.
//    The trial starts on the first login (trial_days_pending until then).
//  - Accounts made before subscriptions have plan = NULL and see a popup with the
//    "existing users" coupon, which starts their trial from inside the app.
//  - Paid plans come from a Razorpay payment (services/payment.js) or an admin.
//  - Admins (ADMIN_EMAILS) never need a plan.
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const Coupon = require('../entity/Coupon');
const CouponRedemption = require('../entity/CouponRedemption');
const { isAdminEmail } = require('../config/admin');
const { DAY_MS } = require('../config/legal');
const { sendPlanStartedEmail } = require('./subscriptionEmails');

// Columns needed to work out a user's subscription.
const SUBSCRIPTION_COLUMNS = ['plan', 'plan_id', 'plan_started_at', 'plan_expires_at', 'trial_days_pending'];

class CouponError extends Error {
    constructor(message, status = 400, code = 'COUPON_INVALID') {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const time = (date) => (date ? new Date(date).getTime() : null);

// status: 'admin' | 'trial' | 'paid' | 'expired' | 'none' (never had a plan).
const subscriptionInfo = (user, now = Date.now()) => {
    const expiresAt = time(user.plan_expires_at);
    let status;
    if (isAdminEmail(user.email)) status = 'admin';
    else if (!user.plan || !expiresAt) status = 'none';
    else if (expiresAt > now) status = user.plan === 'paid' ? 'paid' : 'trial';
    else status = 'expired';
    return {
        status,
        plan: user.plan || null,
        plan_id: user.plan_id || null,
        started_at: user.plan_started_at || null,
        expires_at: user.plan_expires_at || null,
        can_create: status === 'admin' || status === 'trial' || status === 'paid',
    };
};

// Takes one use of a coupon inside a transaction; throws CouponError when it can't be used.
// audiences: which coupon audiences this place accepts.
const claimCoupon = async (manager, rawCode, audiences) => {
    const code = normalizeCode(rawCode);
    const coupon = code && await manager.getRepository(Coupon).findOne({ where: { code } });
    if (!coupon || !audiences.includes(coupon.audience)) {
        if (coupon && coupon.audience === 'signup') throw new CouponError('This coupon code can only be used when creating a new account.');
        if (coupon && coupon.audience === 'existing') throw new CouponError('This coupon code is only for existing accounts. Log in and enter it there.');
        if (coupon && coupon.audience === 'expired') throw new CouponError('This coupon code is only for accounts whose free trial has ended. Log in and enter it there.');
        if (coupon && coupon.audience === 'personal') throw new CouponError('This coupon code was made for an existing account. Log in to that account and enter it there.');
        throw new CouponError('Invalid coupon code.');
    }
    const now = new Date();
    if (!coupon.is_active) throw new CouponError('This coupon code is no longer active.');
    if (coupon.expires_at && time(coupon.expires_at) <= now.getTime()) throw new CouponError('This coupon code has expired.');
    // Checked and counted in one statement, so two people can't both take the last use.
    const result = await manager.query(
        `UPDATE coupons SET used_count = used_count + 1
         WHERE id = ? AND is_active = 1 AND (max_uses IS NULL OR used_count < max_uses)
           AND (expires_at IS NULL OR expires_at > ?)`,
        [coupon.id, now]
    );
    if (!result || result.affectedRows !== 1) throw new CouponError('This coupon code has reached its usage limit.');
    return coupon;
};

const recordRedemption = async (manager, coupon, userId) => {
    try {
        await manager.getRepository(CouponRedemption).insert({ coupon_id: coupon.id, user_id: userId, trial_days: coupon.trial_days });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new CouponError('You have already used this coupon code.');
        throw err;
    }
};

// New plan period: adds `days` to the current plan if it is still running, else starts now.
// A running paid plan stays paid when trial days are added to it.
const extendedPlan = (user, { plan, days, planId = null }, now = Date.now()) => {
    const current = subscriptionInfo(user, now);
    const running = current.status === 'trial' || current.status === 'paid';
    const from = running ? time(user.plan_expires_at) : now;
    const keepPaid = running && current.status === 'paid' && plan === 'trial';
    const newPlan = keepPaid ? 'paid' : plan;
    return {
        plan: newPlan,
        plan_id: keepPaid ? user.plan_id : (plan === 'paid' ? planId : null),
        // A trial turning paid starts a new period (its unused trial days are kept).
        plan_started_at: running && user.plan === newPlan ? user.plan_started_at : new Date(now),
        plan_expires_at: new Date(from + days * DAY_MS),
        trial_days_pending: null,
    };
};

// First login after signup: starts the trial chosen at signup and emails the user.
// Only one concurrent login can start it (the UPDATE matches once).
const activatePendingTrial = async (user) => {
    if (!user.trial_days_pending || user.plan_expires_at) return null;
    const now = new Date();
    const changes = {
        plan: 'trial',
        plan_id: null,
        plan_started_at: now,
        plan_expires_at: new Date(now.getTime() + user.trial_days_pending * DAY_MS),
    };
    const result = await AppDataSource.query(
        `UPDATE users SET plan = ?, plan_id = NULL, plan_started_at = ?, plan_expires_at = ?, trial_days_pending = NULL
         WHERE id = ? AND trial_days_pending IS NOT NULL AND plan_expires_at IS NULL`,
        [changes.plan, changes.plan_started_at, changes.plan_expires_at, user.id]
    );
    if (!result || result.affectedRows !== 1) return null;
    const started = { ...user, ...changes, trial_days_pending: null };
    sendPlanStartedEmail(started, { days: user.trial_days_pending });
    return started;
};

// A coupon entered inside the app (Upgrade screen, or the existing-users popup).
const redeemCoupon = async (userId, rawCode) => {
    const updated = await AppDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(User);
        // Locks the row so two redeem requests at once are applied one after the other.
        const user = await repo.createQueryBuilder('u')
            .setLock('pessimistic_write')
            .where('u.id = :id', { id: userId })
            .getOne();
        if (!user) throw new CouponError('Account not found.', 404);
        if (isAdminEmail(user.email)) throw new CouponError('Admin accounts do not need a coupon.');
        // Same code as requireActive, so the app shows its deactivated-account popup.
        if (user.deactivated_at) {
            throw new CouponError(
                'Your account has been deactivated, so a coupon cannot be applied. Please contact support.',
                403,
                'ACCOUNT_DEACTIVATED',
            );
        }

        const coupon = await claimCoupon(manager, rawCode, ['existing', 'expired', 'personal', 'all']);
        if (coupon.audience === 'personal' && coupon.user_id !== user.id) {
            throw new CouponError('This coupon code was made for another account.');
        }
        if (coupon.audience === 'existing' && (user.plan || user.trial_days_pending)) {
            throw new CouponError('This coupon code is only for accounts that have not had a trial yet.');
        }
        if (coupon.audience === 'expired' && subscriptionInfo(user).status !== 'expired') {
            throw new CouponError('This coupon code can be used once your current free trial or plan has ended.');
        }
        await recordRedemption(manager, coupon, user.id);
        const changes = extendedPlan(user, { plan: 'trial', days: coupon.trial_days });
        await repo.update({ id: user.id }, changes);
        return { user: { ...user, ...changes }, days: coupon.trial_days };
    });
    sendPlanStartedEmail(updated.user, { days: updated.days });
    return updated;
};

module.exports = {
    SUBSCRIPTION_COLUMNS, CouponError, normalizeCode, subscriptionInfo, claimCoupon, recordRedemption,
    extendedPlan, activatePendingTrial, redeemCoupon,
};
