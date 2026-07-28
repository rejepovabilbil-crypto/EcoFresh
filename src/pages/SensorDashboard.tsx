import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Activity, Plus, X, Check, Thermometer,
  Droplets, FlaskConical, Zap, Waves, Beaker, Sun, Calendar,
  Filter, ChevronDown, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface SensorReading {
  id: string;
  device_id: string;
  zone: string;
  temperature: number;
  humidity: number;
  ph_level: number;
  electrical_conductivity: number;
  water_level: number;
  nutrient_level: number;
  light_intensity: number;
  reading_time: string;
}

interface ReadingForm {
  device_id: string;
  zone: string;
  temperature: string;
  humidity: string;
  ph_level: string;
  electrical_conductivity: string;
  water_level: string;
  nutrient_level: string;
  light_intensity: string;
}

const ZONES = ['Zone A', 'Zone B', 'Zone C'];
const DEVICES = ['SENSOR-A1', 'SENSOR-B1', 'SENSOR-C1', 'SENSOR-A2', 'SENSOR-B2'];

const EMPTY_FORM: ReadingForm = {
  device_id: 'SENSOR-A1',
  zone: 'Zone A',
  temperature: '',
  humidity: '',
  ph_level: '',
  electrical_conductivity: '',
  water_level: '',
  nutrient_level: '',
  light_intensity: '',
};

