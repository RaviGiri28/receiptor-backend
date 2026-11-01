-- Run ONCE against receiptor_db before starting the updated server.
-- Subscriptions: free trial (7 days, or a coupon's days) and paid plans. Existing accounts
-- get plan = NULL: they see a popup with the "existing users" coupon to start a trial.
ALTER TABLE users ADD COLUMN plan VARCHAR(10) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN plan_id VARCHAR(20) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN plan_started_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN trial_days_pending INT NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN expiry_reminder_for TIMESTAMP NULL DEFAULT NULL;

CREATE TABLE coupons (
    id INT NOT NULL AUTO_INCREMENT,
    code VARCHAR(30) NOT NULL,
    trial_days INT NOT NULL,
    audience VARCHAR(10) NOT NULL DEFAULT 'signup',
    max_uses INT NULL DEFAULT NULL,
    used_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    note VARCHAR(255) NULL DEFAULT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY UQ_coupon_code (code)
);

CREATE TABLE coupon_redemptions (
    id INT NOT NULL AUTO_INCREMENT,
    coupon_id INT NOT NULL,
    user_id INT NOT NULL,
    trial_days INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY UQ_coupon_redemption (coupon_id, user_id),
    CONSTRAINT FK_redemption_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
    CONSTRAINT FK_redemption_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- The 15-day offer for existing users (shown in their popup). Change or add codes in Admin > Coupons.
INSERT INTO coupons (code, trial_days, audience, note) VALUES ('WELCOME15', 15, 'existing', 'Existing users: 15-day trial');
