/*
# Create crop_batches table for Crop Management (Stage 10)

## Overview
Adds a new `crop_batches` table to track farm crop batches through their
lifecycle — from planting to harvest — with zone assignments, staff
ownership, health monitoring, and yield tracking. Includes a harvest
workflow that links harvested batches back to the products inventory.

## 1. New Table: crop_batches

| Column                  | Type      | Description                                           |
|-------------------------|-----------|-------------------------------------------------------|
| id                      | uuid (PK) | Primary key                                            |
| batch_number            | text (UQ) | Auto-generated unique batch number (CROP-YYYY-NNN)   |
| crop_name               | text      | Name of the crop (e.g. "Romaine Lettuce")             |
| variety                 | text      | Optional variety detail (e.g. "Paris Island")         |
| zone                    | text      | Growing zone (e.g. "Zone A")                          |
| planting_date           | date      | When the batch was planted                            |
| expected_harvest_date   | date      | Expected harvest date                                 |
| assigned_staff          | uuid (FK) | Staff member responsible (user_profiles.id)           |
| stage                   | text      | Lifecycle stage (Planned/Seedling/Growing/Ready for   |
|                         |           |   Harvest/Harvesting/Harvested/Failed)                 |
| health_status           | text      | Health (Healthy/Needs Attention/Critical)             |
| expected_yield          | numeric   | Expected yield amount                                 |
| yield_unit              | text      | Unit for yield (e.g. "kg", "bunches", "trays")        |
| actual_yield            | numeric   | Actual yield (nullable until harvested)              |
| added_to_inventory      | boolean   | Whether harvest has been added to product stock       |
| created_at              | timestamptz | Record creation timestamp                           |
| updated_at              | timestamptz | Last update timestamp                                |

## 2. Constraints
- `batch_number` is UNIQUE.
- `stage` is CHECK-constrained to valid lifecycle stages.
- `health_status` is CHECK-constrained to valid health values.
- `assigned_staff` references `user_profiles(id)` with ON DELETE SET NULL.

## 3. Security (RLS)
- Enabled on `crop_batches`.
- SELECT: any authenticated user (admin + staff) can view all batches.
- INSERT: admin and staff can create batches.
- UPDATE: admin can update any batch; staff can update only batches
  assigned to them. Uses `is_admin()` SECURITY DEFINER function to
  avoid RLS recursion (same pattern as the earlier fix).
- DELETE: admin only.

## 4. Indexes
- Index on `assigned_staff` for staff-scoped queries.
- Index on `stage` for filtering by lifecycle stage.
- Index on `zone` for zone-based queries.

## 5. Trigger
- `updated_at` auto-update trigger on UPDATE.

## 6. Sample Data
- 5 crop batches across different zones and stages, using produce
  already in the catalogue (Romaine Lettuce, Kale Bunch, Spinach,
  Fresh Basil, Cherry Tomatoes). Assigned to the staff demo user.
*/

-- ── Table ──
CREATE TABLE IF NOT EXISTS crop_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text UNIQUE NOT NULL,
  crop_name text NOT NULL,
  variety text,
  zone text NOT NULL,
  planting_date date NOT NULL,
  expected_harvest_date date NOT NULL,
  assigned_staff uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'Planned'
    CHECK (stage IN ('Planned', 'Seedling', 'Growing', 'Ready for Harvest', 'Harvesting', 'Harvested', 'Failed')),
  health_status text NOT NULL DEFAULT 'Healthy'
    CHECK (health_status IN ('Healthy', 'Needs Attention', 'Critical')),
  expected_yield numeric NOT NULL DEFAULT 0,
  yield_unit text NOT NULL DEFAULT 'kg',
  actual_yield numeric,
  added_to_inventory boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crop_batches ENABLE ROW LEVEL SECURITY;

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_crop_batches_assigned_staff ON crop_batches(assigned_staff);
CREATE INDEX IF NOT EXISTS idx_crop_batches_stage ON crop_batches(stage);
CREATE INDEX IF NOT EXISTS idx_crop_batches_zone ON crop_batches(zone);

-- ── updated_at trigger ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crop_batches_updated_at ON crop_batches;
CREATE TRIGGER trg_crop_batches_updated_at
  BEFORE UPDATE ON crop_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── RLS Policies ──
