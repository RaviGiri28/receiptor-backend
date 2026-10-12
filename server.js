require('dotenv').config();
require('reflect-metadata');

const express = require("express");
const cors = require("cors");
const helmet = require('helmet');
const multer = require('multer');
const { AppDataSource } = require('./config/db');
const { isConfigured: cloudinaryConfigured } = require('./config/cloudinary');
const { verifyMailer } = require('./config/mailer');
const authRoutes = require('./routes/authRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const supportRoutes = require('./routes/supportRoutes');
const blogRoutes = require('./routes/blogRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const internalRoutes = require('./routes/internalRoutes');
const { runRetention } = require('./services/retention');

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    process.exit(1);
}

if (!process.env.ADMIN_EMAILS) {
    console.warn('ADMIN_EMAILS is not set: nobody can publish blog posts or announcements.');
}

if (!cloudinaryConfigured()) {
    console.warn('Cloudinary is not configured: logo uploads will fail with 503. Set CLOUDINARY_* in .env.');
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Behind a reverse proxy / load balancer, the client IP (used by the rate limiter)
// comes from X-Forwarded-For. Set TRUST_PROXY to the number of proxy hops, e.g. 1.
if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

// Comma-separated list of allowed cross-origin frontends, e.g. "https://app.example.com".
// Unset = same-origin only (the Vite dev server proxies /api, so dev needs no CORS).
if (process.env.CORS_ORIGIN) {
    app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uptime monitoring (e.g. UptimeRobot every 5 minutes): its pings also keep a free Render
// instance from sleeping. 503 when the database can't be reached, so that raises an alert too.
app.get('/api/health', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        await Promise.race([
            AppDataSource.query('SELECT 1'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database timed out')), 5000)),
        ]);
        res.status(200).json({ status: 'ok', database: 'up', uptime_seconds: Math.round(process.uptime()) });
    } catch (err) {
        console.error('Health check failed:', err.message || err);
        res.status(503).json({ status: 'error', database: 'down' });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalRoutes);

app.get('/', (req, res) => {
    res.send("Backend Running");
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Invalid JSON body' });
    }
    if (err.status && err.status < 500) {
        return res.status(err.status).json({ message: err.message });
    }
    console.error('Unhandled error:', err);
    return res.status(500).json({ message: 'Internal server error' });
});

AppDataSource.initialize().then(() => {
    console.log('DB connected successfully');
    app.listen(PORT, () => {
        console.log(`server started on port ${PORT}`);
    });
    verifyMailer();
    // Data retention (see services/retention.js): shortly after every start, and daily
    // while running. Render's free plan sleeps when idle, so a daily external ping of
    // GET /api/internal/retention (cron-job.org) both wakes the server and runs it.
    const retention = () => runRetention().catch((err) => console.error('Retention run failed:', err));
    setTimeout(retention, 60 * 1000).unref();
    setInterval(retention, 24 * 60 * 60 * 1000).unref();
}).catch((err) => {
    console.error('Database connection failed', err);
    process.exit(1);
});
