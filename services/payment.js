// One-time plan purchases through Razorpay Orders (plans do not auto-renew).
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const Payment = require('../entity/Payment');
const { findPlan } = require('../config/plans');
const { extendedPlan } = require('./subscription');
const { sendPaymentSuccessEmail } = require('./subscriptionEmails');

// Created on first use, because the constructor throws when the keys are missing.
let client;
const razorpay = () => {
    if (!client) {
        client = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return client;
};

const createOrder = async (userId, plan) => {
    const amount = plan.price * 100; // The price always comes from the server, in paise.
    const order = await razorpay().orders.create({
        amount,
        currency: 'INR',
        receipt: `u${userId}_${Date.now()}`,
        notes: { user_id: String(userId), plan_id: plan.id },
    });
    await AppDataSource.getRepository(Payment).insert({
        user_id: userId, plan_id: plan.id, amount, razorpay_order_id: order.id,
    });
    return { key_id: process.env.RAZORPAY_KEY_ID, order_id: order.id, amount, currency: 'INR' };
};

const signatureMatches = (secret, data, signature) => {
    const a = Buffer.from(crypto.createHmac('sha256', secret).update(data).digest('hex'));
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const isValidSignature = (orderId, paymentId, signature) =>
    signatureMatches(process.env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`, signature);

const isValidWebhookSignature = (rawBody, signature) =>
    signatureMatches(process.env.RAZORPAY_WEBHOOK_SECRET, rawBody, signature);

// Safe to call twice for one order: the plan is only extended the first time.
const activatePayment = async (userId, orderId, paymentId) => {
    const result = await AppDataSource.transaction(async (manager) => {
        const payments = manager.getRepository(Payment);
        const payment = await payments.createQueryBuilder('p')
            .setLock('pessimistic_write')
            .where('p.razorpay_order_id = :orderId AND p.user_id = :userId', { orderId, userId })
            .getOne();
        if (!payment) return null;

        const users = manager.getRepository(User);
        const user = await users.createQueryBuilder('u')
            .setLock('pessimistic_write')
            .where('u.id = :id', { id: userId })
            .getOne();
        if (payment.status === 'paid') return { user, days: null, order: null };

        const plan = findPlan(payment.plan_id);
        const changes = extendedPlan(user, { plan: 'paid', days: plan.days, planId: plan.id });
        await users.update({ id: userId }, changes);
        const paidAt = new Date();
        await payments.update({ id: payment.id }, {
            status: 'paid', razorpay_payment_id: paymentId, paid_at: paidAt,
        });
        return {
            user: { ...user, ...changes },
            days: plan.days,
            order: { plan, amount: payment.amount, orderId, paymentId, paidAt },
        };
    });
    if (result && result.order) sendPaymentSuccessEmail(result.user, result.order);
    return result;
};

// A webhook has no logged-in user, so the order says whose payment it is.
const activateFromWebhook = async (orderId, paymentId) => {
    const payment = await AppDataSource.getRepository(Payment).findOne({ where: { razorpay_order_id: orderId } });
    return payment ? activatePayment(payment.user_id, orderId, paymentId) : null;
};

module.exports = { createOrder, isValidSignature, isValidWebhookSignature, activatePayment, activateFromWebhook };
