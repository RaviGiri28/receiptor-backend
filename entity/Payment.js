const { EntitySchema } = require('typeorm');

// One row per Razorpay order. amount is in paise. user_id is NULL once the account is erased.
const Payment = new EntitySchema({
    name: 'Payment',
    tableName: 'payments',
    columns: {
        id: { primary: true, type: 'int', generated: true },
        user_id: { type: 'int', nullable: true },
        plan_id: { type: 'varchar', length: 20 },
        amount: { type: 'int' },
        razorpay_order_id: { type: 'varchar', length: 40, unique: true },
        razorpay_payment_id: { type: 'varchar', length: 40, nullable: true },
        status: { type: 'varchar', length: 10, default: 'created' },
        paid_at: { type: 'timestamp', nullable: true },
        created_at: { type: 'timestamp', createDate: true },
    },
});

module.exports = Payment;