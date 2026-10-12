-- Run ONCE against receiptor_db before starting the updated server.
-- Forgot password: the hash of the emailed one-time reset token, and its expiry.
ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(64) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP NULL DEFAULT NULL;
CREATE INDEX idx_users_password_reset_token_hash ON users (password_reset_token_hash);
