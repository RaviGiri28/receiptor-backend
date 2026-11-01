const { EntitySchema } = require('typeorm');

// One row per coupon use: a user can use each coupon only once.
const CouponRedemption = new EntitySchema({
    name: 'CouponRedemption',
    tableName: 'coupon_redemptions',

    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        coupon_id: {
            type: 'int',
            nullable: false,
        },
        user_id: {
            type: 'int',
            nullable: false,
        },
        trial_days: {
            type: 'int',
            nullable: false,
        },
        created_at: {
            type: 'timestamp',
            createDate: true,
        },
    },

    uniques: [
        { name: 'UQ_coupon_redemption', columns: ['coupon_id', 'user_id'] },
    ],

    relations: {
        coupon: {
            type: 'many-to-one',
            target: 'Coupon',
            joinColumn: { name: 'coupon_id' },
            onDelete: 'CASCADE',
        },
        user: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'user_id' },
            onDelete: 'CASCADE',
        },
    },
});

module.exports = CouponRedemption;
