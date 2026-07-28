import { useEffect, useState, useCallback } from 'react';
import {
  LogOut, Mail, Phone, MapPin, User as UserIcon, Package, Bell, ShoppingBag,
  CheckCircle2, Clock, Truck, ChevronRight, Pencil, Save, XCircle,
  AlertCircle, Calendar, CreditCard, Banknote,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatAED } from '@/lib/format';

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

interface NotificationRow {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
  order_id: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  'Pending': { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  'Confirmed': { bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle2 },
  'Preparing': { bg: 'bg-purple-100', text: 'text-purple-700', icon: Package },
  'Packed': { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: Package },
  'Out for Delivery': { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: Truck },
  'Delivered': { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  'Cancelled': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
};

const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

export default function AccountDashboard() {
  const { profile, user, signOut, refreshProfile } = useAuth();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', delivery_address: '', emirate: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, notifsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (notifsRes.error) throw notifsRes.error;

      setOrders((ordersRes.data as OrderRow[]) || []);
      setNotifications((notifsRes.data as NotificationRow[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Seed sample notifications if none exist
  useEffect(() => {
    if (!user || loading || notifications.length > 0) return;
    const sampleNotifs = [
      { user_id: user.id, message: 'Welcome to EcoFresh! Your account is ready to start ordering fresh produce.', read: false },
      { user_id: user.id, message: 'Pro tip: Save your delivery address in My Profile for faster checkout next time.', read: false },
    ];
    supabase.from('notifications').insert(sampleNotifs).then(({ data }) => {
      if (data) fetchDashboardData();
    });
  }, [user, loading, notifications.length, fetchDashboardData]);

  const navigate = useNavigate();

  function startEditProfile() {
    setProfileForm({
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      delivery_address: profile?.delivery_address ?? '',
      emirate: profile?.emirate ?? '',
    });
    setProfileError(null);
    setEditingProfile(true);
  }

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone || null,
          delivery_address: profileForm.delivery_address || null,
          emirate: profileForm.emirate || null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setEditingProfile(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function markNotificationRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  if (!profile) return null;

  const totalOrders = orders.length;
  const recentOrders = orders.slice(0, 3);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-green-700">
            Customer Account
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {profile.full_name.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 mt-1">Manage your profile, orders, and notifications</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
              <p className="text-xs text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
              <p className="text-xs text-gray-500">Unread Notifications</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{memberSince}</p>
              <p className="text-xs text-gray-500">Member Since</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      {recentOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm mb-8">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Recent Activity
          </h2>
          <div className="space-y-2">
            {recentOrders.map((order) => {
              const StatusIcon = STATUS_STYLES[order.status]?.icon ?? Clock;
              return (
                <div key={order.id} className="flex items-center justify-between text-sm py-2 border-b border-stone-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-500">{order.order_number}</span>
                    <span className="text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{formatAED(order.total)}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[order.status]?.bg ?? ''} ${STATUS_STYLES[order.status]?.text ?? ''}`}>
                      <StatusIcon className="w-3 h-3" />
                      {order.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* My Profile */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-green-700" />
              </div>
              <h2 className="font-semibold text-gray-900">My Profile</h2>
            </div>
            {!editingProfile ? (
              <button
                onClick={startEditProfile}
                className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium hover:text-green-800 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 text-sm text-white bg-green-600 font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingProfile ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingProfile(false)}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>

          {profileError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {profileError}
            </div>
          )}

          {!editingProfile ? (
            <dl className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <UserIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-gray-500 text-xs">Full Name</dt>
                  <dd className="font-medium text-gray-900">{profile.full_name}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-gray-500 text-xs">Email</dt>
                  <dd className="font-medium text-gray-900">{profile.email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-gray-500 text-xs">Phone</dt>
                  <dd className="font-medium text-gray-900">{profile.phone || 'Not set'}</dd>
    </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-gray-500 text-xs">Delivery Address</dt>
                  <dd className="font-medium text-gray-900">
                    {profile.delivery_address
                      ? `${profile.delivery_address}${profile.emirate ? `, ${profile.emirate}` : ''}`
                      : 'Not set'}
                  </dd>
                </div>
              </div>
            </dl>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+971 50 123 4567"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Delivery Address</label>
                <textarea
                  value={profileForm.delivery_address}
                  onChange={(e) => setProfileForm({ ...profileForm, delivery_address: e.target.value })}
                  rows={2}
                  placeholder="Apartment, street, building..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-gray-900 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Emirate</label>
                <select
                  value={profileForm.emirate}
                  onChange={(e) => setProfileForm({ ...profileForm, emirate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-gray-900 bg-white"
                >
                  <option value="">Select emirate...</option>
                  {EMIRATES.map((em) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email cannot be changed here. Contact support if needed.
              </p>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                {unreadCount} new
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-lg border transition-colors ${notif.read ? 'bg-stone-50 border-stone-200' : 'bg-blue-50 border-blue-200'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notif.read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!notif.read && (
                      <button
                        onClick={() => markNotificationRead(notif.id)}
                        className="text-xs text-blue-600 font-medium hover:text-blue-800 shrink-0"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My Orders */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-green-700" />
          </div>
          <h2 className="font-semibold text-gray-900">My Orders</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
            <a
              href="/shop"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
            >
              Start Shopping
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const StatusIcon = STATUS_STYLES[order.status]?.icon ?? Clock;
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-stone-200 hover:border-green-300 hover:bg-green-50/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-semibold text-gray-900 hidden sm:inline">{formatAED(order.total)}</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[order.status]?.bg ?? ''} ${STATUS_STYLES[order.status]?.text ?? ''}`}>
                      <StatusIcon className="w-3 h-3" />
                      {order.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                  </div>
                </button>
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
