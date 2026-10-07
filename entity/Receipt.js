const { EntitySchema } = require('typeorm');

const Receipt = new EntitySchema({
    name: 'Receipt',
    tableName: 'receipts',

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
        account_holder: {
            type: 'varchar',
            length: 150,
            nullable: false,
        },
        account_number: {
            type: 'varchar',
            length: 50,
            nullable: false,
        },
        ifsc_code: {
            type: 'varchar',
            length: 20,
            nullable: true,
        },
        amount: {
            type: 'decimal',
            precision: 10,
            scale: 2,
            nullable: false,
        },
        date: {
            type: 'date',
            nullable: false,
        },
        transaction_id: {
            type: 'varchar',
            length: 100,
            nullable: false,
        },
        reference_number: {
            type: 'varchar',
            length: 100,
            nullable: true,
        },
        status: {
            type: 'varchar',
            length: 50,
            default: 'Success',
        },
        bank_name: {
            type: 'varchar',
            length: 100,
            nullable: false,
        },
        customer_mobile: {
            type: 'varchar',
            length: 20,
            nullable: false,
        },
        notes: {
            type: 'text',
            nullable: true,
        },
        custom_fields: {
            type: 'json',
            nullable: true,
        },
        is_dual_print: {
            type: 'boolean',
            default: false,
        },
        serial_number: {
            type: 'int',
            nullable: true,
        },
        save_type: {
            type: 'varchar',
            length: 20,
            default: 'saved',
        },
        created_at: {
            type: 'timestamp',
            createDate: true,
        },
    },

    indices: [
        { name: 'IDX_receipt_user_serial', columns: ['user_id', 'serial_number'], unique: true },
        { name: 'IDX_receipt_user_date', columns: ['user_id', 'date'] },
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

module.exports = Receipt;