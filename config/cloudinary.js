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

// Uploads an image buffer; resolves to { url, publicId }.
const uploadLogo = (buffer) => new Promise((resolve, reject) => {
    if (!isConfigured()) {
        const err = new Error('Logo storage is not configured');
        err.status = 503;
        return reject(err);
    }
    const stream = cloudinary.uploader.upload_stream(
        {
            folder: LOGO_FOLDER,
            resource_type: 'image',
            // Logos are shown at ~40px on receipts; cap the stored size.
            transformation: [{ width: 512, height: 512, crop: 'limit' }],
        },
        (err, result) => {
            if (err) {
                // Cloudinary rejects files that aren't real images.
                const wrapped = new Error(err.http_code === 400 ? 'Invalid image file' : 'Logo upload failed');
                wrapped.status = err.http_code === 400 ? 400 : 502;
                wrapped.cause = err;
                return reject(wrapped);
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
        }
    );
    stream.end(buffer);
});

// Best effort: a failed cleanup shouldn't fail the user's request.
const deleteLogo = async (publicId) => {
    if (!publicId || !isConfigured()) return;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
        console.error('Cloudinary delete failed for', publicId, err.message || err);
    }
};

module.exports = { isConfigured, uploadLogo, deleteLogo };
