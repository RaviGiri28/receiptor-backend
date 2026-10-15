// Runs after protect. A deactivated account keeps read access (view, export, delete its
// receipts) but cannot create or change receipts.
const requireActive = (req, res, next) => {
    if (req.user && req.user.deactivated) {
        return res.status(403).json({
            code: 'ACCOUNT_DEACTIVATED',
            message: 'Your account has been deactivated. You can still view and download your past receipts, but you cannot create or edit receipts. Please contact support.',
        });
    }
    next();
};

module.exports = requireActive;
