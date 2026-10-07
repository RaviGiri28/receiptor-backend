-- Run ONCE against receiptor_db before starting the updated server.
-- Columns from the Cloudinary logo and receipt custom-fields features that were only ever
-- created by TypeORM synchronize (now opt-in), so databases set up earlier can lack them.
ALTER TABLE users ADD COLUMN business_logo_public_id VARCHAR(255) NULL;
ALTER TABLE receipts ADD COLUMN custom_fields JSON NULL;
