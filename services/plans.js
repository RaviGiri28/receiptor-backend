// The plans on sale, read from the database so an admin's change applies straight away.
const { AppDataSource } = require('../config/db');
const Plan = require('../entity/Plan');

const toJson = ({ id, name, price, days, months, best_value }) => ({ id, name, price, days, months, best_value });

const getPlans = async () =>
    (await AppDataSource.getRepository(Plan).find({ order: { sort_order: 'ASC' } })).map(toJson);

const findPlan = async (id) => {
    const plan = await AppDataSource.getRepository(Plan).findOne({ where: { id } });
    return plan ? toJson(plan) : null;
};

// The screens show "/ 3 months" and a per-month price, so months follows the days.
const monthsFor = (days) => Math.max(1, Math.round(days / 30));

const updatePlan = async (id, { name, price, days }) => {
    await AppDataSource.getRepository(Plan).update({ id }, { name, price, days, months: monthsFor(days) });
    return findPlan(id);
};

module.exports = { getPlans, findPlan, updatePlan };
