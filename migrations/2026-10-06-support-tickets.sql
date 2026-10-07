-- Run ONCE against receiptor_db before starting the updated server.
-- Messages sent from the Support page.
CREATE TABLE support_tickets (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    subject VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    email_sent TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY IDX_support_ticket_user (user_id),
    CONSTRAINT FK_support_ticket_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
