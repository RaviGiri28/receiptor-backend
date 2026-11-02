const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const requireActive = require('../middleware/requireActive');
const { couponLimiter, paymentLimiter } = require('../middleware/rateLimit');
const { getMine, publicPlans, redeem, order, verify } = require('../controllers/subscriptionController');

router.get('/plans', publicPlans);
router.get('/', protect, getMine);
router.post('/redeem', protect, couponLimiter, redeem);
router.post('/order', protect, requireActive, paymentLimiter, order);
// No requireActive: someone who has already paid still gets their plan.
router.post('/verify', protect, verify);
module.exports = router;
