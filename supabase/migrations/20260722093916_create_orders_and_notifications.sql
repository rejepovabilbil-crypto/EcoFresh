/*
# Create orders, order_items, and notifications tables + extend user_profiles

1. Modified Tables
- `user_profiles`: add `phone` (text, nullable), `delivery_address` (text, nullable), `emirate` (text, nullable)
  so customers can save a default delivery address on their profile.

2. New Tables
- `orders`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
  - `order_number` (text, unique, not null) — human-readable e.g. ECO-2026-1234
  - `status` (text, not null, default 'Pending') — CHECK in (Pending, Confirmed, Preparing, Packed, Out for Delivery, Delivered, Cancelled)
  - `subtotal` (numeric, not null)
  - `vat` (numeric, not null)
  - `delivery_fee` (numeric, not null)
  - `total` (numeric, not null)
  - `full_name` (text, not null)
  - `phone` (text, nullable)
  - `email` (text, nullable)
  - `delivery_address` (text, not null)
  - `emirate` (text, not null)
  - `delivery_date` (date, nullable)
  - `instructions` (text, nullable)
  - `payment_method` (text, not null)
  - `created_at` (timestamptz, default now())
- `order_items`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `order_id` (uuid, not null, references orders ON DELETE CASCADE)
  - `product_name` (text, not null)
  - `quantity` (integer, not null)
  - `unit_price` (numeric, not null)
  - `line_total` (numeric, not null)
- `notifications`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
  - `message` (text, not null)
  - `order_id` (uuid, nullable, references orders ON DELETE CASCADE)
  - `read` (boolean, not null, default false)
  - `created_at` (timestamptz, default now())

3. Security
- RLS enabled on orders, order_items, notifications.
- orders: owner-scoped CRUD (auth.uid() = user_id).
- order_items: scoped through parent orders table (EXISTS subquery on orders.user_id = auth.uid()).
- notifications: owner-scoped CRUD (auth.uid() = user_id).

4. Indexes
- orders(user_id) for per-user listing.
- order_items(order_id) for join performance.
- notifications(user_id) for per-user listing.

5. Notes
- All owner columns default to auth.uid() so frontend inserts that omit user_id still pass RLS.
- order_items has no direct user_id; access is gated through the parent order's ownership.
*/

-- Extend user_profiles with delivery fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'phone') THEN
    ALTER TABLE user_profiles ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'delivery_address') THEN
    ALTER TABLE user_profiles ADD COLUMN delivery_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'emirate') THEN
    ALTER TABLE user_profiles ADD COLUMN emirate text;
  END IF;
END $$;

-- orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Confirmed','Preparing','Packed','Out for Delivery','Delivered','Cancelled')),
  subtotal numeric(10,2) NOT NULL,
  vat numeric(10,2) NOT NULL,
  delivery_fee numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  delivery_address text NOT NULL,
  emirate text NOT NULL,
  delivery_date date,
  instructions text,
  payment_method text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_orders" ON orders;
CREATE POLICY "delete_own_orders" ON orders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(10,2) NOT NULL
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
CREATE POLICY "insert_own_order_items" ON order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_order_items" ON order_items;
CREATE POLICY "update_own_order_items" ON order_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_order_items" ON order_items;
CREATE POLICY "delete_own_order_items" ON order_items
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

-- notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
