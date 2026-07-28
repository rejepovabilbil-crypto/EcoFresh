import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowLeft, Loader2, Users, Power, X, ChevronRight,
  Phone, Mail, Calendar, ShoppingBag, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatAED } from '@/lib/format';

interface CustomerRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  is_active: boolean;
}

interface OrderSummary {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  'Pending': 'bg-amber-100 text-amber-700',
  'Confirmed': 'bg-blue-100 text-blue-700',
  'Preparing': 'bg-cyan-100 text-cyan-700',
  'Packed': 'bg-indigo-100 text-indigo-700',
  'Out for Delivery': 'bg-orange-100 text-orange-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-700',
};

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [orderTotals, setOrderTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    const [profilesRes, ordersRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, created_at, is_active')
        .eq('role', 'customer')
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('user_id, total'),
    ]);

    const rows = (profilesRes.data as CustomerRow[]) || [];
    setCustomers(rows);

    const allOrders = (ordersRes.data as { user_id: string; total: number }[]) || [];
    const counts: Record<string, number> = {};
    const totals: Record<string, number> = {};
    allOrders.forEach((o) => {
      counts[o.user_id] = (counts[o.user_id] || 0) + 1;
      totals[o.user_id] = (totals[o.user_id] || 0) + (o.total || 0);
    });
    setOrderCounts(counts);
    setOrderTotals(totals);
  }, []);

  useEffect(() => {
    fetchCustomers().finally(() => setLoading(false));
  }, [fetchCustomers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [customers, search]);

  async function openCustomerHistory(customer: CustomerRow) {
    setSelectedCustomer(customer);
    setOrdersLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at')
      .eq('user_id', customer.id)
      .order('created_at', { ascending: false });
    setCustomerOrders((data as OrderSummary[]) || []);
    setOrdersLoading(false);
  }

  async function handleToggleStatus(customer: CustomerRow) {
    setToggleLoadingId(customer.id);
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: !customer.is_active })
      .eq('id', customer.id);
    setToggleLoadingId(null);
    if (error) {
      console.error('Failed to toggle status:', error.message);
      return;
    }
    await fetchCustomers();
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer({ ...customer, is_active: !customer.is_active });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
            <Users className="w-6 h-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
            <p className="text-gray-500 mt-0.5">View customers, order history, and account status</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No customers found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Phone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Registered</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Orders</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Total Spent</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-stone-50/50 transition-colors cursor-pointer"
                    onClick={() => openCustomerHistory(customer)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{customer.full_name}</p>
                      <p className="text-xs text-gray-400 md:hidden">{customer.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{customer.email}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">{customer.phone || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-gray-600">
                        {new Date(customer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900">{orderCounts[customer.id] || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">{formatAED(orderTotals[customer.id] || 0)}</span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleStatus(customer)}
                        disabled={toggleLoadingId === customer.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          customer.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        } disabled:opacity-50`}
                      >
                        {toggleLoadingId === customer.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Power className="w-3 h-3" />
                        )}
                        {customer.is_active ? 'Active' : 'Suspended'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order History Drawer */}
      {selectedCustomer && (
        <CustomerOrderDrawer
          customer={selectedCustomer}
          orders={customerOrders}
          loading={ordersLoading}
          onClose={() => setSelectedCustomer(null)}
          onToggleStatus={handleToggleStatus}
          toggleLoading={toggleLoadingId === selectedCustomer.id}
          onNavigateOrder={(id) => navigate(`/orders/${id}`)}
        />
      )}
    </div>
  );
}

function CustomerOrderDrawer({
  customer, orders, loading, onClose, onToggleStatus, toggleLoading, onNavigateOrder,
}: {
  customer: CustomerRow;
  orders: OrderSummary[];
  loading: boolean;
  onClose: () => void;
  onToggleStatus: (c: CustomerRow) => void;
  toggleLoading: boolean;
  onNavigateOrder: (id: string) => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-green-700">
                {customer.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-gray-900 truncate">{customer.full_name}</p>
              <button
                onClick={() => onToggleStatus(customer)}
                disabled={toggleLoading}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors mt-1 ${
                  customer.is_active
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                } disabled:opacity-50`}
              >
                {toggleLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Power className="w-3 h-3" />
                )}
                {customer.is_active ? 'Active' : 'Suspended'}
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{customer.phone || 'No phone on file'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <span>
                Joined {new Date(customer.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-500">Total Orders</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-500">Total Spent</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatAED(totalSpent)}</p>
            </div>
          </div>

          {/* Order history */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Order History</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => onNavigateOrder(order.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 hover:border-green-300 hover:bg-green-50/30 transition-all text-left group"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-gray-900 truncate">{order.order_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-sm text-gray-900">{formatAED(order.total)}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status] ?? STATUS_STYLES['Pending']}`}>
                        {order.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
