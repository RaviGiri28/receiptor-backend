const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { list, unreadCount, markRead, markAllRead } = require('../controllers/notificationController');

router.get('/', protect, list);
router.get('/unread-count', protect, unreadCount);
router.post('/read', protect, markRead);
router.post('/read-all', protect, markAllRead);
module.exports = router;
