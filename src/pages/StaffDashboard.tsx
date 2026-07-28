import { Link } from 'react-router-dom';
import { Sprout, Activity, AlertTriangle } from 'lucide-react';
import Dashboard from './Dashboard';

export default function StaffDashboard() {
  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-teal-600">
              Staff Access
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your assigned tasks and crop batches</p>
        </div>

        <div className="mb-8">
          <Link
            to="/staff/crops"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Sprout className="w-4 h-4" />
            Manage Crops
          </Link>
          <Link
            to="/staff/sensors"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors shadow-sm"
          >
            <Activity className="w-4 h-4" />
            Sensors
          </Link>
          <Link
            to="/staff/alerts"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            Environmental Alerts
          </Link>
        </div>
      </div>
      <Dashboard role="staff" accentColor="#0d9488" badgeText="Staff Access" hideProfileSection />
    </>
  );
}
