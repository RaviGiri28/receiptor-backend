// Creates all tables from the entities in an EMPTY database (e.g. a fresh TiDB Cloud cluster).
// Usage: npm run db:init   (uses the DB_* values from .env)
// For a database that already has tables, use the SQL files in migrations/ instead.
require('dotenv').config();
require('reflect-metadata');

const { AppDataSource } = require('../config/db');
const Plan = require('../entity/Plan');
const { DEFAULT_PLANS } = require('../config/plans');

(async () => {
    await AppDataSource.initialize();
    try {
        const tables = await AppDataSource.query('SHOW TABLES');
        if (tables.length > 0) {
            console.error(`Database "${process.env.DB_NAME}" already has ${tables.length} table(s); not touching it.`);
            process.exitCode = 1;
            return;
        }
        await AppDataSource.synchronize();
        await AppDataSource.getRepository(Plan).insert(DEFAULT_PLANS.map((plan, i) => ({
            ...plan, best_value: !!plan.best_value, sort_order: i + 1,
        })));
        const created = await AppDataSource.query('SHOW TABLES');
        console.log('Created tables:', created.map((row) => Object.values(row)[0]).join(', '));
    } finally {
        await AppDataSource.destroy();
    }
})().catch((err) => {
    console.error('Database init failed:', err.message);
    process.exit(1);
});
