-- SECURITY DEFINER functions to check user role without triggering RLS recursion.
-- These run with the function owner's privileges, bypassing RLS on user_profiles.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;

-- ── Fix user_profiles policies (the recursion source) ──
DROP POLICY IF EXISTS "select_all_profiles_admin" ON user_profiles;
CREATE POLICY "select_all_profiles_admin" ON user_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── Fix products policies ──
DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "auth_delete_products" ON products
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Fix orders policies ──
DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "update_orders" ON orders;
CREATE POLICY "update_orders" ON orders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_staff_or_admin());

-- ── Fix order_items policies ──
DROP POLICY IF EXISTS "select_order_items" ON order_items;
CREATE POLICY "select_order_items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
    OR public.is_staff_or_admin()
  );

-- ── Fix order_status_history policies ──
DROP POLICY IF EXISTS "select_own_order_history" ON order_status_history;
CREATE POLICY "select_own_order_history" ON order_status_history
  FOR SELECT TO authenticated
  USING (
    auth.uid() = (SELECT orders.user_id FROM orders WHERE orders.id = order_status_history.order_id)
    OR public.is_staff_or_admin()
  );