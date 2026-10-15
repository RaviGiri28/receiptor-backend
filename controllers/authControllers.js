const { AppDataSource } = require('../config/db');
const User = require('../entity/User');
const bcrypt = require('bcrypt');
const joi = require('joi');
const { validate } = require('../middleware/validation');
const jwt = require('jsonwebtoken');
const { uploadLogo, deleteLogo } = require('../config/cloudinary');
const { isAdminEmail } = require('../config/admin');
const { TERMS_VERSION, DAY_MS, DELETION_GRACE_DAYS } = require('../config/legal');
const { passcodeField, hashPasscode, getPasscodeHash } = require('../services/passcode');
const { sendWelcomeEmail } = require('../services/welcomeEmail');
const {
    hashResetToken, newResetToken, sendResetEmail, sendPasswordChangedEmail,
} = require('../services/passwordReset');

const deletionDate = (user) => new Date(new Date(user.deletion_requested_at).getTime() + DELETION_GRACE_DAYS * DAY_MS);

// The user is back: restart the inactivity clock and forget any inactivity emails sent.
const activitySnapshot = () => ({ last_active_at: new Date(), inactivity_notice_at: null, inactivity_reminder_at: null });

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
    // Multipart forms send booleans as text.
    accept_terms: joi.boolean().truthy('true').valid(true).required().label('Acceptance of the Terms and Privacy Policy')
        .messages({ 'any.only': 'Please accept the Terms and Privacy Policy', 'any.required': 'Please accept the Terms and Privacy Policy' }),
    terms_version: joi.string().valid(TERMS_VERSION).required().label('Terms version')
        .messages({ 'any.only': 'The Terms have been updated. Please reload the page and accept them again.' }),
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
            terms_version: TERMS_VERSION,
            terms_accepted_at: new Date(),
            last_active_at: new Date(),
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
        sendWelcomeEmail(savedUser);

        return res.status(201).json({
            message: 'User registered successfully',
            userId: savedUser.id,
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Same answer whether or not the email has an account, so the form can't be used to find
// out who is registered. The email is sent after responding, so timing doesn't tell either.
const FORGOT_PASSWORD_REPLY = 'If an account exists for that email, we have sent a link to reset the password.';

const forgotPassword = async (req, res) => {
    try {
        const { error, value } = validate(joi.object({
            email: joi.string().trim().email().max(100).required().label('Email'),
        }), req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { email: value.email },
            select: ['id', 'name', 'email', 'deletion_requested_at'],
        });
        res.status(200).json({ message: FORGOT_PASSWORD_REPLY });

        // Accounts past their recovery period can't log in any more, so no reset for them.
        if (!user || (user.deletion_requested_at && Date.now() >= deletionDate(user).getTime())) return;
        const { token, hash, expiresAt } = newResetToken();
        // A new request replaces any earlier link.
        await userRepository.update({ id: user.id }, { password_reset_token_hash: hash, password_reset_expires_at: expiresAt });
        await sendResetEmail(user, token);
    } catch (err) {
        console.error('Forgot password error:', err.message || err);
        if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { error, value } = validate(joi.object({
            token: joi.string().max(200).required().label('Reset link'),
            password: joi.string().min(6).max(72).required().label('New password'),
        }), req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { password_reset_token_hash: hashResetToken(value.token) },
            select: ['id', 'name', 'email', 'password_reset_expires_at'],
        });
        if (!user || !user.password_reset_expires_at || user.password_reset_expires_at.getTime() < Date.now()) {
            return res.status(400).json({
                code: 'RESET_LINK_INVALID',
                message: 'This reset link is invalid or has expired. Please ask for a new one.',
            });
        }
        await userRepository.update({ id: user.id }, {
            password: await bcrypt.hash(value.password, 10),
            // Whole seconds, to match the JWT "iat" claim: signs out every existing session.
            password_changed_at: new Date(Math.floor(Date.now() / 1000) * 1000),
            password_reset_token_hash: null,
            password_reset_expires_at: null,
        });
        res.status(200).json({ message: 'Your password has been reset. Please log in with your new password.' });

        sendPasswordChangedEmail(user)
            .catch((err) => console.error(`Password changed email to user #${user.id} failed:`, err.message || err));
    } catch (err) {
        console.error('Reset password error:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Internal server error' });
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
        // A deleted account in its recovery period: the client offers to restore it.
        if (user.deletion_requested_at) {
            const deleteOn = deletionDate(user);
            if (Date.now() >= deleteOn.getTime()) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            return res.status(403).json({
                code: 'ACCOUNT_DELETION_PENDING',
                message: 'This account was deleted and will be permanently erased soon. You can restore it until then.',
                delete_on: deleteOn.toISOString(),
            });
        }
        await userRepository.update({ id: user.id }, activitySnapshot());
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
                is_admin: isAdminEmail(user.email),
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
                'terms_version',
                'app_passcode',
                'deactivated_at',
                'created_at'
            ]
        });
        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Only whether a passcode is set leaves the server, never its hash.
        const { app_passcode, ...profile } = user;
        return res.status(200).json({
            message: 'Profile fetched Successfully',
            // terms_current: the version the user must have accepted to use the app.
            user: { ...profile, has_passcode: !!app_passcode, is_admin: isAdminEmail(user.email), terms_current: TERMS_VERSION },
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
                is_admin: isAdminEmail(updateUser.email),
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

const acceptTerms = async (req, res) => {
    try {
        const { error, value } = validate(joi.object({
            terms_version: joi.string().valid(TERMS_VERSION).required().label('Terms version')
                .messages({ 'any.only': 'The Terms have been updated. Please reload the page.' }),
        }), req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        await AppDataSource.getRepository(User).update(
            { id: req.user.id },
            { terms_version: value.terms_version, terms_accepted_at: new Date() },
        );
        return res.status(200).json({ message: 'Terms accepted', terms_version: value.terms_version });
    } catch (err) {
        console.error('Accept terms error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Starts the recovery period; the account is erased DELETION_GRACE_DAYS later
// (services/retention.js) unless the user restores it by logging in.
const deleteAccount = async (req, res) => {
    try {
        const { error, value } = validate(joi.object({
            password: joi.string().required().label('Password'),
        }), req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: req.user.id }, select: ['id', 'password'] });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!(await bcrypt.compare(value.password, user.password))) {
            // 400, not 401: the session is valid, and clients treat 401 as "logged out".
            return res.status(400).json({ message: 'Password is incorrect' });
        }
        const now = new Date(Math.floor(Date.now() / 1000) * 1000);
        // Also ends every session, including this one.
        await userRepository.update({ id: user.id }, { deletion_requested_at: now, password_changed_at: now });
        return res.status(200).json({
            message: 'Account deleted',
            delete_on: deletionDate({ deletion_requested_at: now }).toISOString(),
        });
    } catch (err) {
        console.error('Delete account error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Cancels a pending deletion (same credentials as login) and logs the user in.
const restoreAccount = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        if (!user.deletion_requested_at || Date.now() >= deletionDate(user).getTime()) {
            return res.status(400).json({ message: 'This account has no pending deletion to cancel' });
        }
        await userRepository.update({ id: user.id }, { deletion_requested_at: null, ...activitySnapshot() });
        return res.status(200).json({ message: 'Account restored', token: signToken(user) });
    } catch (err) {
        console.error('Restore account error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Sets the app passcode, or changes it (then the current one is required).
const setPasscode = async (req, res) => {
    try {
        const { error, value } = validate(joi.object({
            passcode: passcodeField.required().label('Passcode'),
            current_passcode: passcodeField.label('Current passcode'),
        }), req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const current = await getPasscodeHash(req.user.id);
        if (current && !(value.current_passcode && await bcrypt.compare(value.current_passcode, current))) {
            // 400, not 401: the session is valid, and clients treat 401 as "logged out".
            return res.status(400).json({ message: 'Current passcode is incorrect' });
        }
        await AppDataSource.getRepository(User).update({ id: req.user.id }, { app_passcode: await hashPasscode(value.passcode) });
        return res.status(200).json({ message: current ? 'Passcode changed' : 'Passcode set' });
    } catch (err) {
        console.error('Set passcode error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Removes the app passcode. Takes the account password, so it also works when the passcode is forgotten.
const removePasscode = async (req, res) => {
    try {
        const { error, value } = validate(joi.object({
            password: joi.string().required().label('Password'),
        }), req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: req.user.id }, select: ['id', 'password'] });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!(await bcrypt.compare(value.password, user.password))) {
            return res.status(400).json({ message: 'Password is incorrect' });
        }
        await userRepository.update({ id: user.id }, { app_passcode: null });
        return res.status(200).json({ message: 'Passcode removed' });
    } catch (err) {
        console.error('Remove passcode error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Checks the passcode to unlock the app.
const verifyPasscode = async (req, res) => {
    try {
        const { error, value } = validate(joi.object({
            passcode: passcodeField.required().label('Passcode'),
        }), req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const hash = await getPasscodeHash(req.user.id);
        if (hash && !(await bcrypt.compare(value.passcode, hash))) {
            return res.status(400).json({ message: 'Wrong passcode' });
        }
        return res.status(200).json({ message: 'Passcode correct' });
    } catch (err) {
        console.error('Verify passcode error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    register, login, getProfile, updateProfile, updateCustomFields, changePassword,
    acceptTerms, deleteAccount, restoreAccount, setPasscode, removePasscode, verifyPasscode, forgotPassword, resetPassword,
};