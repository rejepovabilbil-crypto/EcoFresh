/*
# Enhance Inventory Management on products table (Stage 11)

## Overview
Adds three new columns to the existing `products` table for richer
inventory tracking — reserved stock, damaged stock, and max stock level —
plus a CHECK constraint to prevent negative stock, and an updated
decrement trigger that refuses to let stock go below zero.

## 1. New Columns on `products`

| Column             | Type    | Default | Description                                      |
|--------------------|---------|---------|--------------------------------------------------|
| max_stock          | integer | 100     | Upper threshold — above this is "Overstocked"   |
| reserved_quantity  | integer | 0       | Stock committed to unconfirmed orders            |
| damaged_quantity   | integer | 0       | Stock marked damaged / unsellable                |

`min_stock` already exists from a prior migration.

## 2. Computed Inventory Status (not stored)
The frontend computes one of:
  - "Out of Stock"  — available = 0
  - "Low Stock"      — 0 < available < min_stock
  - "Overstocked"   — available > max_stock
  - "In Stock"       — everything else
where `available = stock - reserved_quantity - damaged_quantity`.

## 3. CHECK Constraints
  - `stock >= 0`
  - `reserved_quantity >= 0`
  - `damaged_quantity >= 0`
  - `damaged_quantity <= stock` (can't damage more than you have)

## 4. Trigger Update
  - `decrement_stock_on_order()`: now guards against negative stock —
    only decrements if `stock >= NEW.quantity`; otherwise raises an
    exception so the order item insert fails loudly rather than
    silently producing negative stock.
  - `restore_stock_on_cancel()`: unchanged logic, already safe.

## 5. Backfill
  - All existing products get max_stock = 100, reserved_quantity = 0,
    damaged_quantity = 0.

## 6. Security
  - No RLS policy changes — existing policies already allow
    authenticated users to manage products.
*/

-- ── Add columns ──
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS max_stock integer NOT NULL DEFAULT 100;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS damaged_quantity integer NOT NULL DEFAULT 0;

-- ── Backfill ──
UPDATE products SET max_stock = 100 WHERE max_stock IS NULL;
UPDATE products SET reserved_quantity = 0 WHERE reserved_quantity IS NULL;
UPDATE products SET damaged_quantity = 0 WHERE damaged_quantity IS NULL;

-- ── CHECK constraints (drop first for idempotency) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_stock_nonnegative' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_reserved_nonnegative' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_reserved_nonnegative CHECK (reserved_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_damaged_nonnegative' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_damaged_nonnegative CHECK (damaged_quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_damaged_le_stock' AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_damaged_le_stock CHECK (damaged_quantity <= stock);
  END IF;
END $$;

-- ── Updated decrement trigger (prevents negative stock) ──
CREATE OR REPLACE FUNCTION decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock integer;
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT stock INTO current_stock FROM products WHERE id = NEW.product_id FOR UPDATE;

    IF current_stock IS NULL THEN
      RETURN NEW;
    END IF;

    IF current_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Available: %, requested: %',
        NEW.product_id, current_stock, NEW.quantity
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE products
    SET stock = stock - NEW.quantity,
        status = CASE WHEN stock - NEW.quantity <= 0 THEN 'Out of Stock' ELSE 'In Stock' END
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- restore_stock_on_cancel is unchanged but re-created for completeness
CREATE OR REPLACE FUNCTION restore_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Cancelled' AND OLD.status <> 'Cancelled' THEN
    UPDATE products
    SET stock = stock + oi.quantity,
        status = CASE WHEN stock + oi.quantity > 0 THEN 'In Stock' ELSE 'Out of Stock' END
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = products.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Comments ──
COMMENT ON COLUMN products.max_stock IS 'Upper stock threshold; above this is considered overstocked';
COMMENT ON COLUMN products.reserved_quantity IS 'Stock committed to unconfirmed orders, not yet sellable';
COMMENT ON COLUMN products.damaged_quantity IS 'Stock marked as damaged or unsellable';