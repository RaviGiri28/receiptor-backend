// Emails "your trial / plan ends in 24 hours" once per plan period. Run every hour while
// the server is up, and by GET /api/internal/subscription-reminders (an hourly external
// scheduler, for hosts that sleep when idle).
const { AppDataSource } = require('../config/db');
const { canEmailUsers, sendUserEmail } = require('../config/mailer');
const { EXPIRY_REMINDER_HOURS } = require('../config/plans');
const { buildExpiryReminderEmail } = require('./subscriptionEmails');
const { getPlans } = require('./plans');

const HOUR_MS = 60 * 60 * 1000;

async function sendExpiryReminders(now = Date.now()) {
    if (!canEmailUsers()) return { sent: 0 };
    const window = EXPIRY_REMINDER_HOURS * HOUR_MS;
    // Ending within the window, not reminded for this expiry yet, and the period was longer
    // than the window (a 1-day trial doesn't get a reminder the moment it starts).
    const users = await AppDataSource.query(
        `SELECT id, name, email, plan, plan_started_at, plan_expires_at FROM users
         WHERE plan_expires_at > ? AND plan_expires_at <= ?
           AND (expiry_reminder_for IS NULL OR expiry_reminder_for <> plan_expires_at)
           AND plan_started_at <= ?
           AND deletion_requested_at IS NULL`,
        [new Date(now), new Date(now + window), new Date(now - window)]
    );
    const monthly = users.length ? (await getPlans()).find((p) => p.months === 1) : null;
    let sent = 0;
    for (const user of users) {
        // Marked first: a crash mid-send must not email the same person every hour.
        await AppDataSource.query('UPDATE users SET expiry_reminder_for = plan_expires_at WHERE id = ?', [user.id]);
        try {
            await sendUserEmail({ to: user.email, ...buildExpiryReminderEmail(user, monthly && monthly.price) });
            sent++;
        } catch (err) {
            console.error(`Expiry reminder to user #${user.id} failed:`, err.message || err);
            // Try again on the next run.
            await AppDataSource.query('UPDATE users SET expiry_reminder_for = NULL WHERE id = ?', [user.id])
                .catch(() => {});
        }
    }
    return { sent };
}

let running = null;
// Concurrent calls share one run.
function runExpiryReminders() {
    if (!running) {
        running = sendExpiryReminders()
            .then((result) => {
                if (result.sent) console.log('Expiry reminders sent:', result.sent);
                return result;
            })
            .finally(() => { running = null; });
    }
    return running;
}

module.exports = { runExpiryReminders, sendExpiryReminders };
