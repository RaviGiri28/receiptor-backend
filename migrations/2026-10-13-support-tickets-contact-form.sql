-- Run ONCE against receiptor_db before starting the updated server.
-- The landing page's Contact form saves messages from visitors without an account.
ALTER TABLE support_tickets MODIFY COLUMN user_id INT NULL;
ALTER TABLE support_tickets ADD COLUMN phone VARCHAR(20) NULL AFTER user_id;
