-- Run ONCE against receiptor_db before starting the updated server.
-- Marks the receipt printed during the guided tour, which the tour deletes again.
ALTER TABLE receipts ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0;
