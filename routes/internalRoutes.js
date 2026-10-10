const express = require('express');
const crypto = require('crypto');
const { runRetention } = require('../services/retention');

const router = express.Router();

// Only the daily scheduler (e.g. cron-job.org) may call these: it must send the header
// X-Internal-Token = INTERNAL_TASK_TOKEN. Without that env var the routes are closed.
const fromScheduler = (req) => {
    const expected = process.env.INTERNAL_TASK_TOKEN;
    const given = req.get('x-internal-token');
    return Boolean(expected && given && given.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected)));
};

router.get('/retention', async (req, res) => {
    if (!fromScheduler(req)) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        return res.status(200).json(await runRetention());
    } catch (err) {
        console.error('Retention run failed:', err);
        return res.status(500).json({ message: 'Retention run failed' });
    }
});

module.exports = router;
