const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const bcrypt = require('bcrypt');
const joi = require('joi');
const { validate } = require('../middleware/validation');
const jwt = require('jsonwebtoken');
const { uploadLogo, deleteLogo } = require('../config/cloudinary');

// Upload errors carry a status (400 bad image, 502 Cloudinary down, 503 not configured).
const uploadErrorResponse = (res, err) => {
    if (err.cause) console.error('Cloudinary upload error:', err.cause.message || err.cause);
    return res.status(err.status || 502).json({ message: err.message });
};
const signToken = (user) => jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const registerSchema = joi.object({
    name: joi.string().min(2).max(100).required().label('Name'),
    email: joi.string().email().required().label('Email'),
    password: joi.string().min(6).required().label('Password'),
    phone_number: joi.string().min(7).max(20).required().label('Phone number'),
    business_name: joi.string().max(150).required().label('Business name'),
    business_address: joi.string().max(500).required().label('Business address'),
    business_phone: joi.string().min(7).max(20).required().label('Business phone'),
});

const register = async (req, res) => {
    try {
        const { error, value } = validate(registerSchema, req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const { name, email, password, phone_number, business_name, business_address, business_phone } = value;

        const userRepository = AppDataSource.getRepository(User);
        const existingUser = await userRepository.findOne({
            where: { email }
        });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        // Only upload once the request is otherwise valid, so rejected signups leave no orphan images.
        let logo = null;
        if (req.file) {
            try {
                logo = await uploadLogo(req.file.buffer);
            } catch (uploadErr) {
                return uploadErrorResponse(res, uploadErr);
            }
        }

        const hashedpassword = await bcrypt.hash(password, 10);
        const newUser = userRepository.create({
            name,
            email,
            password: hashedpassword,
            phone_number,
            business_name,
            business_address,
            business_phone,
            business_logo: logo && logo.url,
            business_logo_public_id: logo && logo.publicId,
        });

        let savedUser;
        try {
            savedUser = await userRepository.save(newUser);
        } catch (saveErr) {
            if (logo) await deleteLogo(logo.publicId);
            // A concurrent signup with the same email got in between the check above and here.
            if (saveErr.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'Email already registered' });
            }
            throw saveErr;
        }

        return res.status(201).json({
            message: 'User registered successfully',
            userId: savedUser.id,
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const token = signToken(user);
        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                business_name: user.business_name,
                business_logo: user.business_logo,
            }
        });
    } catch (err) {
        console.error('Login error', err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};

const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id: userId },
            select: [
                'id',
                'name',
                'email',
                'phone_number',
                'business_name',
                'business_address',
                'business_phone',
                'business_logo',
                'custom_field_defs',
                'created_at'
            ]
        });
        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        return res.status(200).json({
            message: 'Profile fetched Successfully',
            user
        });
    } catch (err) {
        console.error('Get profile error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const updateSchema = joi.object({
            name: joi.string().min(2).max(100).label('Name'),
            phone_number: joi.string().min(7).max(20).label('Phone number'),
            business_name: joi.string().max(150).label('Business name'),
            business_address: joi.string().max(500).label('Business address'),
            business_phone: joi.string().min(7).max(20).label('Business phone'),
        });

        const { error, value } = validate(updateSchema, req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        if (Object.keys(value).length === 0 && !req.file) {
            return res.status(400).json({ message: 'No fields provided to update' });
        }
        const userId = req.user.id;
        const userRepository = AppDataSource.getRepository(User);

        const user = await userRepository.findOne({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        let newLogo = null;
        if (req.file) {
            try {
                newLogo = await uploadLogo(req.file.buffer);
            } catch (uploadErr) {
                return uploadErrorResponse(res, uploadErr);
            }
            value.business_logo = newLogo.url;
            value.business_logo_public_id = newLogo.publicId;
        }

        const oldLogoPublicId = user.business_logo_public_id;
        Object.assign(user, value);
        let updateUser;
        try {
            updateUser = await userRepository.save(user);
        } catch (saveErr) {
            if (newLogo) await deleteLogo(newLogo.publicId);
            throw saveErr;
        }
        // The replaced logo is no longer referenced anywhere.
        if (newLogo && oldLogoPublicId) await deleteLogo(oldLogoPublicId);
        return res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: updateUser.id,
                name: updateUser.name,
                email: updateUser.email,
                phone_number: updateUser.phone_number,
                business_name: updateUser.business_name,
                business_address: updateUser.business_address,
                business_phone: updateUser.business_phone,
                business_logo: updateUser.business_logo,
                custom_field_defs: updateUser.custom_field_defs,
            }
        });
    } catch (err) {
        console.error('Update profile error:', err);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

const customFieldsSchema = joi.object({
    custom_fields: joi.array().items(joi.object({
        // Matches the key limits of a receipt's custom_fields values.
        id: joi.string().max(50).required().label('Field ID'),
        label: joi.string().trim().min(1).max(100).required().label('Field label'),
    })).max(20).unique('id').required().label('Custom fields'),
});

const updateCustomFields = async (req, res) => {
    try {
        const { error, value } = validate(customFieldsSchema, req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userRepository = AppDataSource.getRepository(User);
        const result = await userRepository.update({ id: req.user.id }, { custom_field_defs: value.custom_fields });
        if (!result.affected) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json({
            message: 'Custom fields updated successfully',
            custom_fields: value.custom_fields,
        });
    } catch (err) {
        console.error('Update custom fields error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const changePassword = async (req, res) => {
    try {
        const passwordSchema = joi.object({
            current_password: joi.string().required().label('Current password'),
            new_password: joi.string().min(6).required().label('New password'),
            confirm_password: joi.string().required().label('Confirm password'),
        });

        const { error, value } = validate(passwordSchema, req.body);
        if (error) {
            return res.status(400).json({
                message: error
            });
        }

        const { current_password, new_password, confirm_password } = value;
        if (new_password !== confirm_password) {
            return res.status(400).json({
                message: 'New password and confirm password do not match',
            });
        }
        const userId = req.user.id;
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id: userId },
            select: ['id', 'password']
        });
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
            });
        }
        const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
        if (!isCurrentPasswordValid) {
            // 400, not 401: the session is valid, and clients treat 401 as "logged out".
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const isSamePassword = await bcrypt.compare(new_password, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                message: 'New password cannot be same as current password',
            });
        }
        const hashedNewpassword = await bcrypt.hash(new_password, 10);
        user.password = hashedNewpassword;
        // Whole seconds, to match the JWT "iat" claim: every token issued before now
        // stops working, while the token issued below (same second) stays valid.
        user.password_changed_at = new Date(Math.floor(Date.now() / 1000) * 1000);
        await userRepository.save(user);

        return res.status(200).json({
            message: 'Password changed successfully',
            token: signToken(req.user),
        });
    } catch (err) {
        console.error('Change password error', err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};

module.exports = { register, login, getProfile, updateProfile, updateCustomFields, changePassword };