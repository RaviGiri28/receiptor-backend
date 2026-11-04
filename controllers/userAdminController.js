const joi = require('joi');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const { validate } = require('../middleware/validation');
const { isAdminEmail } = require('../config/admin');
const bcrypt = require('bcrypt');
const { getPlans, findPlan } = require('../services/plans');
const { sendPasswordResetByAdminEmail } = require('../services/passwordReset');
const { subscriptionInfo, extendedPlan } = require('../services/subscription');
const { sendPlanStartedEmail } = require('../services/subscriptionEmails');

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const listQuerySchema = joi.object({
    search: joi.string().trim().max(100).allow('').label('Search'),
    status: joi.string().valid('all', 'active', 'deactivated').default('all').label('Status'),
    plan: joi.string().valid('all', 'trial', 'paid', 'expired', 'none').default('all').label('Plan'),
    page: joi.number().integer().min(1).default(1).label('Page'),
    limit: joi.number().integer().min(1).max(100).default(20).label('Limit'),
});

const toJson = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone_number: u.phone_number,
    business_name: u.business_name,
    business_logo: u.business_logo,
    created_at: u.created_at,
    last_active_at: u.last_active_at,
    deactivated_at: u.deactivated_at,
    deletion_requested_at: u.deletion_requested_at,
    receipt_count: Number(u.receipt_count) || 0,
    is_admin: isAdminEmail(u.email),
    subscription: subscriptionInfo(u),
    // Signed up, but hasn't logged in yet: this many trial days start on the first login.
    trial_days_pending: u.trial_days_pending ?? null,
});

const USER_COLUMNS = `u.id, u.name, u.email, u.phone_number, u.business_name, u.business_logo, u.created_at,
                        u.last_active_at, u.deactivated_at, u.deletion_requested_at,
                        u.plan, u.plan_id, u.plan_started_at, u.plan_expires_at, u.trial_days_pending,
                        (SELECT COUNT(*) FROM receipts r WHERE r.user_id = u.id AND r.is_demo = 0) AS receipt_count`;

const fetchUser = async (id) => {
    const [row] = await AppDataSource.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, [id]);
    return row ? toJson(row) : null;
};

