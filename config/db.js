const { DataSource } = require("typeorm");
const User = require("../entity/User");
const Receipt = require('../entity/Receipt');
const SupportTicket = require('../entity/SupportTicket');
const BlogPost = require('../entity/BlogPost');
const Announcement = require('../entity/Announcement');
const NotificationRead = require('../entity/NotificationRead');
const Coupon = require('../entity/Coupon');
const CouponRedemption = require('../entity/CouponRedemption');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // TiDB Cloud (and most hosted MySQL) only accept TLS connections. Node's built-in
    // CA bundle covers TiDB's certificate, so no CA file is needed.
    ssl: process.env.DB_SSL === 'true'
        ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        : undefined,
    // Auto schema sync can drop/alter columns, so it is opt-in (DB_SYNCHRONIZE=true)
    // and never runs in production; use the SQL files in migrations/ instead.
    synchronize: !isProduction && process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    entities: [User, Receipt, SupportTicket, BlogPost, Announcement, NotificationRead, Coupon, CouponRedemption],
});

module.exports = { AppDataSource };
