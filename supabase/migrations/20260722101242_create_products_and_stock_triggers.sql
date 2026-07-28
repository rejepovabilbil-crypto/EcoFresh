/*
# Create products table with stock management triggers

1. New Tables
- `products`
  - `id` (text, primary key) — matches existing product slugs e.g. 'butterhead-lettuce'
  - `name` (text, not null)
  - `category` (text, not null)
  - `description` (text, not null)
  - `price` (numeric, not null)
  - `unit` (text, not null)
  - `stock` (integer, not null, default 0)
  - `image` (text, not null)
  - `featured` (boolean, default false)
  - `status` (text, not null, default 'In Stock') — CHECK in ('In Stock', 'Out of Stock')
  - `created_at` (timestamptz, default now())

2. Modified Tables
- `order_items`: add `product_id` (text, nullable, references products(id) ON DELETE SET NULL)
  so the stock-management trigger can locate the product to decrement/restore.

3. Trigger Functions
- `decrement_stock_on_order()`: AFTER INSERT on order_items — reduces products.stock by the
  ordered quantity. If stock reaches 0, sets products.status to 'Out of Stock'.
  Runs as SECURITY DEFINER so it can update products regardless of the caller's RLS.
- `restore_stock_on_cancel()`: AFTER UPDATE on orders — when status transitions TO 'Cancelled'
  from a non-cancelled status, restores stock for every item in that order. If stock was 0 and
  is now > 0, sets products.status back to 'In Stock'.
  Runs as SECURITY DEFINER. Guards against double-restoration by checking OLD.status <> 'Cancelled'.

4. Triggers
- `trg_decrement_stock` on order_items AFTER INSERT → calls decrement_stock_on_order()
- `trg_restore_stock` on orders AFTER UPDATE → calls restore_stock_on_cancel()

5. Security
- RLS enabled on products.
- SELECT: public (anon, authenticated) — shop listings must be visible to all visitors.
- INSERT/UPDATE/DELETE: authenticated only — admin/staff management (no ownership check needed
  since these are shared catalog rows; the app has a sign-in screen so authenticated is correct).

6. Data
- Seeds the products table with all 15 existing products from the static catalog, preserving
  their IDs, stock counts, and featured flags.

7. Important Notes
- The decrement trigger fires per-row on bulk order_items INSERT, so multi-item orders are
  handled correctly.
- The restore trigger only fires when status changes to 'Cancelled' (not on other status
  transitions), preventing accidental stock restoration.
- Both trigger functions are SECURITY DEFINER to bypass RLS on the products table, since the
  inserting user may not have UPDATE permission on products.
*/

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  price numeric(10,2) NOT NULL,
  unit text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  image text NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'In Stock' CHECK (status IN ('In Stock', 'Out of Stock')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "auth_delete_products" ON products
  FOR DELETE TO authenticated USING (true);

-- Add product_id to order_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_id') THEN
    ALTER TABLE order_items ADD COLUMN product_id text REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Seed products
INSERT INTO products (id, name, category, description, price, unit, stock, image, featured, status) VALUES
  ('butterhead-lettuce', 'Butterhead Lettuce', 'Leafy Greens', 'Tender, buttery leaves with a delicate sweet flavor, perfect for salads and wraps.', 6.50, 'per head', 24, 'https://images.pexels.com/photos/37154679/pexels-photo-37154679.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'In Stock'),
  ('romaine-lettuce', 'Romaine Lettuce', 'Leafy Greens', 'Crisp, crunchy romaine hearts with a refreshing taste, ideal for Caesar salads.', 5.50, 'per head', 18, 'https://images.pexels.com/photos/5202194/pexels-photo-5202194.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'In Stock'),
  ('kale-bunch', 'Kale Bunch', 'Leafy Greens', 'Nutrient-dense curly kale with deep green leaves, packed with vitamins and antioxidants.', 7.00, 'per bunch', 14, 'https://images.pexels.com/photos/6632211/pexels-photo-6632211.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'In Stock'),
  ('swiss-chard', 'Swiss Chard', 'Leafy Greens', 'Vibrant rainbow chard with glossy leaves and colorful stems, mild and earthy.', 6.00, 'per bunch', 9, 'https://images.pexels.com/photos/32635106/pexels-photo-32635106.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'In Stock'),
  ('spinach', 'Spinach', 'Leafy Greens', 'Fresh, tender baby spinach leaves with a mild flavor, great for smoothies and sautés.', 5.00, 'per bag', 22, 'https://images.pexels.com/photos/4506881/pexels-photo-4506881.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'In Stock'),
  ('arugula', 'Arugula', 'Leafy Greens', 'Peppery, bold-flavored arugula leaves that add a zesty kick to any dish.', 5.50, 'per bag', 16, 'https://images.pexels.com/photos/4519012/pexels-photo-4519012.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'In Stock'),
  ('fresh-basil', 'Fresh Basil', 'Herbs', 'Aromatic sweet basil with fragrant leaves, essential for pesto and Italian cuisine.', 5.00, 'per bunch', 20, 'https://images.pexels.com/photos/11789833/pexels-photo-11789833.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'In Stock'),
  ('mint-leaves', 'Mint Leaves', 'Herbs', 'Cool, refreshing mint leaves perfect for teas, mocktails, and Middle Eastern dishes.', 4.00, 'per bunch', 15, 'https://images.pexels.com/photos/36435666/pexels-photo-36435666.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'In Stock'),
  ('cilantro', 'Cilantro', 'Herbs', 'Bright, citrusy cilantro leaves that elevate salsas, curries, and garnishes.', 3.50, 'per bunch', 0, 'https://images.pexels.com/photos/10048317/pexels-photo-10048317.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'Out of Stock'),
  ('microgreens-mix', 'Microgreens Mix', 'Microgreens', 'A vibrant blend of nutrient-packed microgreens with intense flavor and crunch.', 12.00, 'per tray', 12, 'https://images.pexels.com/photos/8543138/pexels-photo-8543138.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'In Stock'),
  ('radish-microgreens', 'Radish Microgreens', 'Microgreens', 'Spicy, crisp radish microgreens that add a peppery punch and vibrant color.', 10.00, 'per tray', 7, 'https://images.pexels.com/photos/15874888/pexels-photo-15874888.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'In Stock'),
  ('sunflower-microgreens', 'Sunflower Microgreens', 'Microgreens', 'Nutty, crunchy sunflower microgreens with a satisfying texture and rich nutrients.', 11.00, 'per tray', 10, 'https://images.pexels.com/photos/9031151/pexels-photo-9031151.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'In Stock'),
  ('cherry-tomatoes', 'Cherry Tomatoes', 'Fruiting Plants', 'Sweet, juicy cherry tomatoes grown hydroponically for concentrated flavor year-round.', 14.00, 'per punnet', 30, 'https://images.pexels.com/photos/30825690/pexels-photo-30825690.jpeg?auto=compress&cs=tinysrgb&w=800', true, 'In Stock'),
  ('bell-peppers', 'Bell Peppers', 'Fruiting Plants', 'Crisp, colorful bell peppers with thick walls and a sweet, refreshing crunch.', 8.00, 'per piece', 5, 'https://images.pexels.com/photos/35614119/pexels-photo-35614119.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'In Stock'),
  ('strawberries', 'Strawberries', 'Fruiting Plants', 'Plump, aromatic strawberries grown vertically for peak sweetness and freshness.', 18.00, 'per punnet', 0, 'https://images.pexels.com/photos/36950051/pexels-photo-36950051.jpeg?auto=compress&cs=tinysrgb&w=800', false, 'Out of Stock')
ON CONFLICT (id) DO NOTHING;

-- Trigger function: decrement stock when order_items are inserted
CREATE OR REPLACE FUNCTION decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE products
    SET stock = stock - NEW.quantity,
        status = CASE WHEN stock - NEW.quantity <= 0 THEN 'Out of Stock' ELSE 'In Stock' END
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock ON order_items;
CREATE TRIGGER trg_decrement_stock
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION decrement_stock_on_order();

-- Trigger function: restore stock when order status changes to Cancelled
CREATE OR REPLACE FUNCTION restore_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only restore when transitioning TO Cancelled from a non-Cancelled status
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

DROP TRIGGER IF EXISTS trg_restore_stock ON orders;
CREATE TRIGGER trg_restore_stock
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION restore_stock_on_cancel();