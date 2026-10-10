-- Run ONCE against receiptor_db before starting the updated server.
-- History now lists printed receipts (is_printed) and Saved Receipts lists save_type = 'saved';
-- a printed Pending receipt stays saved, so it appears in both.
ALTER TABLE receipts ADD COLUMN is_printed TINYINT(1) NOT NULL DEFAULT 0;

UPDATE receipts SET is_printed = 1 WHERE save_type = 'printed';

-- Pending receipts that were printed earlier go back to Saved Receipts.
UPDATE receipts SET save_type = 'saved' WHERE save_type = 'printed' AND status = 'Pending';
