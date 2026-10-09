const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { listPublic, listForUsers, getPublic, getForUsers } = require('../controllers/blogController');

// Visitors (no login): posts published for the public website.
router.get('/public', listPublic);
router.get('/public/:slug', getPublic);
// Logged-in users: posts published for users.
router.get('/', protect, listForUsers);
router.get('/:slug', protect, getForUsers);
module.exports = router;
