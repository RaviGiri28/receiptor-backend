const { EntitySchema } = require('typeorm');

// The plans on sale. Admins edit name, price and days in Admin > Pricing Plans.
// price is in rupees, GST inclusive.
const Plan = new EntitySchema({
    name: 'Plan',
    tableName: 'plans',
    columns: {
        id: { primary: true, type: 'varchar', length: 20 },
        name: { type: 'varchar', length: 50 },
        price: { type: 'int' },
        days: { type: 'int' },
        months: { type: 'int' },
        best_value: { type: 'boolean', default: false },
        sort_order: { type: 'int', default: 0 },
    },
});

module.exports = Plan;
