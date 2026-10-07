const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { supportLimiter } = require('../middleware/rateLimit');
const { createTicket } = require('../controllers/supportController');

router.post('/', protect, supportLimiter, createTicket);
module.exports = router;
