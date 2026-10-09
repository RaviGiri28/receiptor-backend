const joi = require('joi');
const { In } = require('typeorm');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const BlogPost = require('../entity/BlogPost');
const NotificationRead = require('../entity/NotificationRead');
const { validate } = require('../middleware/validation');
const { AUDIENCE } = require('./blogController');
const { activeQuery } = require('./announcementController');

// Notifications aren't stored per user: a user's notifications are the blog posts
// (for logged-in users) and live announcements published after their baseline, minus
// the ones they opened (notification_reads).
const LIST_LIMIT = 30;
// New accounts still see what was published in the month before they signed up.
const NEW_USER_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

const baselineFor = async (userId) => {
    const user = await AppDataSource.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'created_at', 'notifications_cleared_at'],
    });
    if (!user) return null;
    if (user.notifications_cleared_at) return user.notifications_cleared_at;
    return new Date(new Date(user.created_at).getTime() - NEW_USER_LOOKBACK_MS);
};

const list = async (req, res, next) => {
    try {
        const baseline = await baselineFor(req.user.id);
        if (!baseline) return res.status(404).json({ message: 'User not found' });

        const [posts, announcements] = await Promise.all([
            AppDataSource.getRepository(BlogPost).find({
                where: { status: 'published', visibility: In(AUDIENCE.users) },
                select: ['id', 'title', 'summary', 'slug', 'tag', 'published_at'],
                order: { published_at: 'DESC' },
                take: LIST_LIMIT,
            }),
            activeQuery().orderBy('a.published_at', 'DESC').take(LIST_LIMIT).getMany(),
        ]);

        const items = [
            ...posts.map((p) => ({
                type: 'blog', id: p.id, title: p.title, body: p.summary, slug: p.slug, tag: p.tag, published_at: p.published_at,
            })),
            ...announcements.map((a) => ({
                type: 'announcement', id: a.id, title: a.title, body: a.message, tag: a.type, published_at: a.published_at,
                link_url: a.link_url, link_label: a.link_label,
            })),
        ]
            .sort((x, y) => new Date(y.published_at) - new Date(x.published_at))
            .slice(0, LIST_LIMIT);

        const reads = items.length
            ? await AppDataSource.getRepository(NotificationRead).find({
                where: { user_id: req.user.id, item_id: In(items.map((i) => i.id)) },
                select: ['item_type', 'item_id'],
            })
            : [];
        const readKeys = new Set(reads.map((r) => `${r.item_type}:${r.item_id}`));

        return res.json({
            notifications: items.map((i) => ({
                ...i,
                read: new Date(i.published_at) <= baseline || readKeys.has(`${i.type}:${i.id}`),
            })),
        });
    } catch (err) {
        next(err);
    }
};

const unreadCount = async (req, res, next) => {
    try {
        const baseline = await baselineFor(req.user.id);
        if (!baseline) return res.status(404).json({ message: 'User not found' });
        const unread = (type) => `NOT EXISTS (SELECT 1 FROM notification_reads r
            WHERE r.user_id = ? AND r.item_type = '${type}' AND r.item_id = x.id)`;
        const [row] = await AppDataSource.query(
            `SELECT
                (SELECT COUNT(*) FROM blog_posts x
                    WHERE x.status = 'published' AND x.visibility IN ('users', 'both')
                    AND x.published_at > ? AND ${unread('blog')})
              + (SELECT COUNT(*) FROM announcements x
                    WHERE x.status = 'published' AND x.published_at > ?
                    AND (x.expires_at IS NULL OR x.expires_at > ?) AND ${unread('announcement')})
              AS count`,
            [baseline, req.user.id, baseline, new Date(), req.user.id]
        );
        return res.json({ count: Number(row.count) || 0 });
    } catch (err) {
        next(err);
    }
};

const markReadSchema = joi.object({
    type: joi.string().valid('blog', 'announcement').required().label('Type'),
    id: joi.number().integer().positive().required().label('ID'),
});

const markRead = async (req, res, next) => {
    try {
        const { error, value } = validate(markReadSchema, req.body);
        if (error) return res.status(400).json({ message: error });
        await AppDataSource.getRepository(NotificationRead).createQueryBuilder()
            .insert()
            .values({ user_id: req.user.id, item_type: value.type, item_id: value.id })
            // Already read: the row exists and nothing is inserted. updateEntity(false) stops
            // TypeORM from then trying to read back an id that was never generated.
            .orIgnore()
            .updateEntity(false)
            .execute();
        return res.json({ message: 'Marked as read' });
    } catch (err) {
        next(err);
    }
};

const markAllRead = async (req, res, next) => {
    try {
        await AppDataSource.getRepository(User).update({ id: req.user.id }, { notifications_cleared_at: new Date() });
        return res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        next(err);
    }
};

module.exports = { list, unreadCount, markRead, markAllRead };
