/*
# Stage 14 — Environmental Alerts: thresholds, alerts tables, and trigger

## Overview
Adds two new tables — `alert_thresholds` and `environmental_alerts` — and
a database trigger that automatically checks every new sensor_reading
against the thresholds for its zone/parameter. If a value falls outside
the safe range, an alert row is inserted with severity "warning" or
"critical" (critical when the value is more than 20% of the range beyond
the threshold boundary). Both admin and staff can view and act on alerts;
staff see only alerts for zones they are assigned to via crop_batches.

## 1. New Table: alert_thresholds

| Column    | Type        | Description                                         |
|-----------|-------------|------------------------------------------------------|
| id        | uuid (PK)   | Primary key                                           |
| zone      | text        | Zone name (matches crop_batches.zone)               |
| parameter | text        | Metric name (temperature, humidity, ph_level, etc.) |
| min_value | numeric     | Minimum safe value                                    |
| max_value | numeric     | Maximum safe value                                    |
| created_at| timestamptz | Record creation timestamp                             |

Unique constraint on (zone, parameter) so each zone has one threshold
per parameter.

## 2. New Table: environmental_alerts

| Column          | Type        | Description                                              |
|-----------------|-------------|----------------------------------------------------------|
| id              | uuid (PK)   | Primary key                                               |
| zone            | text        | Zone where the alert was triggered                       |
| parameter       | text        | Metric that breached the threshold                        |
| reading_value   | numeric     | The actual sensor value that triggered the alert          |
| threshold_min   | numeric     | The min threshold at time of alert                        |
| threshold_max   | numeric     | The max threshold at time of alert                        |
| severity        | text        | "warning" or "critical" (CHECK-constrained)              |
| status          | text        | "active", "acknowledged", "resolved" (CHECK-constrained) |
| triggered_at    | timestamptz | When the alert was triggered (defaults to now())         |
| acknowledged_by| uuid (FK)   | user_profiles.id of who acknowledged                      |
| acknowledged_at| timestamptz| When the alert was acknowledged                          |
| resolved_by     | uuid (FK)   | user_profiles.id of who resolved                         |
| resolved_at     | timestamptz | When the alert was resolved                              |
| created_at      | timestamptz | Record creation timestamp                                 |

## 3. Trigger: check_sensor_reading_thresholds
Fires AFTER INSERT on sensor_readings. For each threshold matching the
new reading's zone, checks the corresponding parameter value. If the
value is outside [min_value, max_value], inserts an environmental_alert.
Severity is "critical" when the value exceeds the threshold by more
than 20% of the (max - min) range; otherwise "warning".

## 4. Security (RLS)
### alert_thresholds
- SELECT: admin and staff (is_staff_or_admin).
- INSERT/UPDATE/DELETE: admin only (is_admin).

### environmental_alerts
- SELECT: admin sees all; staff sees only alerts for zones they are
  assigned to via crop_batches (EXISTS subquery on crop_batches
  WHERE assigned_staff = auth.uid() AND zone matches).
- INSERT: only the trigger (SECURITY DEFINER function). No direct
  INSERT policy for authenticated users — the trigger function runs
  with owner privileges and bypasses RLS.
- UPDATE: admin can update any; staff can update only alerts in their
  assigned zones (for acknowledge/resolve actions).
- DELETE: admin only.

## 5. Default Thresholds (Zone A, B, C)
| Parameter                | Min  | Max  |
|--------------------------|------|------|
| temperature (°C)         | 18   | 26   |
| humidity (%)             | 60   | 80   |
| ph_level                 | 5.5  | 6.5  |
| electrical_conductivity  | 1.2  | 2.4  |
| water_level (%)          | 70   | 95   |
| nutrient_level (%)       | 65   | 90   |

## 6. Indexes
- environmental_alerts(zone) for zone-based queries.
- environmental_alerts(status) for filtering active/resolved.
- environmental_alerts(severity) for filtering by severity.
*/

-- ── alert_thresholds table ──
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone text NOT NULL,
  parameter text NOT NULL CHECK (parameter IN (
    'temperature', 'humidity', 'ph_level',
    'electrical_conductivity', 'water_level', 'nutrient_level'
  )),
  min_value numeric NOT NULL,
  max_value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zone, parameter)
);

ALTER TABLE alert_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_alert_thresholds" ON alert_thresholds;
CREATE POLICY "select_alert_thresholds" ON alert_thresholds
  FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

DROP POLICY IF EXISTS "insert_alert_thresholds" ON alert_thresholds;
CREATE POLICY "insert_alert_thresholds" ON alert_thresholds
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_alert_thresholds" ON alert_thresholds;
CREATE POLICY "update_alert_thresholds" ON alert_thresholds
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_alert_thresholds" ON alert_thresholds;
CREATE POLICY "delete_alert_thresholds" ON alert_thresholds
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── environmental_alerts table ──
CREATE TABLE IF NOT EXISTS environmental_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone text NOT NULL,
  parameter text NOT NULL,
  reading_value numeric NOT NULL,
  threshold_min numeric NOT NULL,
  threshold_max numeric NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE environmental_alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: admin sees all; staff sees only alerts for their assigned zones
