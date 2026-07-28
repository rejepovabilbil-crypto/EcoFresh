-- Allow admins to SELECT all user_profiles (for customer count, staff management, etc.)
-- The existing select_own_profile policy remains for non-admin users to read their own row.
CREATE POLICY "select_all_profiles_admin"
  ON user_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  );