-- Run ONCE against receiptor_db before starting the updated server.
-- Admin "deactivate account": a deactivated user keeps read access to past receipts
-- but cannot create or edit receipts. reactivated_at drives the "reactivated" notification.
ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN reactivated_at TIMESTAMP NULL DEFAULT NULL;
