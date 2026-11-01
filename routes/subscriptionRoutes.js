const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { couponLimiter } = require('../middleware/rateLimit');
const { getMine, redeem } = require('../controllers/subscriptionController');

router.get('/', protect, getMine);
router.post('/redeem', protect, couponLimiter, redeem);
module.exports = router;
