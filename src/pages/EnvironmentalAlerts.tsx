import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertTriangle, Bell, CheckCircle2,
  ShieldCheck, Filter, ChevronDown, Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface EnvironmentalAlert {
  id: string;
  zone: string;
  parameter: string;
  reading_value: number;
  threshold_min: number;
  threshold_max: number;
  severity: 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  triggered_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
}

const ZONES = ['Zone A', 'Zone B', 'Zone C'];

const PARAMETER_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  ph_level: 'pH Level',
  electrical_conductivity: 'EC',
  water_level: 'Water Level',
  nutrient_level: 'Nutrient Level',
};

const PARAMETER_UNITS: Record<string, string> = {
  temperature: '°C',
  humidity: '%',
  ph_level: '',
  electrical_conductivity: 'mS/cm',
  water_level: '%',
  nutrient_level: '%',
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-red-50', text: 'text-red-700' },
  acknowledged: { bg: 'bg-blue-50', text: 'text-blue-700' },
  resolved: { bg: 'bg-green-50', text: 'text-green-700' },
};

export default function EnvironmentalAlerts({ role }: { role: 'admin' | 'staff' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<EnvironmentalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [filterZone, setFilterZone] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const fetchAlerts = useCallback(async () => {
    let query = supabase
      .from('environmental_alerts')
      .select('*')
      .order('triggered_at', { ascending: false });

    if (filterZone !== 'All') query = query.eq('zone', filterZone);
    if (filterSeverity !== 'All') query = query.eq('severity', filterSeverity);
    if (filterStatus !== 'All') query = query.eq('status', filterStatus);

    const { data, error } = await query.limit(200);
    if (error) {
      console.error('Failed to load alerts:', error.message);
      return;
    }
    setAlerts((data as EnvironmentalAlert[]) || []);
  }, [filterZone, filterSeverity, filterStatus]);

  useEffect(() => {
    fetchAlerts().finally(() => setLoading(false));
  }, [fetchAlerts]);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'active'), [alerts]);
  const criticalCount = useMemo(() => activeAlerts.filter((a) => a.severity === 'critical').length, [activeAlerts]);
  const warningCount = useMemo(() => activeAlerts.filter((a) => a.severity === 'warning').length, [activeAlerts]);

  async function handleAcknowledge(alert: EnvironmentalAlert) {
    setActionLoadingId(alert.id);
    const { error } = await supabase
      .from('environmental_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: user?.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alert.id);
    setActionLoadingId(null);
    if (error) {
      console.error('Failed to acknowledge alert:', error.message);
      return;
    }
    await fetchAlerts();
  }

  async function handleResolve(alert: EnvironmentalAlert) {
    setActionLoadingId(alert.id);
    const { error } = await supabase
      .from('environmental_alerts')
      .update({
        status: 'resolved',
        resolved_by: user?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alert.id);
    setActionLoadingId(null);
    if (error) {
      console.error('Failed to resolve alert:', error.message);
      return;
    }
    await fetchAlerts();
  }

  const dashboardPath = role === 'admin' ? '/admin/dashboard' : '/staff/dashboard';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(dashboardPath)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-amber-700 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Environmental Alerts</h1>
            <p className="text-gray-500 mt-0.5">
              {role === 'admin' ? 'Monitor and manage all sensor alerts across zones' : 'Alerts for your assigned zones'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{criticalCount}</p>
              <p className="text-xs text-gray-500">Critical Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{warningCount}</p>
              <p className="text-xs text-gray-500">Warning Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{alerts.length - activeAlerts.length}</p>
              <p className="text-xs text-gray-500">Acknowledged / Resolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-900 text-sm">Filter Alerts</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FilterSelect label="Zone" value={filterZone} onChange={setFilterZone} options={['All', ...ZONES]} />
          <FilterSelect label="Severity" value={filterSeverity} onChange={setFilterSeverity} options={['All', 'critical', 'warning']} />
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={['All', 'active', 'acknowledged', 'resolved']} />
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {alerts.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <p className="text-gray-400">No alerts match your filters. All clear!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Zone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Parameter</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Value</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Range</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Severity</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Triggered</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {alerts.map((alert) => {
                  const sevStyle = SEVERITY_STYLES[alert.severity];
                  const statusStyle = STATUS_STYLES[alert.status];
                  const unit = PARAMETER_UNITS[alert.parameter] || '';
                  return (
                    <tr key={alert.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700">
                          {alert.zone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{PARAMETER_LABELS[alert.parameter] || alert.parameter}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                          {alert.reading_value}{unit && <span className="text-xs text-gray-400 ml-0.5">{unit}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="text-xs text-gray-500">
                          {alert.threshold_min} – {alert.threshold_max}{unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sevStyle.bg} ${sevStyle.text}`}>
                          {alert.severity === 'critical' ? <AlertTriangle className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                          {alert.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {alert.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-500">
                          {new Date(alert.triggered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {alert.status === 'active' && (
                            <button
                              onClick={() => handleAcknowledge(alert)}
                              disabled={actionLoadingId === alert.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                              title="Acknowledge"
                            >
                              {actionLoadingId === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              Acknowledge
                            </button>
                          )}
                          {alert.status !== 'resolved' && (
                            <button
                              onClick={() => handleResolve(alert)}
                              disabled={actionLoadingId === alert.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                              title="Resolve"
                            >
                              {actionLoadingId === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none px-3 py-2 pr-9 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white cursor-pointer text-sm capitalize"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt === 'All' ? `All ${label}s` : opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}
