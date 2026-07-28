import { Link } from 'react-router-dom';
import { Package, Sprout, Boxes, Users, UserCog, Activity, AlertTriangle, BarChart3 } from 'lucide-react';
import Dashboard from './Dashboard';
import AdminOverview from '@/components/AdminOverview';

export default function AdminDashboard() {
  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-green-700">
              Admin Access
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
          <p className="text-gray-500 mt-1">Business performance at a glance</p>
        </div>
        <AdminOverview />

        {/* Quick actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm"
          >
            <Package className="w-4 h-4" />
            Manage Products
          </Link>
          <Link
            to="/admin/crops"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Sprout className="w-4 h-4" />
            Manage Crops
          </Link>
          <Link
            to="/admin/inventory"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Boxes className="w-4 h-4" />
            Inventory
          </Link>
          <Link
            to="/admin/customers"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors shadow-sm"
          >
            <Users className="w-4 h-4" />
            Manage Customers
          </Link>
          <Link
            to="/admin/staff"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <UserCog className="w-4 h-4" />
            Manage Staff
          </Link>
          <Link
            to="/admin/sensors"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors shadow-sm"
          >
            <Activity className="w-4 h-4" />
            Sensors
          </Link>
          <Link
            to="/admin/alerts"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            Environmental Alerts
          </Link>
          <Link
            to="/admin/reports"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <BarChart3 className="w-4 h-4" />
            Reports & Analytics
          </Link>
        </div>
      </div>
      <Dashboard role="admin" accentColor="#15803d" badgeText="Admin Access" hideProfileSection />
    </>
  );
}
