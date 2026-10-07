const { AppDataSource } = require('../config/db');
const Receipt = require('../entity/Receipt');
const User = require('../entity/User');
const joi = require('joi');
const { validate } = require('../middleware/validation');

// Matches the decimal(10,2) column.
const amountField = joi.number().positive().max(99999999.99).precision(2);
// Well below the TEXT column's 64 KB, which would otherwise fail as a 500.
const notesField = joi.string().max(1000).allow('');
// Values for the user's own extra receipt fields, keyed by field id.
const customFieldsField = joi.object().pattern(joi.string().max(50), joi.string().max(500).allow('')).max(20).allow(null);

const receiptSchema = joi.object({
    account_holder: joi.string().max(150).required().label('Account holder'),
    account_number: joi.string().max(50).required().label('Account number'),
    ifsc_code: joi.string().max(20).optional().allow('').label('IFSC code'),
    amount: amountField.required().label('Amount'),
    date: joi.date().iso().raw().required().label('Date'),
    transaction_id: joi.string().max(100).required().label('Transaction ID'),
    reference_number: joi.string().max(100).optional().allow('').label('Reference number'),
    status: joi.string().valid('Success', 'Pending').default('Success').label('Status'),
    bank_name: joi.string().max(100).required().label('Bank name'),
    customer_mobile: joi.string().min(7).max(20).required().label('Customer mobile'),
    notes: notesField.optional().label('Notes'),
    save_type: joi.string().valid('printed', 'saved').default('saved').label('Save type'),
    is_dual_print: joi.boolean().default(false).label('Dual print'),
    custom_fields: customFieldsField.default(null).label('Custom fields'),
});

// Same fields as create, but all optional and without defaults, so a partial
// update never silently resets status/save_type/is_dual_print.
const updateReceiptSchema = joi.object({
    account_holder: joi.string().max(150).label('Account holder'),
    account_number: joi.string().max(50).label('Account number'),
    ifsc_code: joi.string().max(20).allow('').label('IFSC code'),
    amount: amountField.label('Amount'),
    date: joi.date().iso().raw().label('Date'),
    transaction_id: joi.string().max(100).label('Transaction ID'),
    reference_number: joi.string().max(100).allow('').label('Reference number'),
    status: joi.string().valid('Success', 'Pending').label('Status'),
    bank_name: joi.string().max(100).label('Bank name'),
    customer_mobile: joi.string().min(7).max(20).label('Customer mobile'),
    notes: notesField.label('Notes'),
    save_type: joi.string().valid('printed', 'saved').label('Save type'),
    is_dual_print: joi.boolean().label('Dual print'),
    custom_fields: customFieldsField.label('Custom fields'),
}).min(1);

const listQuerySchema = joi.object({
    type: joi.string().valid('printed', 'saved').label('Type'),
    page: joi.number().integer().min(1).default(1).label('Page'),
    limit: joi.number().integer().min(1).max(100).default(20).label('Limit'),
    search: joi.string().trim().max(100).allow('').label('Search'),
    account_number: joi.string().max(50).label('Account number'),
    transaction_id: joi.string().max(100).label('Transaction ID'),
    amount: amountField.label('Amount'),
    status: joi.string().valid('Success', 'Pending').label('Status'),
    date_from: joi.date().iso().raw().label('From date'),
    date_to: joi.date().iso().raw().label('To date'),
});

// "Today" is the caller's local date (YYYY-MM-DD), so the count doesn't depend on
// the server's or database's timezone. Falls back to the server's date.
const dashboardQuerySchema = joi.object({
    today: joi.date().iso().raw().label('Today'),
});

const localIsoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Makes user input match literally inside LIKE (MySQL's default escape character is \).
const escapeLike = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

const parseId = (raw) => {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const getDashboardStats = async (req, res) => {
    try {
        const { error, value } = validate(dashboardQuerySchema, req.query);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const today = value.today ? value.today.slice(0, 10) : localIsoDate(new Date());
        const userId = req.user.id;
        const receiptRepository = AppDataSource.getRepository(Receipt);
        const total_receipts = await receiptRepository.count({
            where: { user_id: userId }
        });

        const todays_receipt = await receiptRepository.count({
            where: {
                user_id: userId,
                date: today,
            }
        });

        const totalAmountResult = await receiptRepository
            .createQueryBuilder('receipt')
            .select('SUM(receipt.amount)', 'total')
            .where('receipt.user_id = :userId', { userId })
            .getRawOne();

        const total_amount = parseFloat(totalAmountResult.total) || 0;

        const pending_receipts = await receiptRepository.count({
            where: {
                user_id: userId,
                status: 'Pending'
            }
        });

        return res.status(200).json({
            message: 'Dashboard stats fetched successfully',
            stats: {
                total_receipts,
                todays_receipt,
                total_amount,
                pending_receipts,
            }
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        return res.status(500).json({ message: 'Internal server error' })
    }
};

const createReceipt = async (req, res) => {
    try {
        const { error, value } = validate(receiptSchema, req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userId = req.user.id;

        const savedReceipt = await AppDataSource.transaction(async (manager) => {
            // Lock the user's row so concurrent creates get distinct serial numbers.
            const user = await manager.getRepository(User)
                .createQueryBuilder('user')
                .setLock('pessimistic_write')
                .where('user.id = :userId', { userId })
                .getOne();
            if (!user) return null;

            const receiptRepository = manager.getRepository(Receipt);
            const { maxSerial } = await receiptRepository
                .createQueryBuilder('receipt')
                .select('MAX(receipt.serial_number)', 'maxSerial')
                .where('receipt.user_id = :userId', { userId })
                .getRawOne();

            const newReceipt = receiptRepository.create({
                ...value,
                user_id: userId,
                serial_number: (parseInt(maxSerial, 10) || 0) + 1,
            });
            return receiptRepository.save(newReceipt);
        });

        if (!savedReceipt) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(201).json({
            message: 'Receipt created successfully',
            receipt: savedReceipt,
        });
    } catch (err) {
        console.error('Create receipt error', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getAllReceipts = async (req, res) => {
    try {
        const { error, value } = validate(listQuerySchema, req.query);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userId = req.user.id;
        const {
            type,
            page: pageNumber,
            limit: limitNumber,
            search,
            account_number,
            transaction_id,
            amount,
            status,
            date_from,
            date_to,
        } = value;

        const skip = (pageNumber - 1) * limitNumber;
        const receiptRepository = AppDataSource.getRepository(Receipt);
        const query = receiptRepository
            .createQueryBuilder('receipt')
            .where('receipt.user_id = :userId', { userId });

        if (type) {
            query.andWhere('receipt.save_type = :type', { type });
        }
        if (search) {
            const serial = /^#?\d+$/.test(search) ? parseInt(search.replace('#', ''), 10) : -1;
            query.andWhere(
                `(
          receipt.account_holder LIKE :search OR
          receipt.account_number LIKE :search OR
          receipt.transaction_id LIKE :search OR
          receipt.serial_number = :serial
        )`,
                { search: `%${escapeLike(search)}%`, serial }
            );
        }
        if (status) {
            query.andWhere('receipt.status = :status', { status });
        }
        // Filter on the receipt's own date (the one shown and editable), not on created_at.
        if (date_from) {
            query.andWhere('receipt.date >= :date_from', { date_from: date_from.slice(0, 10) });
        }
        if (date_to) {
            query.andWhere('receipt.date <= :date_to', { date_to: date_to.slice(0, 10) });
        }
        if (account_number) {
            query.andWhere('receipt.account_number = :account_number', { account_number });
        }
        if (transaction_id) {
            query.andWhere('receipt.transaction_id = :transaction_id', { transaction_id });
        }

        if (amount) {
            query.andWhere('receipt.amount = :amount', { amount });
        }
        query.orderBy('receipt.created_at', 'DESC');
        query.skip(skip).take(limitNumber);
        const [receipts, totalCount] = await query.getManyAndCount();
        const totalPages = Math.ceil(totalCount / limitNumber);

        return res.status(200).json({
            message: 'Receipts fetched successfully',
            pagination: {
                total: totalCount,
                page: pageNumber,
                limit: limitNumber,
                totalPages,
                hasNextPage: pageNumber < totalPages,
                hasPrevPage: pageNumber > 1,
            },
            receipts,
        });
    } catch (err) {
        console.error('Get receipts error:', err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
};

const getReceiptById = async (req, res) => {
    try {
        const userId = req.user.id;
        const receiptId = parseId(req.params.id);
        if (!receiptId) {
            return res.status(400).json({ message: 'Invalid receipt id' });
        }
        const receiptRepository = AppDataSource.getRepository(Receipt);
        const receipt = await receiptRepository.findOne({
            where: {
                id: receiptId,
                user_id: userId
            },
        });
        if (!receipt) {
            return res.status(404).json({
                message: 'Receipt not found',
            });
        }
        return res.status(200).json({
            message: 'Receipt fetched successfully',
            receipt,
        });
    } catch (err) {
        console.error('Get receipt error', err);
        return res.status(500).json({
            message: 'Internal server error',
        });
    };
};

const updateReceipt = async (req, res) => {
    try {
        const receiptId = parseId(req.params.id);
        if (!receiptId) {
            return res.status(400).json({ message: 'Invalid receipt id' });
        }
        const { error, value } = validate(updateReceiptSchema, req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const userId = req.user.id;
        const receiptRepository = AppDataSource.getRepository(Receipt);
        const receipt = await receiptRepository.findOne({
            where: { id: receiptId, user_id: userId }
        });
        if (!receipt) {
            return res.status(404).json({ message: 'Receipt not found' });
        }
        Object.assign(receipt, value);
        const updatedReceipt = await receiptRepository.save(receipt);
        return res.status(200).json({
            message: 'Receipt updated successfully',
            receipt: updatedReceipt,
        });
    } catch (err) {
        console.error('Update receipt error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteReceipt = async (req, res) => {
    try {
        const userId = req.user.id;
        const receiptId = parseId(req.params.id);
        if (!receiptId) {
            return res.status(400).json({ message: 'Invalid receipt id' });
        }
        const receiptRepository = AppDataSource.getRepository(Receipt);
        const receipt = await receiptRepository.findOne({
            where: { id: receiptId, user_id: userId }
        });

        if (!receipt) {
            return res.status(404).json({
                message: 'Receipt not found'
            });
        }
        await receiptRepository.remove(receipt);

        return res.status(200).json({
            message: 'Receipt deleted Successfully',
        });
    } catch (err) {
        console.error('Delete Receipt error :', err);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

module.exports = { getDashboardStats, createReceipt, getAllReceipts, getReceiptById, updateReceipt, deleteReceipt };