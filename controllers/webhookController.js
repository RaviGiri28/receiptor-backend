const { isValidWebhookSignature, activateFromWebhook } = require('../services/payment');

// POST /api/webhooks/razorpay: Razorpay's server reports a payment, so the plan activates even
// if the customer's browser never reached /api/subscription/verify. req.body is the raw Buffer.
// Razorpay retries on any non-2xx reply, so only reply with an error when a retry could help.
const razorpayWebhook = async (req, res) => {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
        console.error('RAZORPAY_WEBHOOK_SECRET is not set: webhook refused.');
        return res.status(503).json({ message: 'Webhook is not configured.' });
    }
    if (!Buffer.isBuffer(req.body) || !isValidWebhookSignature(req.body, req.get('X-Razorpay-Signature'))) {
        return res.status(400).json({ message: 'Invalid signature.' });
    }

    let event;
    try {
        event = JSON.parse(req.body.toString('utf8'));
    } catch {
        return res.status(400).json({ message: 'Invalid body.' });
    }
    if (event.event !== 'payment.captured') return res.json({ status: 'ignored' });

    const payment = event.payload && event.payload.payment && event.payload.payment.entity;
    if (!payment || !payment.id || !payment.order_id) return res.json({ status: 'ignored' });

    try {
        const result = await activateFromWebhook(payment.order_id, payment.id);
        if (!result) {
            // Not an order from this app, so a retry would not help.
            console.warn(`Razorpay webhook: unknown order ${payment.order_id} (payment ${payment.id}).`);
            return res.json({ status: 'unknown_order' });
        }
        return res.json({ status: 'ok' });
    } catch (err) {
        console.error('Razorpay webhook failed:', err);
        return res.status(500).json({ message: 'Could not activate the plan.' });
    }
};

module.exports = { razorpayWebhook };
