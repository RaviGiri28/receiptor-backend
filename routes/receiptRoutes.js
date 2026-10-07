const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');

const { getDashboardStats, createReceipt, getAllReceipts, getReceiptById, updateReceipt, deleteReceipt } = require('../controllers/receiptController');

router.get('/dashboard', protect, getDashboardStats);
router.post('/create', protect, createReceipt);
router.get('/', protect, getAllReceipts);
router.get('/:id', protect, getReceiptById);
router.put('/:id', protect, updateReceipt);
router.delete('/:id', protect, deleteReceipt);
module.exports = router;
