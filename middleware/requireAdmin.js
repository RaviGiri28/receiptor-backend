const { isAdminEmail } = require('../config/admin');

// Runs after protect, which loads the account's email from the database.
const requireAdmin = (req, res, next) => {
    if (!isAdminEmail(req.user && req.user.email)) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

module.exports = requireAdmin;
