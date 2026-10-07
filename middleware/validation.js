// Shared Joi options so validation errors read like "Account holder is required"
// instead of '"account_holder" is not allowed to be empty'. Schemas give each key a
// .label(); keys without one fall back to the key name.
const messages = {
    'any.required': '{#label} is required',
    'string.empty': '{#label} is required',
    'string.base': '{#label} must be text',
    'string.min': '{#label} must be at least {#limit} characters',
    'string.max': '{#label} must be at most {#limit} characters',
    'string.email': '{#label} must be a valid email address',
    'number.base': '{#label} must be a number',
    'number.positive': '{#label} must be greater than 0',
    'number.max': '{#label} must be at most {#limit}',
    'number.min': '{#label} must be at least {#limit}',
    'number.integer': '{#label} must be a whole number',
    'number.precision': '{#label} can have at most {#limit} decimal places',
    'date.base': '{#label} must be a valid date',
    'date.format': '{#label} must be a valid date (YYYY-MM-DD)',
    'boolean.base': '{#label} must be true or false',
    'any.only': '{#label} must be one of: {#valids}',
    'object.unknown': '{#label} is not an allowed field',
    'object.min': 'Provide at least one field to update',
    'object.max': '{#label} can have at most {#limit} entries',
    'array.max': '{#label} can have at most {#limit} entries',
    'array.unique': '{#label} contains a duplicate entry',
};

const options = { errors: { wrap: { label: false, array: false } }, messages };

// Returns { error: <first message> | null, value }.
const validate = (schema, data) => {
    const { error, value } = schema.validate(data, options);
    return { error: error ? error.details[0].message : null, value };
};

module.exports = { validate };
