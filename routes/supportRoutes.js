const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { supportLimiter, contactLimiter } = require('../middleware/rateLimit');
const { createTicket, createContactMessage } = require('../controllers/supportController');

router.post('/', protect, supportLimiter, createTicket);
// Public: the landing page's Contact form.
router.post('/contact', contactLimiter, createContactMessage);
module.exports = router;
