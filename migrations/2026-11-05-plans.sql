-- Run ONCE against receiptor_db before starting the updated server.
-- Plans move from config/plans.js to the database so admins can edit them. Price is in rupees.
CREATE TABLE plans (
    id VARCHAR(20) NOT NULL,
    name VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    days INT NOT NULL,
    months INT NOT NULL,
    best_value TINYINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

INSERT INTO plans (id, name, price, days, months, best_value, sort_order) VALUES
    ('monthly', 'Monthly', 249, 30, 1, 0, 1),
    ('quarterly', '3 Months', 699, 90, 3, 0, 2),
    ('yearly', 'Yearly', 2299, 365, 12, 1, 3);
