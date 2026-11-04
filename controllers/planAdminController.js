const joi = require('joi');
const { validate } = require('../middleware/validation');
const { getPlans, findPlan, updatePlan } = require('../services/plans');

// GET /api/admin/plans
const list = async (req, res, next) => {
    try {
        return res.json({ plans: await getPlans() });
    } catch (err) {
        next(err);
    }
};

const planSchema = joi.object({
    name: joi.string().trim().min(1).max(50).required().label('Name'),
    // Razorpay's smallest payment is Rs. 1.
    price: joi.number().integer().min(1).max(1000000).required().label('Price'),
    days: joi.number().integer().min(1).max(3650).required().label('Days'),
});

// PUT /api/admin/plans/:id { name, price, days }: applies to new purchases only. Plans already
// bought keep their end date, and an order already started keeps the amount it was created with.
const update = async (req, res, next) => {
    try {
        const { error, value } = validate(planSchema, req.body);
        if (error) return res.status(400).json({ message: error });
        if (!(await findPlan(req.params.id))) return res.status(404).json({ message: 'Plan not found' });
        return res.json({ plan: await updatePlan(req.params.id, value) });
    } catch (err) {
        next(err);
    }
};

module.exports = { list, update };
