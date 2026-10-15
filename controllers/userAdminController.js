const joi = require('joi');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const { validate } = require('../middleware/validation');
const { isAdminEmail } = require('../config/admin');

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const listQuerySchema = joi.object({
    search: joi.string().trim().max(100).allow('').label('Search'),
    status: joi.string().valid('all', 'active', 'deactivated').default('all').label('Status'),
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
});

// GET /api/admin/users: every signed-up account, newest first, with receipt counts.
const list = async (req, res, next) => {
    try {
        const { error, value } = validate(listQuerySchema, req.query);
        if (error) return res.status(400).json({ message: error });
        const { search, status, page, limit } = value;

        const where = [];
        const params = [];
        if (search) {
            where.push('(u.name LIKE ? OR u.email LIKE ? OR u.business_name LIKE ? OR u.phone_number LIKE ?)');
            const like = `%${escapeLike(search)}%`;
            params.push(like, like, like, like);
        }
        if (status === 'active') where.push('u.deactivated_at IS NULL');
        if (status === 'deactivated') where.push('u.deactivated_at IS NOT NULL');
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [rows, [{ total }], [stats]] = await Promise.all([
            AppDataSource.query(
                `SELECT u.id, u.name, u.email, u.phone_number, u.business_name, u.business_logo, u.created_at,
                        u.last_active_at, u.deactivated_at, u.deletion_requested_at,
                        (SELECT COUNT(*) FROM receipts r WHERE r.user_id = u.id AND r.is_demo = 0) AS receipt_count
                 FROM users u ${whereSql}
                 ORDER BY u.created_at DESC, u.id DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, (page - 1) * limit]
            ),
            AppDataSource.query(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params),
            AppDataSource.query(
                `SELECT COUNT(*) AS total,
                        SUM(deactivated_at IS NOT NULL) AS deactivated,
                        SUM(created_at >= ?) AS new_this_week
                 FROM users`,
                [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
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
            },
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
        const [updated] = await AppDataSource.query(
            `SELECT u.id, u.name, u.email, u.phone_number, u.business_name, u.business_logo, u.created_at,
                    u.last_active_at, u.deactivated_at, u.deletion_requested_at,
                    (SELECT COUNT(*) FROM receipts r WHERE r.user_id = u.id AND r.is_demo = 0) AS receipt_count
             FROM users u WHERE u.id = ?`,
            [id]
        );
        return res.json({
            message: value.deactivated ? 'Account deactivated' : 'Account reactivated',
            user: toJson(updated),
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { list, setStatus };
