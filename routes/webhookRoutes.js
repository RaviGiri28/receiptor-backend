const express = require('express');
const router = express.Router();
const { razorpayWebhook } = require('../controllers/webhookController');

// Raw body: the signature is computed over the exact bytes Razorpay sent.
// No login here: Razorpay has no token, so the signature is the check.
router.post('/razorpay', express.raw({ type: 'application/json' }), razorpayWebhook);

module.exports = router;
