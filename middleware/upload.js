const multer = require('multer');
const path = require('path');

// Files are kept in memory and pushed to Cloudinary by the controller once the
// rest of the request has been validated (see config/cloudinary.js).
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;

    const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeValid = allowedTypes.test(file.mimetype);

    if (extValid && mimeValid) {
        cb(null, true);
    } else {
        const err = new Error('Only image files allowed (jpeg, jpg, png, webp)');
        err.status = 400;
        cb(err);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 },
});

module.exports = upload;
