-- Run ONCE against receiptor_db before starting the updated server.
-- Optional 4-digit app passcode (bcrypt hash), asked when the app is opened and before deleting a receipt.
ALTER TABLE users ADD COLUMN app_passcode VARCHAR(255) NULL DEFAULT NULL;
