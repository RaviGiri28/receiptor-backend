const joi = require('joi');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const Coupon = require('../entity/Coupon');
const { validate } = require('../middleware/validation');
const { DEFAULT_TRIAL_DAYS } = require('../config/plans');
const { getPlans, findPlan } = require('../services/plans');
const { CouponError, subscriptionInfo, redeemCoupon, SUBSCRIPTION_COLUMNS } = require('../services/subscription');
const { createOrder, isValidSignature, activatePayment } = require('../services/payment');

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
            plans: await getPlans(),
            offer: subscription.status === 'none' ? await existingUsersOffer() : null,
        });
    } catch (err) {
        next(err);
    }
};

// GET /api/subscription/plans: public, for the pricing section of the landing page.
const publicPlans = async (req, res, next) => {
    try {
        return res.json({ plans: await getPlans(), trial_days: DEFAULT_TRIAL_DAYS });
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

const orderSchema = joi.object({
    plan_id: joi.string().max(20).required().label('Plan'),
});

// POST /api/subscription/order { plan_id }: starts a Razorpay payment for a plan.
const order = async (req, res) => {
    const { error, value } = validate(orderSchema, req.body);
    if (error) return res.status(400).json({ message: error });
    try {
        const plan = await findPlan(value.plan_id);
        if (!plan) return res.status(400).json({ message: 'Unknown plan.' });
        return res.json(await createOrder(req.user.id, plan));
    } catch (err) {
        console.error('Razorpay order failed:', err);
        return res.status(502).json({ message: 'Could not start the payment. Please try again.' });
    }
};

const verifySchema = joi.object({
    razorpay_order_id: joi.string().max(40).required(),
    razorpay_payment_id: joi.string().max(40).required(),
    razorpay_signature: joi.string().max(128).required(),
});

// POST /api/subscription/verify: checks Razorpay's signature, then activates the plan.
const verify = async (req, res, next) => {
    try {
        const { error, value } = validate(verifySchema, req.body);
        if (error) return res.status(400).json({ message: error });
        const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = value;
        if (!isValidSignature(orderId, paymentId, signature)) {
            return res.status(400).json({ message: 'Payment could not be verified.' });
        }
        const result = await activatePayment(req.user.id, orderId, paymentId);
        if (!result) return res.status(404).json({ message: 'Order not found.' });
        return res.json({ message: 'Payment successful.', subscription: subscriptionInfo(result.user) });
    } catch (err) {
        next(err);
    }
};

module.exports = { getMine, publicPlans, redeem, order, verify };
