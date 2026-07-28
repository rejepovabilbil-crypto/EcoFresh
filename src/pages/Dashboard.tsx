import { useEffect, useState, useCallback } from 'react';
import {
  LogOut, Mail, Shield, Calendar, Clock, Package, ChevronRight,
  CheckCircle2, Truck, XCircle, Loader2, ArrowRight, User as UserIcon,
  MapPin, CreditCard, Banknote,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { formatAED } from '@/lib/format';

interface DashboardProps {
  role: UserRole;
  accentColor: string;
  badgeText: string;
  hideProfileSection?: boolean;
}

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  vat: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  delivery_address: string;
  emirate: string;
  delivery_date: string | null;
  instructions: string | null;
  payment_method: string;
}

const ORDER_STAGES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Packed',
  'Out for Delivery',
  'Delivered',
] as const;

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  'Pending': { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  'Confirmed': { bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle2 },
  'Preparing': { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: Package },
  'Packed': { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: Package },
  'Out for Delivery': { bg: 'bg-orange-100', text: 'text-orange-700', icon: Truck },
  'Delivered': { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  'Cancelled': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
};

export default function Dashboard({ role, accentColor, badgeText, hideProfileSection = false }: DashboardProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load orders:', error.message);
      return;
    }
    setOrders((data as OrderRow[]) || []);
  }, []);

  useEffect(() => {
    fetchOrders().finally(() => setLoading(false));
  }, [fetchOrders]);

  // Realtime: refresh when any order changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  async function updateOrderStatus(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      if (error) throw error;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      console.error('Failed to update order status:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  function getNextStage(currentStatus: string): string | null {
    const idx = ORDER_STAGES.indexOf(currentStatus as typeof ORDER_STAGES[number]);
    if (idx === -1 || idx >= ORDER_STAGES.length - 1) return null;
    return ORDER_STAGES[idx + 1];
  }

  if (!profile) return null;

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalOrders = orders.length;
  const pendingCount = orders.filter((o) => o.status === 'Pending').length;
  const inProgressCount = orders.filter((o) =>
    ['Confirmed', 'Preparing', 'Packed', 'Out for Delivery'].includes(o.status)
  ).length;
  const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome header */}
      {!hideProfileSection && (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            {badgeText}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {profile.full_name.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 mt-1">Here's your account overview</p>
      </div>
      )}

      {/* Profile info cards */}
      {!hideProfileSection && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Profile Information</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{profile.full_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Role</dt>
              <dd className="font-medium text-gray-900 capitalize">{profile.role}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                {profile.email}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Account Details</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Member Since</dt>
              <dd className="font-medium text-gray-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {memberSince}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Account ID</dt>
              <dd className="font-medium text-gray-900 font-mono text-xs">
                {profile.id.slice(0, 8)}...
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium text-green-600">Active</dd>
            </div>
          </dl>
        </div>
      </div>

      )}

      {/* Order stats */}
      {!hideProfileSection && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
              <p className="text-xs text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-cyan-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inProgressCount}</p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{deliveredCount}</p>
              <p className="text-xs text-gray-500">Delivered</p>
            </div>
          </div>
        </div>
      </div>

      )}

      {/* Order management */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-green-700" />
          </div>
          <h2 className="font-semibold text-gray-900">Order Management</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No orders yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const StatusIcon = STATUS_STYLES[order.status]?.icon ?? Clock;
              const nextStage = getNextStage(order.status);
              const isUpdating = updatingId === order.id;
              const isFinal = order.status === 'Delivered' || order.status === 'Cancelled';

              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-stone-200 hover:border-green-300 transition-all overflow-hidden"
                >
                  {/* Order header row — clickable to view tracking */}
                  <button
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="w-full flex items-center justify-between p-4 hover:bg-green-50/30 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-medium text-gray-900">{order.order_number}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })} · {order.full_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-semibold text-gray-900 hidden sm:inline">
                        {formatAED(order.total)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_STYLES[order.status]?.bg ?? ''
                        } ${STATUS_STYLES[order.status]?.text ?? ''}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {order.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                    </div>
                  </button>

                  {/* Status update controls */}
                  {!isFinal && (
                    <div className="px-4 pb-4 pt-2 border-t border-stone-100 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <label className="text-xs text-gray-400 shrink-0">Update status:</label>
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          disabled={isUpdating}
                          className="text-sm px-2.5 py-1.5 rounded-lg border border-stone-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-gray-900 bg-white disabled:opacity-50"
                        >
                          {ORDER_STAGES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                      {nextStage && (
                        <button
                          onClick={() => updateOrderStatus(order.id, nextStage)}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5" />
                          )}
                          Advance to {nextStage}
                        </button>
                      )}
                      <button
                        onClick={() => updateOrderStatus(order.id, 'Cancelled')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Quick info for final-status orders */}
                  {isFinal && (
                    <div className="px-4 pb-3 pt-2 border-t border-stone-100 flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {order.full_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {order.emirate}
                      </span>
                      <span className="flex items-center gap-1">
                        {order.payment_method === 'Cash on Delivery' ? (
                          <Banknote className="w-3 h-3" />
                        ) : (
                          <CreditCard className="w-3 h-3" />
                        )}
                        {order.payment_method}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="text-center">
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-stone-300 text-gray-700 font-medium hover:bg-stone-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
