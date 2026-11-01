// Runs after protect. Creating or editing receipts needs an active trial or paid plan;
// without one the account can still log in, view and download its receipts.
const requireSubscription = (req, res, next) => {
    const subscription = req.user && req.user.subscription;
    if (subscription && !subscription.can_create) {
        return res.status(402).json({
            code: 'SUBSCRIPTION_REQUIRED',
            subscription_status: subscription.status,
            message: subscription.status === 'none'
                ? 'Start your free trial with a coupon code, or choose a plan, to create receipts.'
                : 'Your free trial or plan has ended. Please upgrade to keep creating receipts.',
        });
    }
    next();
};

module.exports = requireSubscription;