DROP POLICY IF EXISTS "select_environmental_alerts" ON environmental_alerts;
CREATE POLICY "select_environmental_alerts" ON environmental_alerts
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM crop_batches cb
      WHERE cb.assigned_staff = auth.uid()
        AND cb.zone = environmental_alerts.zone
    )
  );

-- UPDATE: admin can update any; staff can update only their zone alerts
DROP POLICY IF EXISTS "update_environmental_alerts" ON environmental_alerts;
CREATE POLICY "update_environmental_alerts" ON environmental_alerts
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM crop_batches cb
      WHERE cb.assigned_staff = auth.uid()
        AND cb.zone = environmental_alerts.zone
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM crop_batches cb
      WHERE cb.assigned_staff = auth.uid()
        AND cb.zone = environmental_alerts.zone
    )
  );

-- DELETE: admin only
DROP POLICY IF EXISTS "delete_environmental_alerts" ON environmental_alerts;
CREATE POLICY "delete_environmental_alerts" ON environmental_alerts
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_environmental_alerts_zone ON environmental_alerts(zone);
CREATE INDEX IF NOT EXISTS idx_environmental_alerts_status ON environmental_alerts(status);
CREATE INDEX IF NOT EXISTS idx_environmental_alerts_severity ON environmental_alerts(severity);

-- ── Trigger function: check_sensor_reading_thresholds ──
CREATE OR REPLACE FUNCTION check_sensor_reading_thresholds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  threshold RECORD;
  val numeric;
  range numeric;
  severity text;
BEGIN
  FOR threshold IN
    SELECT parameter, min_value, max_value
    FROM alert_thresholds
    WHERE zone = NEW.zone
  LOOP
    -- Map parameter name to the corresponding column value
    CASE threshold.parameter
      WHEN 'temperature' THEN val := NEW.temperature;
      WHEN 'humidity' THEN val := NEW.humidity;
      WHEN 'ph_level' THEN val := NEW.ph_level;
      WHEN 'electrical_conductivity' THEN val := NEW.electrical_conductivity;
      WHEN 'water_level' THEN val := NEW.water_level;
      WHEN 'nutrient_level' THEN val := NEW.nutrient_level;
      ELSE val := NULL;
    END CASE;

    IF val IS NOT NULL AND (val < threshold.min_value OR val > threshold.max_value) THEN
      range := threshold.max_value - threshold.min_value;

      -- Critical if value is more than 20% of the range beyond the boundary
      IF val < threshold.min_value - (0.2 * range)
         OR val > threshold.max_value + (0.2 * range) THEN
        severity := 'critical';
      ELSE
        severity := 'warning';
      END IF;

      INSERT INTO environmental_alerts (
        zone, parameter, reading_value,
        threshold_min, threshold_max, severity, status
      )
      VALUES (
        NEW.zone, threshold.parameter, val,
        threshold.min_value, threshold.max_value, severity, 'active'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_sensor_reading_thresholds ON sensor_readings;
CREATE TRIGGER trg_check_sensor_reading_thresholds
  AFTER INSERT ON sensor_readings
  FOR EACH ROW
  EXECUTE FUNCTION check_sensor_reading_thresholds();

-- ── Default thresholds for Zone A, B, C ──
INSERT INTO alert_thresholds (zone, parameter, min_value, max_value) VALUES
  ('Zone A', 'temperature', 18, 26),
  ('Zone A', 'humidity', 60, 80),
  ('Zone A', 'ph_level', 5.5, 6.5),
  ('Zone A', 'electrical_conductivity', 1.2, 2.4),
  ('Zone A', 'water_level', 70, 95),
  ('Zone A', 'nutrient_level', 65, 90),
  ('Zone B', 'temperature', 18, 26),
  ('Zone B', 'humidity', 60, 80),
  ('Zone B', 'ph_level', 5.5, 6.5),
  ('Zone B', 'electrical_conductivity', 1.2, 2.4),
  ('Zone B', 'water_level', 70, 95),
  ('Zone B', 'nutrient_level', 65, 90),
  ('Zone C', 'temperature', 18, 26),
  ('Zone C', 'humidity', 60, 80),
  ('Zone C', 'ph_level', 5.5, 6.5),
  ('Zone C', 'electrical_conductivity', 1.2, 2.4),
  ('Zone C', 'water_level', 70, 95),
  ('Zone C', 'nutrient_level', 65, 90)
ON CONFLICT (zone, parameter) DO NOTHING;
