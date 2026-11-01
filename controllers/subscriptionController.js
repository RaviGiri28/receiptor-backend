const joi = require('joi');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const Coupon = require('../entity/Coupon');
const { validate } = require('../middleware/validation');
const { PLANS } = require('../config/plans');
const { CouponError, subscriptionInfo, redeemCoupon, SUBSCRIPTION_COLUMNS } = require('../services/subscription');

// The coupon shown in the popup for accounts that never had a plan: the newest active,
// unexpired "existing users" coupon with uses left.
const existingUsersOffer = async () => {
    const coupon = await AppDataSource.getRepository(Coupon).createQueryBuilder('c')
        .where('c.audience = :audience', { audience: 'existing' })
        .andWhere('c.is_active = 1')
        .andWhere('(c.expires_at IS NULL OR c.expires_at > :now)', { now: new Date() })
        .andWhere('(c.max_uses IS NULL OR c.used_count < c.max_uses)')
        .orderBy('c.created_at', 'DESC')
        .getOne();
    return coupon ? { code: coupon.code, trial_days: coupon.trial_days } : null;
};

// GET /api/subscription: the user's plan, the plans on sale, and (for accounts that never
// had a plan) the coupon offered to them.
const getMine = async (req, res, next) => {
    try {
        const user = await AppDataSource.getRepository(User).findOne({
            where: { id: req.user.id },
            select: ['id', 'email', ...SUBSCRIPTION_COLUMNS],
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        const subscription = subscriptionInfo(user);
        return res.json({
            subscription,
            plans: PLANS,
            offer: subscription.status === 'none' ? await existingUsersOffer() : null,
        });
    } catch (err) {
        next(err);
    }
};

const redeemSchema = joi.object({
    code: joi.string().trim().min(3).max(30).required().label('Coupon code'),
});

// POST /api/subscription/redeem { code }
const redeem = async (req, res, next) => {
    try {
        const { error, value } = validate(redeemSchema, req.body);
        if (error) return res.status(400).json({ message: error });
        const { user, days } = await redeemCoupon(req.user.id, value.code);
        return res.json({
            message: `Coupon applied: ${days} days added.`,
            subscription: subscriptionInfo(user),
        });
    } catch (err) {
        if (err instanceof CouponError) return res.status(err.status).json({ code: err.code, message: err.message });
        next(err);
    }
};

module.exports = { getMine, redeem };
