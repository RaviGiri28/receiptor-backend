-- Run ONCE against receiptor_db before starting the updated server.
-- Single-device login: each login gets a new session id; tokens of older sessions are
-- rejected with code SESSION_REPLACED, so the previous device is signed out.
ALTER TABLE users ADD COLUMN session_id VARCHAR(36) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN session_started_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN session_device VARCHAR(100) NULL DEFAULT NULL;
