-- Run ONCE against receiptor_db, after 2026-11-03-payments.sql.
-- Erasing an account must not be blocked by its payments. The payment record stays for
-- accounting, without the link to the erased account.
ALTER TABLE payments DROP FOREIGN KEY FK_payment_user;
ALTER TABLE payments MODIFY user_id INT NULL;
ALTER TABLE payments ADD CONSTRAINT FK_payment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;
