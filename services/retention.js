// Data retention, as promised in the Privacy Policy:
//  - a deleted account is erased DELETION_GRACE_DAYS after the user deleted it;
//  - an account unused for INACTIVITY_DAYS is erased, but only after a notice email
//    (INACTIVITY_NOTICE_DAYS before) and a reminder (INACTIVITY_REMINDER_DAYS before).
//    No notice sent (e.g. email not configured) = no deletion.
// Run by GET /api/internal/retention (a daily external scheduler, see routes/internalRoutes.js),
// shortly after every server start, and daily while the server runs.
const { IsNull, LessThanOrEqual } = require('typeorm');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const Receipt = require('../entity/Receipt');
const SupportTicket = require('../entity/SupportTicket');
const NotificationRead = require('../entity/NotificationRead');
const BlogPost = require('../entity/BlogPost');
const { deleteLogo } = require('../config/cloudinary');
const { canEmailUsers, sendUserEmail } = require('../config/mailer');
const {
    DAY_MS, DELETION_GRACE_DAYS, INACTIVITY_DAYS, INACTIVITY_NOTICE_DAYS, INACTIVITY_REMINDER_DAYS,
} = require('../config/legal');

const daysAgo = (days, now = Date.now()) => new Date(now - days * DAY_MS);

// Erases an account and everything it owns. Blog posts it wrote stay, without an author.
const eraseUser = async (user) => {
    await AppDataSource.transaction(async (manager) => {
        await manager.getRepository(Receipt).delete({ user_id: user.id });
        await manager.getRepository(SupportTicket).delete({ user_id: user.id });
        await manager.getRepository(NotificationRead).delete({ user_id: user.id });
        await manager.getRepository(BlogPost).update({ author_id: user.id }, { author_id: null });
        await manager.getRepository(User).delete({ id: user.id });
    });
    // After the commit: a failed image cleanup must not keep the account alive.
    if (user.business_logo_public_id) await deleteLogo(user.business_logo_public_id);
};

const formatDate = (date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const inactivityEmail = (user, deleteOn) => ({
    to: user.email,
    subject: `Your Quick Receipt account will be deleted on ${formatDate(deleteOn)}`,
    text: [
        `Hello ${user.name},`,
        '',
        `You have not used your Quick Receipt account (${user.email}) for almost ${Math.round(INACTIVITY_DAYS / 365)} years.`,
        `As explained in our Privacy Policy, unused accounts are deleted to protect your data.`,
        '',
        `Your account, business details and all saved receipts will be permanently deleted on ${formatDate(deleteOn)}.`,
        '',
        'To keep your account, simply log in before that date.',
        'If you no longer need it, you can download your receipts from the History page first, or do nothing.',
        '',
        '- Quick Receipt',
    ].join('\n'),
});

const lastActive = (user) => user.last_active_at || user.created_at;

async function processInactiveAccounts(now = Date.now()) {
    const repo = AppDataSource.getRepository(User);
    const result = { notices: 0, reminders: 0, erased: 0 };
    const candidates = await repo.find({
        where: { deletion_requested_at: IsNull(), last_active_at: LessThanOrEqual(daysAgo(INACTIVITY_DAYS - INACTIVITY_NOTICE_DAYS, now)) },
    });
    for (const user of candidates) {
        const inactiveSince = new Date(lastActive(user)).getTime();
        const due = inactiveSince + INACTIVITY_DAYS * DAY_MS;
        try {
            if (!user.inactivity_notice_at) {
                if (!canEmailUsers()) continue;
                // The user always gets the full notice period from the day the notice is sent.
                const deleteOn = new Date(Math.max(due, now + INACTIVITY_NOTICE_DAYS * DAY_MS));
                await sendUserEmail(inactivityEmail(user, deleteOn));
                await repo.update({ id: user.id }, { inactivity_notice_at: new Date(now) });
                result.notices++;
                continue;
            }
            const deleteOn = Math.max(due, new Date(user.inactivity_notice_at).getTime() + INACTIVITY_NOTICE_DAYS * DAY_MS);
            if (now >= deleteOn) {
                await eraseUser(user);
                result.erased++;
            } else if (!user.inactivity_reminder_at && now >= deleteOn - INACTIVITY_REMINDER_DAYS * DAY_MS && canEmailUsers()) {
                await sendUserEmail(inactivityEmail(user, new Date(deleteOn)));
                await repo.update({ id: user.id }, { inactivity_reminder_at: new Date(now) });
                result.reminders++;
            }
        } catch (err) {
            console.error(`Retention: inactive account ${user.id} failed:`, err.message || err);
        }
    }
    return result;
}

async function purgeDeletedAccounts(now = Date.now()) {
    const users = await AppDataSource.getRepository(User).find({
        where: { deletion_requested_at: LessThanOrEqual(daysAgo(DELETION_GRACE_DAYS, now)) },
    });
    let erased = 0;
    for (const user of users) {
        try {
            await eraseUser(user);
            erased++;
        } catch (err) {
            console.error(`Retention: erasing deleted account ${user.id} failed:`, err.message || err);
        }
    }
    return erased;
}

let running = null;
// Runs both rules; concurrent calls share one run.
function runRetention() {
    if (!running) {
        running = (async () => {
            const deleted = await purgeDeletedAccounts();
            const inactive = await processInactiveAccounts();
            const summary = { deletedAccountsErased: deleted, ...inactive };
            if (deleted || inactive.notices || inactive.reminders || inactive.erased) console.log('Retention run:', summary);
            return summary;
        })().finally(() => { running = null; });
    }
    return running;
}

module.exports = { runRetention, eraseUser, purgeDeletedAccounts, processInactiveAccounts };
