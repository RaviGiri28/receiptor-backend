const { EntitySchema } = require('typeorm');

// Messages from the Support page. Saved before emailing, so none are lost if email fails.
const SupportTicket = new EntitySchema({
    name: 'SupportTicket',
    tableName: 'support_tickets',

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
        name: {
            type: 'varchar',
            length: 100,
            nullable: false,
        },
        // Where replies go; may differ from the account email.
        email: {
            type: 'varchar',
            length: 100,
            nullable: false,
        },
        subject: {
            type: 'varchar',
            length: 150,
            nullable: false,
        },
        message: {
            type: 'text',
            nullable: false,
        },
        status: {
            type: 'varchar',
            length: 20,
            default: 'open',
        },
        email_sent: {
            type: 'boolean',
            default: false,
        },
        created_at: {
            type: 'timestamp',
            createDate: true,
        },
    },

    relations: {
        user: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'user_id' },
            onDelete: 'CASCADE',
        },
    },
});

module.exports = SupportTicket;
