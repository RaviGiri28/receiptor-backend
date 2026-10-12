const { AppDataSource } = require('../config/db');
const SupportTicket = require('../entity/SupportTicket');
const User = require('../entity/User');
const joi = require('joi');
const { validate } = require('../middleware/validation');
const { sendSupportEmail } = require('../config/mailer');

const ticketSchema = joi.object({
    name: joi.string().trim().min(2).max(100).required().label('Name'),
    email: joi.string().trim().email().max(100).required().label('Email'),
    subject: joi.string().trim().min(3).max(150).required().label('Subject'),
    message: joi.string().trim().min(10).max(5000).required().label('Message'),
});

const contactSchema = joi.object({
    name: joi.string().trim().min(2).max(100).required().label('Name'),
    email: joi.string().trim().email().max(100).required().label('Email'),
    phone: joi.string().trim().pattern(/^[+\d][\d\s-]{6,19}$/).allow('').default('').label('Phone')
        .messages({ 'string.pattern.base': 'Phone must be a valid phone number' }),
    subject: joi.string().trim().min(3).max(150).required().label('Subject'),
    message: joi.string().trim().min(10).max(5000).required().label('Message'),
    // Honeypot: hidden on the form, so only bots fill it in.
    website: joi.string().allow('').max(200).default('').label('Website'),
});

// Landing-page Contact form: same inbox as support tickets, for visitors without an account.
const createContactMessage = async (req, res) => {
    try {
        const { error, value } = validate(contactSchema, req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const { website, ...fields } = value;
        // Bots get the same answer as people, so they don't learn to skip the field.
        if (website) {
            return res.status(201).json({ message: 'Your message has been sent' });
        }

        const ticketRepository = AppDataSource.getRepository(SupportTicket);
        const ticket = await ticketRepository.save(ticketRepository.create({
            ...fields,
            phone: fields.phone || null,
            user_id: null,
        }));

        res.status(201).json({ message: 'Your message has been sent', ticketId: ticket.id });

        sendSupportEmail(ticket, null)
            .then(() => ticketRepository.update({ id: ticket.id }, { email_sent: true }))
            .catch((err) => console.error(`Contact email for ticket #${ticket.id} failed:`, err.message || err));
    } catch (err) {
        console.error('Create contact message error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const createTicket = async (req, res) => {
    try {
        const { error, value } = validate(ticketSchema, req.body);
        if (error) {
            return res.status(400).json({ message: error });
        }
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const ticketRepository = AppDataSource.getRepository(SupportTicket);
        const ticket = await ticketRepository.save(ticketRepository.create({ ...value, user_id: user.id }));

        // The ticket is safely stored; email it after responding so the user doesn't wait
        // on SMTP. A failed email leaves email_sent = false for a later look.
        res.status(201).json({ message: 'Your message has been sent', ticketId: ticket.id });

        sendSupportEmail(ticket, user)
            .then(() => ticketRepository.update({ id: ticket.id }, { email_sent: true }))
            .catch((err) => console.error(`Support email for ticket #${ticket.id} failed:`, err.message || err));
    } catch (err) {
        console.error('Create support ticket error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { createTicket, createContactMessage };
