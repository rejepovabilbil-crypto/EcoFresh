/*
# Stage 7 — Order Tracking: status history table, triggers, RLS for staff/admin

1. New Tables
- `order_status_history`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `order_id` (uuid, not null, references orders ON DELETE CASCADE)
  - `status` (text, not null) — the new status value
  - `changed_at` (timestamptz, default now())
  - `changed_by` (uuid, nullable, references auth.users ON DELETE SET NULL) — who made the change

2. Trigger Functions
- `log_order_status_change()`: AFTER INSERT OR UPDATE on orders — if the status column
  changed (or a new order was inserted), inserts a row into order_status_history with
  the new status, current timestamp, and the acting user's auth.uid().
  Runs as SECURITY DEFINER so it can insert into order_status_history regardless of RLS.

3. Triggers
- `trg_log_order_status` on orders AFTER INSERT OR UPDATE → calls log_order_status_change()

4. Security — RLS policy changes
- `orders` table: add SELECT/UPDATE policies for staff and admin roles so they can
  view and update ALL orders (not just their own). Customer policies remain owner-scoped.
- `order_items` table: add SELECT policy for staff/admin so they can view items for any order.
- `order_status_history` table: RLS enabled.
  - SELECT: authenticated users can read history for their own orders; staff/admin can read all.
  - INSERT: only via the trigger (SECURITY DEFINER), no direct client inserts.
  - No UPDATE or DELETE from clients.

5. Realtime
- Add orders table to the realtime publication so frontend subscriptions work.

6. Data
- Update two existing test orders to different statuses (one to 'Preparing', one to
  'Out for Delivery') so the timeline can be demonstrated at different stages.
- Insert initial status history rows for existing orders based on their current status.

7. Important Notes
- The status CHECK constraint on orders already includes all required statuses:
  Pending, Confirmed, Preparing, Packed, Out for Delivery, Delivered, Cancelled.
- The trigger fires on both INSERT (new order → logs 'Pending') and UPDATE (status change).
- staff/admin RLS uses a subquery on user_profiles to check the role.
*/

-- order_status_history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Customers can read history for their own orders; staff/admin can read all
DROP POLICY IF EXISTS "select_own_order_history" ON order_status_history;
CREATE POLICY "select_own_order_history" ON order_status_history
  FOR SELECT TO authenticated USING (
    auth.uid() = (SELECT user_id FROM orders WHERE orders.id = order_status_history.order_id)
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'staff')
    )
  );

-- Update orders RLS: allow staff/admin to SELECT all orders
DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_orders" ON orders
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'staff')
    )
  );

-- Replace the existing update policy to also allow staff/admin
DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_orders" ON orders
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'staff')
    )
  );

-- Update order_items: allow staff/admin to SELECT all order items
DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_order_items" ON order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'staff')
    )
  );

-- Trigger function: log status changes to order_status_history
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status ON orders;
CREATE TRIGGER trg_log_order_status
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- Enable realtime on orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;

-- Update test orders to different statuses for demo
UPDATE orders SET status = 'Preparing' WHERE order_number = 'ECO-2026-1280';
UPDATE orders SET status = 'Out for Delivery' WHERE order_number = 'ECO-2026-9992';

-- Seed initial status history for existing orders
INSERT INTO order_status_history (order_id, status, changed_by, changed_at)
SELECT id, status, user_id, created_at FROM orders
WHERE id NOT IN (SELECT DISTINCT order_id FROM order_status_history)
ON CONFLICT DO NOTHING;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);