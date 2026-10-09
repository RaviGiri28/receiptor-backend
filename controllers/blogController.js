const joi = require('joi');
const { In } = require('typeorm');
const { AppDataSource } = require('../config/db');
const BlogPost = require('../entity/BlogPost');
const NotificationRead = require('../entity/NotificationRead');
const { validate } = require('../middleware/validation');
const { uploadBlogImage, deleteImage } = require('../config/cloudinary');

const TAGS = ['feature', 'update', 'fix', 'announcement', 'guide'];
const VISIBILITIES = ['public', 'users', 'both'];
// Which visibilities each audience can see in listings.
const AUDIENCE = {
    public: ['public', 'both'],
    users: ['users', 'both'],
};

const repo = () => AppDataSource.getRepository(BlogPost);

const uploadErrorResponse = (res, err) => {
    if (err.cause) console.error('Cloudinary upload error:', err.cause.message || err.cause);
    return res.status(err.status || 502).json({ message: err.message });
};

const slugify = (title) => title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'post';

// Appends -2, -3, ... until the slug is free (ignoring the post itself on update).
const uniqueSlug = async (title, ignoreId) => {
    const base = slugify(title);
    for (let n = 1; ; n++) {
        const slug = n === 1 ? base : `${base}-${n}`;
        const existing = await repo().findOne({ where: { slug }, select: ['id'] });
        if (!existing || existing.id === ignoreId) return slug;
    }
};

// Shape sent to clients; content only on single-post responses.
const toJson = (post, { withContent = false, admin = false } = {}) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    tag: post.tag,
    cover_image: post.cover_image,
    published_at: post.published_at,
    updated_at: post.updated_at,
    author_name: post.author ? post.author.name : null,
    ...(withContent && { content: post.content }),
    ...(admin && { visibility: post.visibility, status: post.status, created_at: post.created_at }),
});

const listQuerySchema = joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(50).default(12),
    tag: joi.string().valid(...TAGS),
});

const listFor = (audience) => async (req, res, next) => {
    try {
        const { error, value } = validate(listQuerySchema, req.query);
        if (error) return res.status(400).json({ message: error });
        const where = { status: 'published', visibility: In(AUDIENCE[audience]) };
        if (value.tag) where.tag = value.tag;
        const [posts, total] = await repo().findAndCount({
            where,
            relations: { author: true },
            order: { published_at: 'DESC', id: 'DESC' },
            skip: (value.page - 1) * value.limit,
            take: value.limit,
        });
        return res.json({
            posts: posts.map((p) => toJson(p)),
            pagination: { total, page: value.page, totalPages: Math.max(1, Math.ceil(total / value.limit)) },
        });
    } catch (err) {
        next(err);
    }
};

// Logged-in users can open any published post (public ones are public anyway);
// visitors only public/both.
const getFor = (audience) => async (req, res, next) => {
    try {
        const where = { slug: String(req.params.slug), status: 'published' };
        if (audience === 'public') where.visibility = In(AUDIENCE.public);
        const post = await repo().findOne({ where, relations: { author: true } });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        return res.json({ post: toJson(post, { withContent: true }) });
    } catch (err) {
        next(err);
    }
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// Multipart form fields arrive as strings; Joi converts "true"/"false".
const postSchema = joi.object({
    title: joi.string().trim().min(3).max(200).required().label('Title'),
    summary: joi.string().trim().min(10).max(300).required().label('Summary'),
    content: joi.string().trim().min(1).max(200000).required().label('Content'),
    tag: joi.string().valid(...TAGS).default('update').label('Tag'),
    visibility: joi.string().valid(...VISIBILITIES).default('both').label('Visibility'),
    status: joi.string().valid('draft', 'published').default('draft').label('Status'),
    remove_cover: joi.boolean().default(false).label('Remove cover'),
});

const adminList = async (req, res, next) => {
    try {
        const posts = await repo().find({
            relations: { author: true },
            order: { updated_at: 'DESC' },
        });
        return res.json({ posts: posts.map((p) => toJson(p, { admin: true })) });
    } catch (err) {
        next(err);
    }
};

const adminGet = async (req, res, next) => {
    try {
        const post = await repo().findOne({ where: { id: Number(req.params.id) || 0 }, relations: { author: true } });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        return res.json({ post: toJson(post, { withContent: true, admin: true }) });
    } catch (err) {
        next(err);
    }
};

const savePost = async (req, res, next, existing) => {
    let cover = null;
    try {
        const { error, value } = validate(postSchema, req.body);
        if (error) return res.status(400).json({ message: error });
        const { remove_cover, ...fields } = value;

        if (req.file) {
            try {
                cover = await uploadBlogImage(req.file.buffer);
            } catch (uploadErr) {
                return uploadErrorResponse(res, uploadErr);
            }
        }

        const post = existing || repo().create({ author_id: req.user.id });
        const oldCoverId = post.cover_image_public_id;
        // The URL follows the title until first published, then stays fixed so shared links keep working.
        if (!existing || (!post.published_at && post.title !== fields.title)) {
            post.slug = await uniqueSlug(fields.title, post.id);
        }
        Object.assign(post, fields);
        // First publish sets the date users are notified about; re-publishing keeps it.
        if (fields.status === 'published' && !post.published_at) post.published_at = new Date();
        if (cover) {
            post.cover_image = cover.url;
            post.cover_image_public_id = cover.publicId;
        } else if (remove_cover) {
            post.cover_image = null;
            post.cover_image_public_id = null;
        }

        let saved;
        try {
            saved = await repo().save(post);
        } catch (saveErr) {
            if (cover) await deleteImage(cover.publicId);
            throw saveErr;
        }
        if (oldCoverId && oldCoverId !== saved.cover_image_public_id) await deleteImage(oldCoverId);

        const full = await repo().findOne({ where: { id: saved.id }, relations: { author: true } });
        return res.status(existing ? 200 : 201).json({ post: toJson(full, { withContent: true, admin: true }) });
    } catch (err) {
        next(err);
    }
};

const adminCreate = (req, res, next) => savePost(req, res, next, null);

const adminUpdate = async (req, res, next) => {
    try {
        const post = await repo().findOne({ where: { id: Number(req.params.id) || 0 } });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        return savePost(req, res, next, post);
    } catch (err) {
        next(err);
    }
};

const adminDelete = async (req, res, next) => {
    try {
        const post = await repo().findOne({ where: { id: Number(req.params.id) || 0 } });
        if (!post) return res.status(404).json({ message: 'Post not found' });
        await repo().remove(post);
        await AppDataSource.getRepository(NotificationRead).delete({ item_type: 'blog', item_id: post.id });
        await deleteImage(post.cover_image_public_id);
        return res.json({ message: 'Post deleted' });
    } catch (err) {
        next(err);
    }
};

// Images placed inside a post's body (inserted as Markdown by the editor).
const adminUploadImage = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' });
    try {
        const image = await uploadBlogImage(req.file.buffer);
        return res.status(201).json({ url: image.url });
    } catch (uploadErr) {
        return uploadErrorResponse(res, uploadErr);
    }
};

module.exports = {
    listPublic: listFor('public'),
    listForUsers: listFor('users'),
    getPublic: getFor('public'),
    getForUsers: getFor('users'),
    adminList,
    adminGet,
    adminCreate,
    adminUpdate,
    adminDelete,
    adminUploadImage,
    AUDIENCE,
};
