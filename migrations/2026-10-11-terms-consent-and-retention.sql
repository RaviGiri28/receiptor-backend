-- Run ONCE against receiptor_db before starting the updated server.
-- Terms/Privacy consent, account deletion with a recovery period, and inactivity tracking.
ALTER TABLE users
    ADD COLUMN terms_version VARCHAR(20) NULL DEFAULT NULL,
    ADD COLUMN terms_accepted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN deletion_requested_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN last_active_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN inactivity_notice_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN inactivity_reminder_at TIMESTAMP NULL DEFAULT NULL;

-- Existing users start their inactivity clock today, so nobody is warned on day one.
-- (They are asked to accept the Terms on their next visit: terms_version stays NULL.)
UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE last_active_at IS NULL;
