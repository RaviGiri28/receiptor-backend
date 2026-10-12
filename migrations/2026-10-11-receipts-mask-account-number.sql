-- Run ONCE against receiptor_db before starting the updated server.
-- Receipts can print the account number masked (all but the last 5 digits hidden);
-- the full number is still stored.
ALTER TABLE receipts ADD COLUMN mask_account_number TINYINT(1) NOT NULL DEFAULT 0;
