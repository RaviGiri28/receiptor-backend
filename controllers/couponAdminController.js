const joi = require('joi');
const { AppDataSource } = require('../config/db');
const Coupon = require('../entity/Coupon');
const { validate } = require('../middleware/validation');
const User = require('../entity/User');
const { normalizeCode } = require('../services/subscription');

const AUDIENCES = ['signup', 'existing', 'expired', 'personal', 'all'];

const repo = () => AppDataSource.getRepository(Coupon);

const toJson = (c) => ({
    id: c.id,
    code: c.code,
    trial_days: c.trial_days,
    audience: c.audience,
    max_uses: c.max_uses,
    used_count: c.used_count,
    expires_at: c.expires_at,
    is_active: !!c.is_active,
    note: c.note,
    created_at: c.created_at,
    // Personal coupons: the one account that can use it.
    user_id: c.user_id ?? null,
    user_name: c.user_name ?? null,
    user_email: c.user_email ?? null,
    // That account has used it.
    redeemed: Number(c.used_count) > 0,
    // Accounts that used it and later had a paid plan.
    converted_count: Number(c.converted_count) || 0,
});

const couponSchema = joi.object({
    code: joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{3,30}$/).required().label('Code')
        .messages({ 'string.pattern.base': 'Code must be 3-30 letters, numbers, - or _' }),
    trial_days: joi.number().integer().min(1).max(365).required().label('Trial days'),
    audience: joi.string().valid(...AUDIENCES).required().label('Who can use it'),
    max_uses: joi.number().integer().min(1).max(1000000).allow(null).default(null).label('Max uses'),
    expires_at: joi.date().iso().allow(null).default(null).label('Expiry date'),
    is_active: joi.boolean().default(true).label('Active'),
    note: joi.string().trim().max(255).allow('', null).default(null).label('Note'),
    // Personal coupons only, and only when creating; the account can't be changed later.
    user_id: joi.number().integer().min(1).allow(null).default(null).label('User'),
});

const listQuery = () => AppDataSource.query(
    `SELECT c.*, owner.name AS user_name, owner.email AS user_email,
            (SELECT COUNT(*) FROM coupon_redemptions r JOIN users u ON u.id = r.user_id
             WHERE r.coupon_id = c.id AND u.plan = 'paid') AS converted_count
     FROM coupons c LEFT JOIN users owner ON owner.id = c.user_id
     ORDER BY c.created_at DESC, c.id DESC`
);

// GET /api/admin/coupons
const list = async (req, res, next) => {
    try {
        return res.json({ coupons: (await listQuery()).map(toJson) });
    } catch (err) {
        next(err);
    }
};

const findJson = async (id) => (await listQuery()).map(toJson).find((c) => c.id === id);

const save = async (req, res, next, id) => {
    try {
        const { error, value } = validate(couponSchema, req.body);
        if (error) return res.status(400).json({ message: error });
        const { user_id: userId, ...rest } = value;
        const fields = { ...rest, code: normalizeCode(value.code), note: value.note || null };
        const isNew = !id;
        if (!isNew) {
            const existing = await repo().findOne({ where: { id } });
            if (!existing) return res.status(404).json({ message: 'Coupon not found' });
            // A personal coupon stays tied to its account; others can't become personal.
            if ((existing.audience === 'personal') !== (fields.audience === 'personal')) {
                return res.status(400).json({ message: 'A personal coupon stays personal. Create a new coupon instead.' });
            }
            if (fields.audience === 'personal') fields.max_uses = 1;
            await repo().update({ id }, fields);
        } else {
            if (fields.audience === 'personal') {
                if (!userId) return res.status(400).json({ message: 'Choose the account for this personal coupon.' });
                const owner = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['id'] });
                if (!owner) return res.status(404).json({ message: 'User not found' });
                // Each account uses a coupon once, so one use is all it needs.
                fields.user_id = userId;
                fields.max_uses = 1;
            } else if (userId) {
                return res.status(400).json({ message: 'Only personal coupons belong to one account.' });
            }
            id = (await repo().save(repo().create(fields))).id;
        }
        return res.status(isNew ? 201 : 200).json({ coupon: await findJson(id) });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A coupon with this code already exists.' });
        next(err);
    }
};

const parseId = (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ message: 'Invalid coupon id' });
        return null;
    }
    return id;
};

// POST /api/admin/coupons
const create = (req, res, next) => save(req, res, next, null);

// PUT /api/admin/coupons/:id
const update = (req, res, next) => {
    const id = parseId(req, res);
    if (id) return save(req, res, next, id);
};

// DELETE /api/admin/coupons/:id. Trials already given keep running.
const remove = async (req, res, next) => {
    try {
        const id = parseId(req, res);
        if (!id) return;
        const result = await repo().delete({ id });
        if (!result.affected) return res.status(404).json({ message: 'Coupon not found' });
        return res.json({ message: 'Coupon deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = { list, create, update, remove };