const METRIC_CONFIG = [
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer, color: 'text-orange-600', bg: 'bg-orange-100' },
  { key: 'humidity', label: 'Humidity', unit: '%', icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-100' },
  { key: 'ph_level', label: 'pH Level', unit: '', icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-100' },
  { key: 'electrical_conductivity', label: 'EC', unit: 'mS/cm', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-100' },
  { key: 'water_level', label: 'Water Level', unit: '%', icon: Waves, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  { key: 'nutrient_level', label: 'Nutrient Level', unit: '%', icon: Beaker, color: 'text-green-600', bg: 'bg-green-100' },
  { key: 'light_intensity', label: 'Light Intensity', unit: 'lux', icon: Sun, color: 'text-yellow-600', bg: 'bg-yellow-100' },
] as const;

export default function SensorDashboard({ role }: { role: 'admin' | 'staff' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ReadingForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filters
  const [filterZone, setFilterZone] = useState('All');
  const [filterDevice, setFilterDevice] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [chartZone, setChartZone] = useState('Zone A');
  const [activeAlertZones, setActiveAlertZones] = useState<Set<string>>(new Set());

  const fetchReadings = useCallback(async () => {
    let query = supabase
      .from('sensor_readings')
      .select('*')
      .order('reading_time', { ascending: false });

    if (filterZone !== 'All') query = query.eq('zone', filterZone);
    if (filterDevice !== 'All') query = query.eq('device_id', filterDevice);
    if (filterDate) {
      const start = new Date(filterDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filterDate);
      end.setHours(23, 59, 59, 999);
      query = query.gte('reading_time', start.toISOString()).lte('reading_time', end.toISOString());
    }

    const { data, error } = await query.limit(200);
    if (error) {
      console.error('Failed to load sensor readings:', error.message);
      return;
    }
    setReadings((data as SensorReading[]) || []);

    // Fetch zones with active alerts
    const { data: activeAlerts } = await supabase
      .from('environmental_alerts')
      .select('zone')
      .eq('status', 'active');
    const zones = new Set(((activeAlerts as { zone: string }[]) || []).map((a) => a.zone));
    setActiveAlertZones(zones);
  }, [filterZone, filterDevice, filterDate]);

  useEffect(() => {
    fetchReadings().finally(() => setLoading(false));
  }, [fetchReadings]);

  // Latest reading per zone
  const latestPerZone = useMemo(() => {
    const byZone: Record<string, SensorReading> = {};
    for (const r of readings) {
      if (!byZone[r.zone] || new Date(r.reading_time) > new Date(byZone[r.zone].reading_time)) {
        byZone[r.zone] = r;
      }
    }
    return Object.values(byZone).sort((a, b) => a.zone.localeCompare(b.zone));
  }, [readings]);

  // Chart data: readings for the selected chart zone, oldest first
  const chartData = useMemo(() => {
    return readings
      .filter((r) => r.zone === chartZone)
      .sort((a, b) => new Date(a.reading_time).getTime() - new Date(b.reading_time).getTime());
  }, [readings, chartZone]);

  function openAddForm() {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSaveError(null);
    setAddOpen(true);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const numFields: (keyof ReadingForm)[] = [
      'temperature', 'humidity', 'ph_level', 'electrical_conductivity',
      'water_level', 'nutrient_level', 'light_intensity',
    ];
    numFields.forEach((f) => {
      const val = parseFloat(form[f]);
      if (isNaN(val)) errors[f] = 'Required';
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);

    const payload = {
      device_id: form.device_id,
      zone: form.zone,
      temperature: parseFloat(form.temperature),
      humidity: parseFloat(form.humidity),
      ph_level: parseFloat(form.ph_level),
      electrical_conductivity: parseFloat(form.electrical_conductivity),
      water_level: parseFloat(form.water_level),
      nutrient_level: parseFloat(form.nutrient_level),
      light_intensity: parseInt(form.light_intensity, 10),
      recorded_by: user?.id,
    };

    const { error } = await supabase.from('sensor_readings').insert(payload);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setAddOpen(false);
    await fetchReadings();
  }

  const dashboardPath = role === 'admin' ? '/admin/dashboard' : '/staff/dashboard';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 text-cyan-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate(dashboardPath)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-cyan-700 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Activity className="w-6 h-6 text-cyan-700" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sensor Dashboard</h1>
              <p className="text-gray-500 mt-0.5">Monitor environmental readings across farm zones</p>
            </div>
          </div>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Reading
        </button>
      </div>

      {/* Latest Reading Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {latestPerZone.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-stone-200">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No sensor readings yet. Add your first reading to get started.</p>
          </div>
        ) : (
          latestPerZone.map((reading) => (
            <ZoneCard key={reading.id} reading={reading} hasActiveAlert={activeAlertZones.has(reading.zone)} />
          ))
        )}
      </div>

      {/* Historical Chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Temperature & Humidity Trends</h2>
          </div>
          <div className="relative">
            <select
              value={chartZone}
              onChange={(e) => setChartZone(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition bg-white cursor-pointer text-sm font-medium"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <TrendChart data={chartData} />
      </div>

      {/* Filters + Reading History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">Filter Readings</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Zone</label>
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition bg-white cursor-pointer text-sm"
              >
                <option value="All">All Zones</option>
                {ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Device</label>
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition bg-white cursor-pointer text-sm"
              >
                <option value="All">All Devices</option>
                {DEVICES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {readings.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No readings match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Device</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Zone</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Temp</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Humidity</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">pH</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">EC</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Water</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Nutrient</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Light</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {readings.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">{r.device_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700">
                        {r.zone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{r.temperature}°C</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 hidden sm:table-cell">{r.humidity}%</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 hidden md:table-cell">{r.ph_level}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 hidden md:table-cell">{r.electrical_conductivity}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 hidden lg:table-cell">{r.water_level}%</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 hidden lg:table-cell">{r.nutrient_level}%</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700 hidden lg:table-cell">{r.light_intensity}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(r.reading_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Reading Modal */}
      {addOpen && (
        <AddReadingModal
          form={form}
          formErrors={formErrors}
          saving={saving}
          saveError={saveError}
          onChange={setForm}
          onSave={handleSave}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function ZoneCard({ reading, hasActiveAlert }: { reading: SensorReading; hasActiveAlert: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${hasActiveAlert ? 'border-amber-300' : 'border-stone-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-cyan-50 text-cyan-700">
            {reading.zone}
          </span>
          {hasActiveAlert && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              Alert
            </span>
          )}
          <span className="font-mono text-xs text-gray-400">{reading.device_id}</span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(reading.reading_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {METRIC_CONFIG.map((m) => {
          const Icon = m.icon;
          const value = reading[m.key as keyof SensorReading] as number;
          return (
            <div key={m.key} className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 truncate">{m.label}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {value}{m.unit && <span className="text-xs text-gray-400 ml-0.5">{m.unit}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: SensorReading[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No data for this zone yet.</p>
      </div>
    );
  }

  const width = 800;
  const height = 280;
  const padding = { top: 20, right: 50, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const temps = data.map((d) => d.temperature);
  const humids = data.map((d) => d.humidity);
  const allVals = [...temps, ...humids];
  const minVal = Math.min(...allVals) - 2;
  const maxVal = Math.max(...allVals) + 2;
  const valRange = maxVal - minVal || 1;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0;

  function toX(i: number) {
    return padding.left + (data.length > 1 ? i * xStep : chartW / 2);
  }
  function toY(val: number) {
    return padding.top + chartH - ((val - minVal) / valRange) * chartH;
  }

  const tempPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.temperature)}`).join(' ');
  const humidPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d.humidity)}`).join(' ');

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => minVal + (valRange * i) / yTicks);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ height: 'auto' }}>
        {/* Y-axis grid lines + labels */}
        {tickVals.map((tv, i) => {
          const y = toY(tv);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f5f5f4" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-stone-400" style={{ fontSize: '11px' }}>
                {tv.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (data.length > 8 && i % Math.ceil(data.length / 6) !== 0) return null;
          return (
            <text key={i} x={toX(i)} y={height - padding.bottom + 18} textAnchor="middle" className="fill-stone-400" style={{ fontSize: '11px' }}>
              {new Date(d.reading_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </text>
          );
        })}

        {/* Temperature line */}
        <path d={tempPath} fill="none" stroke="#f97316" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={`t${i}`} cx={toX(i)} cy={toY(d.temperature)} r={3.5} fill="#f97316" />
        ))}

        {/* Humidity line */}
        <path d={humidPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={`h${i}`} cx={toX(i)} cy={toY(d.humidity)} r={3.5} fill="#3b82f6" />
        ))}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${padding.top - 6})`}>
          <circle cx={0} cy={0} r={4} fill="#f97316" />
          <text x={10} y={4} className="fill-stone-600" style={{ fontSize: '12px', fontWeight: 500 }}>Temperature (°C)</text>
          <circle cx={140} cy={0} r={4} fill="#3b82f6" />
          <text x={150} y={4} className="fill-stone-600" style={{ fontSize: '12px', fontWeight: 500 }}>Humidity (%)</text>
        </g>
      </svg>
    </div>
  );
}

function AddReadingModal({
  form, formErrors, saving, saveError, onChange, onSave, onClose,
}: {
  form: ReadingForm;
  formErrors: Record<string, string>;
  saving: boolean;
  saveError: string | null;
  onChange: (data: ReadingForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function update<K extends keyof ReadingForm>(key: K, value: ReadingForm[K]) {
    onChange({ ...form, [key]: value });
  }

  const numericFields: { key: keyof ReadingForm; label: string; unit: string; placeholder: string }[] = [
    { key: 'temperature', label: 'Temperature', unit: '°C', placeholder: 'e.g. 22.5' },
    { key: 'humidity', label: 'Humidity', unit: '%', placeholder: 'e.g. 68' },
    { key: 'ph_level', label: 'pH Level', unit: '', placeholder: 'e.g. 6.0' },
    { key: 'electrical_conductivity', label: 'Electrical Conductivity', unit: 'mS/cm', placeholder: 'e.g. 1.8' },
    { key: 'water_level', label: 'Water Level', unit: '%', placeholder: 'e.g. 88' },
    { key: 'nutrient_level', label: 'Nutrient Level', unit: '%', placeholder: 'e.g. 82' },
    { key: 'light_intensity', label: 'Light Intensity', unit: 'lux', placeholder: 'e.g. 12000' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Add Sensor Reading</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Device ID</label>
              <select
                value={form.device_id}
                onChange={(e) => update('device_id', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition bg-white cursor-pointer"
              >
                {DEVICES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zone</label>
              <select
                value={form.zone}
                onChange={(e) => update('zone', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition bg-white cursor-pointer"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {numericFields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {f.label}{f.unit && <span className="text-gray-400 text-xs ml-1">({f.unit})</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition ${
                    formErrors[f.key] ? 'border-red-300' : 'border-stone-300'
                  }`}
                />
                {formErrors[f.key] && <p className="text-xs text-red-500 mt-1">{formErrors[f.key]}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save Reading
          </button>
        </div>
      </div>
    </div>
  );
}
