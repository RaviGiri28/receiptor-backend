const { EntitySchema } = require('typeorm');

// Short messages shown on every user's dashboard (and in notifications).
// type: 'info' | 'update' | 'warning'. Hidden after expires_at, if set.
const Announcement = new EntitySchema({
    name: 'Announcement',
    tableName: 'announcements',

    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        title: {
            type: 'varchar',
            length: 150,
            nullable: false,
        },
        message: {
            type: 'text',
            nullable: false,
        },
        type: {
            type: 'varchar',
            length: 10,
            default: 'info',
        },
        link_url: {
            type: 'varchar',
            length: 500,
            nullable: true,
        },
        link_label: {
            type: 'varchar',
            length: 50,
            nullable: true,
        },
        pinned: {
            type: 'boolean',
            default: false,
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
        expires_at: {
            type: 'timestamp',
            nullable: true,
            default: null,
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
});

module.exports = Announcement;
