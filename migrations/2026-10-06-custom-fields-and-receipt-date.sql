-- Run ONCE against receiptor_db before starting the updated server.

-- Custom receipt field definitions move from each browser's localStorage to the account.
-- NULL means "never saved"; the frontend then uploads the definitions it has locally.
ALTER TABLE users ADD COLUMN custom_field_defs JSON NULL;

-- History date filters and the dashboard's "today" count now use receipts.date.
CREATE INDEX IDX_receipt_user_date ON receipts (user_id, date);