-- SELECT: admin and staff can view all batches
DROP POLICY IF EXISTS "select_crop_batches" ON crop_batches;
CREATE POLICY "select_crop_batches" ON crop_batches
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_staff_or_admin());

-- INSERT: admin and staff can create batches
DROP POLICY IF EXISTS "insert_crop_batches" ON crop_batches;
CREATE POLICY "insert_crop_batches" ON crop_batches
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_staff_or_admin());

-- UPDATE: admin can update any; staff can update only their assigned batches
DROP POLICY IF EXISTS "update_crop_batches" ON crop_batches;
CREATE POLICY "update_crop_batches" ON crop_batches
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR assigned_staff = auth.uid())
  WITH CHECK (public.is_admin() OR assigned_staff = auth.uid());

-- DELETE: admin only
DROP POLICY IF EXISTS "delete_crop_batches" ON crop_batches;
CREATE POLICY "delete_crop_batches" ON crop_batches
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Batch number generator ──
-- SECURITY DEFINER so staff (not just admin) can get the next sequence value
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CROP-' || EXTRACT(YEAR FROM now())::text || '-' ||
         LPAD((SELECT COALESCE(MAX(CAST(SUBSTRING(batch_number FROM 11) AS integer)), 0) + 1
               FROM crop_batches
               WHERE batch_number LIKE 'CROP-' || EXTRACT(YEAR FROM now())::text || '-%')::text, 3, '0');
$$;

GRANT EXECUTE ON FUNCTION generate_batch_number() TO authenticated;

-- ── Sample Data ──
-- Get the staff user id
DO $$
DECLARE
  staff_id uuid;
BEGIN
  SELECT id INTO staff_id FROM user_profiles WHERE role = 'staff' LIMIT 1;

  IF staff_id IS NOT NULL THEN
    -- Batch 1: Growing
    INSERT INTO crop_batches (batch_number, crop_name, variety, zone, planting_date, expected_harvest_date, assigned_staff, stage, health_status, expected_yield, yield_unit)
    VALUES ('CROP-2026-001', 'Romaine Lettuce', 'Paris Island', 'Zone A', '2026-06-15', '2026-08-10', staff_id, 'Growing', 'Healthy', 40, 'kg')
    ON CONFLICT (batch_number) DO NOTHING;

    -- Batch 2: Ready for Harvest
    INSERT INTO crop_batches (batch_number, crop_name, variety, zone, planting_date, expected_harvest_date, assigned_staff, stage, health_status, expected_yield, yield_unit)
    VALUES ('CROP-2026-002', 'Kale Bunch', 'Tuscan', 'Zone B', '2026-05-20', '2026-07-25', staff_id, 'Ready for Harvest', 'Healthy', 25, 'kg')
    ON CONFLICT (batch_number) DO NOTHING;

    -- Batch 3: Harvested (with actual yield)
    INSERT INTO crop_batches (batch_number, crop_name, variety, zone, planting_date, expected_harvest_date, assigned_staff, stage, health_status, expected_yield, yield_unit, actual_yield, added_to_inventory)
    VALUES ('CROP-2026-003', 'Spinach', 'Bloomsdale', 'Zone A', '2026-04-10', '2026-06-20', staff_id, 'Harvested', 'Healthy', 30, 'kg', 28.5, false)
    ON CONFLICT (batch_number) DO NOTHING;

    -- Batch 4: Failed
    INSERT INTO crop_batches (batch_number, crop_name, variety, zone, planting_date, expected_harvest_date, assigned_staff, stage, health_status, expected_yield, yield_unit)
    VALUES ('CROP-2026-004', 'Fresh Basil', 'Genovese', 'Zone C', '2026-06-01', '2026-07-15', staff_id, 'Failed', 'Critical', 15, 'kg')
    ON CONFLICT (batch_number) DO NOTHING;

    -- Batch 5: Seedling
    INSERT INTO crop_batches (batch_number, crop_name, variety, zone, planting_date, expected_harvest_date, assigned_staff, stage, health_status, expected_yield, yield_unit)
    VALUES ('CROP-2026-005', 'Cherry Tomatoes', 'Sweet Million', 'Zone B', '2026-07-10', '2026-09-20', staff_id, 'Seedling', 'Needs Attention', 50, 'kg')
    ON CONFLICT (batch_number) DO NOTHING;
  END IF;
END $$;