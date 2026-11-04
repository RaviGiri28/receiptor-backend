// Subscription plans and the free trial. Prices are in rupees, GST inclusive.
// The frontend shows whatever this file returns (GET /api/subscription), so a price
// change only needs an edit here.

const PLANS = [
    { id: 'monthly', name: 'Monthly', price: 1, days: 30, months: 1 }, // TEMPORARY live payment test: restore to 249
    { id: 'quarterly', name: '3 Months', price: 699, days: 90, months: 3 },
    { id: 'yearly', name: 'Yearly', price: 2299, days: 365, months: 12, best_value: true },
];

// Trial for a signup without a coupon code.
const DEFAULT_TRIAL_DAYS = 7;

// The "trial ends soon" email goes out this long before the plan expires.
const EXPIRY_REMINDER_HOURS = 24;

const findPlan = (id) => PLANS.find((p) => p.id === id) || null;

module.exports = { PLANS, DEFAULT_TRIAL_DAYS, EXPIRY_REMINDER_HOURS, findPlan };
