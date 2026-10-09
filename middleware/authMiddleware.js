const jwt = require('jsonwebtoken');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
require('dotenv').config();

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
        const user = await AppDataSource.getRepository(User).findOne({
            where: { id: decoded.id },
            select: ['id', 'email', 'password_changed_at'],
        });
        if (!user) {
            return res.status(401).json({message: 'Invalid or expired token.'});
        }
        if (user.password_changed_at && Math.floor(user.password_changed_at.getTime() / 1000) > decoded.iat) {
            return res.status(401).json({message: 'Session expired. Please log in again.'});
        }
        // Email from the database, not the token, so admin checks use the current account.
        req.user = { ...decoded, email: user.email };
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = protect;