// GET /api/admin/users: every signed-up account, newest first, with receipt counts.
const list = async (req, res, next) => {
    try {
        const { error, value } = validate(listQuerySchema, req.query);
        if (error) return res.status(400).json({ message: error });
        const { search, status, plan, page, limit } = value;
        const now = new Date();

        const where = [];
        const params = [];
        if (search) {
            where.push('(u.name LIKE ? OR u.email LIKE ? OR u.business_name LIKE ? OR u.phone_number LIKE ?)');
            const like = `%${escapeLike(search)}%`;
            params.push(like, like, like, like);
        }
        if (status === 'active') where.push('u.deactivated_at IS NULL');
        if (status === 'deactivated') where.push('u.deactivated_at IS NOT NULL');
        if (plan === 'trial' || plan === 'paid') {
            where.push('u.plan = ? AND u.plan_expires_at > ?');
            params.push(plan, now);
        }
        if (plan === 'expired') {
            where.push('u.plan IS NOT NULL AND u.plan_expires_at <= ?');
            params.push(now);
        }
        if (plan === 'none') where.push('u.plan_expires_at IS NULL');
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [rows, [{ total }], [stats]] = await Promise.all([
            AppDataSource.query(
                `SELECT ${USER_COLUMNS}
                 FROM users u ${whereSql}
                 ORDER BY u.created_at DESC, u.id DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, (page - 1) * limit]
            ),
            AppDataSource.query(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params),
            AppDataSource.query(
                `SELECT COUNT(*) AS total,
                        SUM(deactivated_at IS NOT NULL) AS deactivated,
                        SUM(created_at >= ?) AS new_this_week,
                        SUM(plan = 'trial' AND plan_expires_at > ?) AS on_trial,
                        SUM(plan = 'paid' AND plan_expires_at > ?) AS paid,
                        SUM(plan IS NOT NULL AND plan_expires_at <= ?) AS expired
                 FROM users`,
                [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), now, now, now]
            ),
        ]);

        const totalCount = Number(total) || 0;
        return res.json({
            users: rows.map(toJson),
            pagination: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
            stats: {
                total: Number(stats.total) || 0,
                deactivated: Number(stats.deactivated) || 0,
                active: (Number(stats.total) || 0) - (Number(stats.deactivated) || 0),
                new_this_week: Number(stats.new_this_week) || 0,
                on_trial: Number(stats.on_trial) || 0,
                paid: Number(stats.paid) || 0,
                expired: Number(stats.expired) || 0,
            },
            plans: await getPlans(),
        });
    } catch (err) {
        next(err);
    }
};

const statusSchema = joi.object({
    deactivated: joi.boolean().required().label('Deactivated'),
});

// PUT /api/admin/users/:id/status { deactivated }: ban or un-ban an account.
const setStatus = async (req, res, next) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid user id' });
        const { error, value } = validate(statusSchema, req.body);
        if (error) return res.status(400).json({ message: error });

        const repo = AppDataSource.getRepository(User);
        const user = await repo.findOne({
            where: { id },
            select: ['id', 'email', 'deactivated_at'],
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (value.deactivated && (user.id === req.user.id || isAdminEmail(user.email))) {
            return res.status(400).json({ message: 'Admin accounts cannot be deactivated.' });
        }

        const isDeactivated = !!user.deactivated_at;
        if (value.deactivated !== isDeactivated) {
            await repo.update({ id }, value.deactivated
                ? { deactivated_at: new Date() }
                : { deactivated_at: null, reactivated_at: new Date() });
        }
        return res.json({
            message: value.deactivated ? 'Account deactivated' : 'Account reactivated',
            user: await fetchUser(id),
        });
    } catch (err) {
        next(err);
    }
};

const planSchema = joi.object({
    // grant_paid: a paid plan (e.g. paid by cash or UPI directly), added to any time left.
    // add_trial: extra free days. expire: ends the current trial or plan now.
    action: joi.string().valid('grant_paid', 'add_trial', 'expire').required().label('Action'),
    plan_id: joi.when('action', {
        is: 'grant_paid',
        then: joi.string().max(20).required(),
        otherwise: joi.forbidden(),
    }).label('Plan'),
    days: joi.when('action', {
        is: 'add_trial',
        then: joi.number().integer().min(1).max(365).required(),
        otherwise: joi.forbidden(),
    }).label('Days'),
});

// PUT /api/admin/users/:id/plan { action, plan_id?, days? }
const setPlan = async (req, res, next) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid user id' });
        const { error, value } = validate(planSchema, req.body);
        if (error) return res.status(400).json({ message: error });

        const repo = AppDataSource.getRepository(User);
        const user = await repo.findOne({ where: { id } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        let changes;
        let days = null;
        if (value.action === 'expire') {
            if (!user.plan) return res.status(400).json({ message: 'This account has no trial or plan to end.' });
            changes = { plan_expires_at: new Date(), trial_days_pending: null };
        } else {
            const plan = value.action === 'grant_paid' ? await findPlan(value.plan_id) : null;
            if (value.action === 'grant_paid' && !plan) return res.status(400).json({ message: 'Unknown plan.' });
            days = plan ? plan.days : value.days;
            changes = extendedPlan(user, { plan: plan ? 'paid' : 'trial', days, planId: plan && plan.id });
        }
        await repo.update({ id }, changes);
        if (days) sendPlanStartedEmail({ ...user, ...changes }, { days });

        const messages = {
            grant_paid: 'Paid plan activated',
            add_trial: `${days} trial days added`,
            expire: 'Plan ended',
        };
        return res.json({ message: messages[value.action], user: await fetchUser(id) });
    } catch (err) {
        next(err);
    }
};

const passwordSchema = joi.object({
    password: joi.string().min(6).max(72).required().label('New password'),
});

// PUT /api/admin/users/:id/password { password }: for a user who can't use the reset email.
// Signs the user out everywhere and tells them by email. The password itself is never emailed.
const resetPassword = async (req, res, next) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid user id' });
        const { error, value } = validate(passwordSchema, req.body);
        if (error) return res.status(400).json({ message: error });

        const repo = AppDataSource.getRepository(User);
        const user = await repo.findOne({ where: { id }, select: ['id', 'name', 'email', 'deletion_requested_at'] });
        if (!user) return res.status(404).json({ message: 'User not found' });
        // One admin must not be able to take over another admin's account.
        if (isAdminEmail(user.email)) {
            return res.status(400).json({ message: 'Admin passwords cannot be reset here.' });
        }
        if (user.deletion_requested_at) {
            return res.status(400).json({ message: 'This account has been deleted.' });
        }

        await repo.update({ id }, {
            password: await bcrypt.hash(value.password, 10),
            // Whole seconds, to match the JWT "iat" claim: signs out every existing session.
            password_changed_at: new Date(Math.floor(Date.now() / 1000) * 1000),
            password_reset_token_hash: null,
            password_reset_expires_at: null,
        });
        console.log(`Admin #${req.user.id} reset the password of user #${id}.`);
        res.json({ message: 'Password reset' });

        sendPasswordResetByAdminEmail(user)
            .catch((err) => console.error(`Password reset email to user #${id} failed:`, err.message || err));
    } catch (err) {
        next(err);
    }
};

module.exports = { list, setStatus, setPlan, resetPassword };
