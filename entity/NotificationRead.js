const { EntitySchema } = require('typeorm');

// One row per item a user has opened. "Mark all read" moves users.notifications_cleared_at
// instead of inserting a row per item.
const NotificationRead = new EntitySchema({
    name: 'NotificationRead',
    tableName: 'notification_reads',

    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        user_id: {
            type: 'int',
            nullable: false,
        },
        // 'blog' | 'announcement'
        item_type: {
            type: 'varchar',
            length: 20,
            nullable: false,
        },
        item_id: {
            type: 'int',
            nullable: false,
        },
        read_at: {
            type: 'timestamp',
            createDate: true,
        },
    },

    uniques: [
        { name: 'UQ_notification_read', columns: ['user_id', 'item_type', 'item_id'] },
    ],

    relations: {
        user: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'user_id' },
            onDelete: 'CASCADE',
        },
    },
});

module.exports = NotificationRead;
