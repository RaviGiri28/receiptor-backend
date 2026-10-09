const joi = require('joi');
const { AppDataSource } = require('../config/db');
const Announcement = require('../entity/Announcement');
const NotificationRead = require('../entity/NotificationRead');
const { validate } = require('../middleware/validation');

const TYPES = ['info', 'update', 'warning'];

const repo = () => AppDataSource.getRepository(Announcement);

// Published, already live and not expired.
const activeQuery = () => repo().createQueryBuilder('a')
    .where('a.status = :status', { status: 'published' })
    .andWhere('a.published_at IS NOT NULL')
    .andWhere('(a.expires_at IS NULL OR a.expires_at > :now)', { now: new Date() });

const toJson = (a, { admin = false } = {}) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    type: a.type,
    link_url: a.link_url,
    link_label: a.link_label,
    pinned: !!a.pinned,
    published_at: a.published_at,
    expires_at: a.expires_at,
    ...(admin && { status: a.status, created_at: a.created_at, updated_at: a.updated_at }),
});

const listActive = async (req, res, next) => {
    try {
        const announcements = await activeQuery()
            .orderBy('a.pinned', 'DESC')
            .addOrderBy('a.published_at', 'DESC')
            .take(10)
            .getMany();
        return res.json({ announcements: announcements.map((a) => toJson(a)) });
    } catch (err) {
        next(err);
    }
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const announcementSchema = joi.object({
    title: joi.string().trim().min(3).max(150).required().label('Title'),
    message: joi.string().trim().min(1).max(1000).required().label('Message'),
    type: joi.string().valid(...TYPES).default('info').label('Type'),
    link_url: joi.string().trim().uri({ scheme: ['http', 'https'], allowRelative: true }).max(500)
        .allow('', null).default(null).label('Link URL'),
    link_label: joi.string().trim().max(50).allow('', null).default(null).label('Link label'),
    pinned: joi.boolean().default(false).label('Pinned'),
    status: joi.string().valid('draft', 'published').default('draft').label('Status'),
    expires_at: joi.date().iso().allow(null, '').default(null).label('Expiry date'),
});

const adminList = async (req, res, next) => {
    try {
        const announcements = await repo().find({ order: { updated_at: 'DESC' } });
        return res.json({ announcements: announcements.map((a) => toJson(a, { admin: true })) });
    } catch (err) {
        next(err);
    }
};

const save = async (req, res, next, existing) => {
    try {
        const { error, value } = validate(announcementSchema, req.body);
        if (error) return res.status(400).json({ message: error });
        const announcement = existing || repo().create();
        Object.assign(announcement, {
            ...value,
            link_url: value.link_url || null,
            link_label: value.link_url ? value.link_label || null : null,
            expires_at: value.expires_at || null,
        });
        if (value.status === 'published' && !announcement.published_at) announcement.published_at = new Date();
        const saved = await repo().save(announcement);
        return res.status(existing ? 200 : 201).json({ announcement: toJson(saved, { admin: true }) });
    } catch (err) {
        next(err);
    }
};

const adminCreate = (req, res, next) => save(req, res, next, null);

const adminUpdate = async (req, res, next) => {
    try {
        const announcement = await repo().findOne({ where: { id: Number(req.params.id) || 0 } });
        if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
        return save(req, res, next, announcement);
    } catch (err) {
        next(err);
    }
};

const adminDelete = async (req, res, next) => {
    try {
        const result = await repo().delete({ id: Number(req.params.id) || 0 });
        if (!result.affected) return res.status(404).json({ message: 'Announcement not found' });
        await AppDataSource.getRepository(NotificationRead).delete({ item_type: 'announcement', item_id: Number(req.params.id) });
        return res.json({ message: 'Announcement deleted' });
    } catch (err) {
        next(err);
    }
};

module.exports = { listActive, adminList, adminCreate, adminUpdate, adminDelete, activeQuery };
