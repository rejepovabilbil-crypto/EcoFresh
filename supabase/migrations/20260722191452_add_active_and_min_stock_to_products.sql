-- Add active (boolean) and min_stock (integer) columns to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 5;

-- Backfill: existing products are all active, min_stock defaults to 5
UPDATE products SET active = true WHERE active IS NULL;
UPDATE products SET min_stock = 5 WHERE min_stock IS NULL;

-- Add comment
COMMENT ON COLUMN products.active IS 'Whether the product is visible in the customer-facing shop';
COMMENT ON COLUMN products.min_stock IS 'Minimum stock threshold for low-stock alerts';