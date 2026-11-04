// The free trial, and the plans a new empty database starts with (scripts/init-db.js).
// Live prices are in the plans table: change them in Admin > Pricing Plans, not here.

const DEFAULT_PLANS = [
    { id: 'monthly', name: 'Monthly', price: 249, days: 30, months: 1 },
    { id: 'quarterly', name: '3 Months', price: 699, days: 90, months: 3 },
    { id: 'yearly', name: 'Yearly', price: 2299, days: 365, months: 12, best_value: true },
];

// Trial for a signup without a coupon code.
const DEFAULT_TRIAL_DAYS = 7;

// The "trial ends soon" email goes out this long before the plan expires.
const EXPIRY_REMINDER_HOURS = 24;

module.exports = { DEFAULT_PLANS, DEFAULT_TRIAL_DAYS, EXPIRY_REMINDER_HOURS };
