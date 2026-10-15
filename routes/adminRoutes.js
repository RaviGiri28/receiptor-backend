const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');
const upload = require('../middleware/upload');
const blog = require('../controllers/blogController');
const announcements = require('../controllers/announcementController');
const users = require('../controllers/userAdminController');

// Everything here is admin only (emails listed in ADMIN_EMAILS).
router.use(protect, requireAdmin);

// Blog posts: multipart/form-data with an optional "cover" image.
router.get('/blog', blog.adminList);
router.post('/blog', upload.blogImage.single('cover'), blog.adminCreate);
router.post('/blog/images', upload.blogImage.single('image'), blog.adminUploadImage);
router.get('/blog/:id', blog.adminGet);
router.put('/blog/:id', upload.blogImage.single('cover'), blog.adminUpdate);
router.delete('/blog/:id', blog.adminDelete);

router.get('/announcements', announcements.adminList);
router.post('/announcements', announcements.adminCreate);
router.put('/announcements/:id', announcements.adminUpdate);
router.delete('/announcements/:id', announcements.adminDelete);

// Signed-up users, and deactivating (banning) / reactivating an account.
router.get('/users', users.list);
router.put('/users/:id/status', users.setStatus);
module.exports = router;
