const jwt = require('jsonwebtoken');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
require('dotenv').config();

const ACTIVITY_WRITE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({message: 'Access denied. No token provided'});
    }
    let decoded;
    try {
        decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({message: 'Invalid or expired token.'});
    }
    try {
        // Reject tokens of deleted users and tokens issued before the last password change.
        const repo = AppDataSource.getRepository(User);
        const user = await repo.findOne({
            where: { id: decoded.id },
            select: ['id', 'email', 'password_changed_at', 'deletion_requested_at', 'last_active_at'],
        });
        if (!user || user.deletion_requested_at) {
            return res.status(401).json({message: 'Invalid or expired token.'});
        }
        if (user.password_changed_at && Math.floor(user.password_changed_at.getTime() / 1000) > decoded.iat) {
            return res.status(401).json({message: 'Session expired. Please log in again.'});
        }
        // Remembered sessions skip the login page, so app use also counts as activity
        // for the inactivity rule (written at most once a day).
        if (!user.last_active_at || Date.now() - user.last_active_at.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
            repo.update({ id: user.id }, { last_active_at: new Date(), inactivity_notice_at: null, inactivity_reminder_at: null })
                .catch((err) => console.error('Could not record activity:', err.message || err));
        }
        // Email from the database, not the token, so admin checks use the current account.
        req.user = { ...decoded, email: user.email };
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = protect;
