-- Run ONCE against receiptor_db before starting the updated server.
-- Tokens issued before this time are rejected, so changing the password logs out old sessions.
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL;
