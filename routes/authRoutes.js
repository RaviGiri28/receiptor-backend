const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
    register, login, getProfile, updateProfile, updateCustomFields, changePassword,
    acceptTerms, deleteAccount, restoreAccount, setPasscode, removePasscode, verifyPasscode, forgotPassword, resetPassword,
} = require('../controllers/authControllers');
const protect = require('../middleware/authMiddleware');
const {
    loginLimiter, registerLimiter, changePasswordLimiter, forgotPasswordLimiter, resetPasswordLimiter, passcodeLimiter,
} = require('../middleware/rateLimit');

// Accepts JSON, or multipart/form-data with an optional "business_logo" image.
router.post('/register', registerLimiter, upload.single('business_logo'), register);
router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);
router.get('/profile', protect, getProfile);
router.put('/update-profile', protect, upload.single('business_logo'), updateProfile);
router.put('/custom-fields', protect, updateCustomFields);
router.put('/change-password', protect, changePasswordLimiter, changePassword);
router.post('/accept-terms', protect, acceptTerms);
router.delete('/account', protect, changePasswordLimiter, deleteAccount);
router.post('/restore-account', loginLimiter, restoreAccount);
router.put('/passcode', protect, passcodeLimiter, setPasscode);
router.delete('/passcode', protect, changePasswordLimiter, removePasscode);
router.post('/passcode/verify', protect, passcodeLimiter, verifyPasscode);
module.exports = router;
