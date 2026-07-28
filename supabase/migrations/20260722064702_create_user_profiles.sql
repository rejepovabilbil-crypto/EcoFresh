/*
# Create user_profiles table for role-based access

1. New Tables
- `user_profiles`
  - `id` (uuid, primary key, references auth.users ON DELETE CASCADE)
  - `email` (text, unique, not null)
  - `full_name` (text, not null)
  - `role` (text, not null, default 'customer') — one of 'admin', 'staff', 'customer'
  - `created_at` (timestamptz, default now())
2. Security
- Enable RLS on `user_profiles`.
- SELECT: authenticated users can read their own profile.
- INSERT: authenticated users can insert their own profile (on signup).
- UPDATE: authenticated users can update their own profile.
- DELETE: authenticated users can delete their own profile.
3. Notes
- Role defaults to 'customer' for new registrations.
- Admin/staff roles are seeded manually for demo accounts.
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile" ON user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON user_profiles;
CREATE POLICY "delete_own_profile" ON user_profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);
