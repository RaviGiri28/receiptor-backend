const bcrypt = require('bcrypt');
const joi = require('joi');
const { AppDataSource } = require('../config/db');
const User = require('../entity/User');

// The app passcode: exactly 4 digits.
const passcodeField = joi.string().pattern(/^\d{4}$/).messages({ 'string.pattern.base': '{#label} must be 4 digits' });

const hashPasscode = (passcode) => bcrypt.hash(passcode, 10);

// The user's passcode hash, or null when they have none.
const getPasscodeHash = async (userId) => {
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['id', 'app_passcode'] });
    return user ? user.app_passcode : null;
};

// True when the user has no passcode, or the given one matches it.
const passcodeAllows = async (userId, passcode) => {
    const hash = await getPasscodeHash(userId);
    if (!hash) return true;
    return typeof passcode === 'string' && bcrypt.compare(passcode, hash);
};

module.exports = { passcodeField, hashPasscode, getPasscodeHash, passcodeAllows };
