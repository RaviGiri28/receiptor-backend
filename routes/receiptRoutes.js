const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const requireActive = require('../middleware/requireActive');
const { passcodeLimiter } = require('../middleware/rateLimit');

const { getDashboardStats, createReceipt, getAllReceipts, getReceiptById, updateReceipt, deleteReceipt } = require('../controllers/receiptController');

router.get('/dashboard', protect, getDashboardStats);
router.post('/create', protect, requireActive, createReceipt);
router.get('/', protect, getAllReceipts);
router.get('/:id', protect, getReceiptById);
router.put('/:id', protect, requireActive, updateReceipt);
router.delete('/:id', protect, passcodeLimiter, deleteReceipt);
module.exports = router;
