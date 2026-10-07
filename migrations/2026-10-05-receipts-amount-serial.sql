-- Run ONCE against receiptor_db BEFORE starting the updated server.
-- TypeORM's synchronize changes a column's type by dropping and re-adding it,
-- which would wipe existing amounts; this converts them in place instead.

-- amount: varchar(255) -> decimal(10,2), keeping values
ALTER TABLE receipts MODIFY amount DECIMAL(10,2) NOT NULL;

-- backfill per-user serial numbers for existing receipts (oldest = 1)
UPDATE receipts r
JOIN (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
    FROM receipts
) numbered ON numbered.id = r.id
SET r.serial_number = numbered.rn
WHERE r.serial_number IS NULL;
