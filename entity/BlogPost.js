const { EntitySchema } = require('typeorm');

// Posts written by admins. visibility: 'public' (website only), 'users' (logged-in
// users only) or 'both'. published_at is set the first time a post is published and
// drives notifications; later edits don't notify again.
const BlogPost = new EntitySchema({
    name: 'BlogPost',
    tableName: 'blog_posts',

    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        title: {
            type: 'varchar',
            length: 200,
            nullable: false,
        },
        slug: {
            type: 'varchar',
            length: 220,
            unique: true,
            nullable: false,
        },
        summary: {
            type: 'varchar',
            length: 300,
            nullable: false,
        },
        // Markdown.
        content: {
            type: 'mediumtext',
            nullable: false,
        },
        tag: {
            type: 'varchar',
            length: 30,
            default: 'update',
        },
        cover_image: {
            type: 'varchar',
            length: 255,
            nullable: true,
        },
        cover_image_public_id: {
            type: 'varchar',
            length: 255,
            nullable: true,
        },
        visibility: {
            type: 'varchar',
            length: 10,
            default: 'both',
        },
        status: {
            type: 'varchar',
            length: 10,
            default: 'draft',
        },
        published_at: {
            type: 'timestamp',
            nullable: true,
            default: null,
        },
        author_id: {
            type: 'int',
            nullable: true,
        },
        created_at: {
            type: 'timestamp',
            createDate: true,
        },
        updated_at: {
            type: 'timestamp',
            updateDate: true,
        },
    },

    relations: {
        author: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'author_id' },
            onDelete: 'SET NULL',
        },
    },
});

module.exports = BlogPost;
