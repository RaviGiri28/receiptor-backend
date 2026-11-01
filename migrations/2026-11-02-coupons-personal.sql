-- Run ONCE against receiptor_db before starting the updated server.
-- Personal coupons: an admin creates a coupon from the Users page that only one account
-- can use (audience = 'personal'). Deleting the account deletes its personal coupons.
ALTER TABLE coupons ADD COLUMN user_id INT NULL DEFAULT NULL;
ALTER TABLE coupons ADD CONSTRAINT FK_coupon_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
