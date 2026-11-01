const { EntitySchema } = require('typeorm');

// Coupon codes that give a free trial (see services/subscription.js).
const Coupon = new EntitySchema({
    name: 'Coupon',
    tableName: 'coupons',

    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        // Stored upper-case; what users type is upper-cased before lookup.
        code: {
            type: 'varchar',
            length: 30,
            unique: true,
            nullable: false,
        },
        trial_days: {
            type: 'int',
            nullable: false,
        },
        // 'signup': only on the signup form. 'existing': only inside the app, by accounts
        // made before subscriptions (shown to them in a popup). 'expired': only inside the
        // app, by accounts whose trial or plan has ended. 'personal': only inside the app,
        // by the one account in user_id (made from the admin Users page). 'all': anywhere, by anyone.
        audience: {
            type: 'varchar',
            length: 10,
            nullable: false,
            default: 'signup',
        },
        // NULL = unlimited.
        max_uses: {
            type: 'int',
            nullable: true,
            default: null,
        },
        used_count: {
            type: 'int',
            nullable: false,
            default: 0,
        },
        // NULL = never expires.
        expires_at: {
            type: 'timestamp',
            nullable: true,
            default: null,
        },
        is_active: {
            type: 'boolean',
            nullable: false,
            default: true,
        },
        // Personal coupons: the only account that can use it.
        user_id: {
            type: 'int',
            nullable: true,
            default: null,
        },
        // Admin's own note, e.g. who the code was given to.
        note: {
            type: 'varchar',
            length: 255,
            nullable: true,
            default: null,
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

module.exports = Coupon;
