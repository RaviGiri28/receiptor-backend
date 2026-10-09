const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Either CLOUDINARY_URL (cloudinary://key:secret@cloud) — which the SDK reads by
// itself — or the three separate variables below.
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}
cloudinary.config({ secure: true });

const LOGO_FOLDER = process.env.CLOUDINARY_FOLDER || 'receiptor/logos';

const isConfigured = () => {
    const { cloud_name, api_key, api_secret } = cloudinary.config();
    return Boolean(cloud_name && api_key && api_secret);
};

const BLOG_FOLDER = process.env.CLOUDINARY_BLOG_FOLDER || 'receiptor/blog';

// Uploads an image buffer; resolves to { url, publicId }.
const uploadImage = (buffer, { folder, maxSize, label }) => new Promise((resolve, reject) => {
    if (!isConfigured()) {
        const err = new Error(`${label} storage is not configured`);
        err.status = 503;
        return reject(err);
    }
    const stream = cloudinary.uploader.upload_stream(
        {
            folder,
            resource_type: 'image',
            transformation: [{ width: maxSize, height: maxSize, crop: 'limit' }],
        },
        (err, result) => {
            if (err) {
                // Cloudinary rejects files that aren't real images.
                const wrapped = new Error(err.http_code === 400 ? 'Invalid image file' : `${label} upload failed`);
                wrapped.status = err.http_code === 400 ? 400 : 502;
                wrapped.cause = err;
                return reject(wrapped);
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
        }
    );
    stream.end(buffer);
});

// Logos are shown at ~40px on receipts; cap the stored size.
const uploadLogo = (buffer) => uploadImage(buffer, { folder: LOGO_FOLDER, maxSize: 512, label: 'Logo' });

// Blog covers and inline images are shown up to page width.
const uploadBlogImage = (buffer) => uploadImage(buffer, { folder: BLOG_FOLDER, maxSize: 1600, label: 'Image' });

// Best effort: a failed cleanup shouldn't fail the user's request.
const deleteImage = async (publicId) => {
    if (!publicId || !isConfigured()) return;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
        console.error('Cloudinary delete failed for', publicId, err.message || err);
    }
};

const deleteLogo = deleteImage;

module.exports = { isConfigured, uploadLogo, deleteLogo, uploadBlogImage, deleteImage };
