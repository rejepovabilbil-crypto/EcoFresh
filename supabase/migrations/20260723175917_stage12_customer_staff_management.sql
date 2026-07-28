/*
# Stage 12 — Customer & Staff Management: account status + admin profile updates

## Overview
Adds an `is_active` account-status flag to `user_profiles` so admins can
suspend/deactivate customer and staff accounts, and grants admins the
ability to update any user profile (needed to toggle status and manage
staff). Uses the existing `is_admin()` SECURITY DEFINER function to
avoid RLS recursion (same pattern fixed earlier).

## 1. Modified Table: user_profiles
| Column     | Type    | Default | Description                          |
|------------|---------|---------|--------------------------------------|
| is_active  | boolean | true    | Whether the account is active.       |

When `is_active = false` the account is considered suspended/deactivated.
Existing rows backfill to `true` so no data is lost.

## 2. Security (RLS)
- New UPDATE policy `update_any_profile_admin`: admins can update ANY
  user_profiles row (toggle is_active, edit name/phone, etc.). Uses
  `public.is_admin()` to avoid recursion.
- The existing `update_own_profile` policy remains so non-admin users
  can still edit their own profile. Multiple UPDATE policies are OR-ed.

## 3. Notes
- Deactivating an account does NOT delete it; the admin can re-activate.
- This flag is the app-level status surfaced in the admin UI.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DROP POLICY IF EXISTS "update_any_profile_admin" ON user_profiles;
CREATE POLICY "update_any_profile_admin" ON user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
