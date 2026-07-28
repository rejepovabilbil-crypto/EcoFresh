/*
# Stage 13 — Sensor Data Management: sensor_readings table + seed data

## Overview
Adds a `sensor_readings` table to store environmental sensor data from
hydroponic farm zones — temperature, humidity, pH, EC, water level,
nutrient level, and light intensity. Both admin and farm staff can
view and add readings. Includes 4 sample readings across Zones A, B,
and C with realistic hydroponic values at staggered timestamps to
populate the historical chart.

## 1. New Table: sensor_readings

| Column                  | Type        | Description                                              |
|-------------------------|-------------|----------------------------------------------------------|
| id                      | uuid (PK)   | Primary key                                               |
| device_id               | text        | Sensor device identifier (e.g. "SENSOR-A1")              |
| zone                    | text        | Growing zone (e.g. "Zone A") — matches crop_batches.zone |
| temperature             | numeric     | Temperature in °C                                        |
| humidity                | numeric     | Relative humidity in %                                   |
| ph_level                | numeric     | pH level                                                  |
| electrical_conductivity | numeric     | EC (mS/cm)                                                |
| water_level             | numeric     | Water level in %                                          |
| nutrient_level          | numeric     | Nutrient solution level in %                             |
| light_intensity         | numeric     | Light intensity in lux                                    |
| reading_time            | timestamptz | When the reading was taken (defaults to now())           |
| recorded_by            | uuid (FK)   | user_profiles.id of who logged the reading               |
| created_at             | timestamptz | Record creation timestamp                                 |

## 2. Security (RLS)
- Enabled on `sensor_readings`.
- SELECT: admin and staff can view all readings (uses `is_staff_or_admin()`).
- INSERT: admin and staff can add readings for any zone. Uses
  `is_staff_or_admin()` SECURITY DEFINER function — sensors are not
  tied to individual staff assignment like crop batches are.
- UPDATE/DELETE: admin only (uses `is_admin()`).

## 3. Indexes
- Index on `zone` for zone-based queries.
- Index on `device_id` for device-based filtering.
- Index on `reading_time` for time-range queries.

## 4. Sample Data
4 readings across Zones A, B, and C with realistic hydroponic values:
- temp 20–26°C, humidity 60–80%, pH 5.5–6.5, EC 1.2–2.4,
  water level 70–95%, nutrient level 65–90%, light 8000–15000 lux.
Staggered over the past several hours so the historical chart has data.
*/

CREATE TABLE IF NOT EXISTS sensor_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  zone text NOT NULL,
  temperature numeric(6,2) NOT NULL,
  humidity numeric(5,2) NOT NULL,
  ph_level numeric(4,2) NOT NULL,
  electrical_conductivity numeric(5,2) NOT NULL,
  water_level numeric(5,2) NOT NULL,
  nutrient_level numeric(5,2) NOT NULL,
  light_intensity integer NOT NULL,
  reading_time timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

-- SELECT: admin and staff can view all readings
DROP POLICY IF EXISTS "select_sensor_readings" ON sensor_readings;
CREATE POLICY "select_sensor_readings" ON sensor_readings
  FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

-- INSERT: admin and staff can add readings for any zone
DROP POLICY IF EXISTS "insert_sensor_readings" ON sensor_readings;
CREATE POLICY "insert_sensor_readings" ON sensor_readings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin());

-- UPDATE: admin only
DROP POLICY IF EXISTS "update_sensor_readings" ON sensor_readings;
CREATE POLICY "update_sensor_readings" ON sensor_readings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admin only
DROP POLICY IF EXISTS "delete_sensor_readings" ON sensor_readings;
CREATE POLICY "delete_sensor_readings" ON sensor_readings
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_readings_zone ON sensor_readings(zone);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_id ON sensor_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_reading_time ON sensor_readings(reading_time);

-- ── Sample Data ──
-- Get the staff user id for recorded_by
DO $$
DECLARE
  staff_id uuid;
BEGIN
  SELECT id INTO staff_id FROM user_profiles WHERE role = 'staff' LIMIT 1;

  -- Reading 1: Zone A, 6 hours ago
  INSERT INTO sensor_readings (device_id, zone, temperature, humidity, ph_level, electrical_conductivity, water_level, nutrient_level, light_intensity, reading_time, recorded_by)
  VALUES ('SENSOR-A1', 'Zone A', 22.5, 68.0, 6.0, 1.8, 88.0, 82.0, 12000, now() - interval '6 hours', staff_id)
  ON CONFLICT DO NOTHING;

  -- Reading 2: Zone B, 4 hours ago
  INSERT INTO sensor_readings (device_id, zone, temperature, humidity, ph_level, electrical_conductivity, water_level, nutrient_level, light_intensity, reading_time, recorded_by)
  VALUES ('SENSOR-B1', 'Zone B', 24.0, 72.5, 5.8, 2.0, 85.0, 78.0, 13500, now() - interval '4 hours', staff_id)
  ON CONFLICT DO NOTHING;

  -- Reading 3: Zone C, 2 hours ago
  INSERT INTO sensor_readings (device_id, zone, temperature, humidity, ph_level, electrical_conductivity, water_level, nutrient_level, light_intensity, reading_time, recorded_by)
  VALUES ('SENSOR-C1', 'Zone C', 25.5, 75.0, 6.2, 2.2, 92.0, 85.0, 14000, now() - interval '2 hours', staff_id)
  ON CONFLICT DO NOTHING;

  -- Reading 4: Zone A, 1 hour ago (second reading for Zone A to show a trend)
  INSERT INTO sensor_readings (device_id, zone, temperature, humidity, ph_level, electrical_conductivity, water_level, nutrient_level, light_intensity, reading_time, recorded_by)
  VALUES ('SENSOR-A1', 'Zone A', 23.0, 70.0, 6.1, 1.9, 86.0, 80.0, 12500, now() - interval '1 hour', staff_id)
  ON CONFLICT DO NOTHING;
END $$;
