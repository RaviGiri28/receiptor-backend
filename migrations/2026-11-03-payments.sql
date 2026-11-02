-- Run ONCE against receiptor_db before starting the updated server.
-- One row per Razorpay order. amount is in paise.
CREATE TABLE payments (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    plan_id VARCHAR(20) NOT NULL,
    amount INT NOT NULL,
    razorpay_order_id VARCHAR(40) NOT NULL,
    razorpay_payment_id VARCHAR(40) NULL DEFAULT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'created',
    paid_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY UQ_payment_order (razorpay_order_id),
    CONSTRAINT FK_payment_user FOREIGN KEY (user_id) REFERENCES users (id)
);
