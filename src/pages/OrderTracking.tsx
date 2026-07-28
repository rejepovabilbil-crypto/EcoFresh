import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Clock, CheckCircle2, Package, Truck, ChefHat,
  Box, Home, XCircle, MapPin, CreditCard, Banknote, Calendar,
  User as UserIcon, Phone, AlertCircle, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatAED } from '@/lib/format';

const ORDER_STAGES = [
  { key: 'Pending', label: 'Order Placed', icon: Clock },
  { key: 'Confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'Preparing', label: 'Preparing', icon: ChefHat },
  { key: 'Packed', label: 'Packed', icon: Box },
  { key: 'Out for Delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'Delivered', label: 'Delivered', icon: Home },
] as const;

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

interface OrderItemRow {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface HistoryRow {
  id: string;
  status: string;
  changed_at: string;
  changed_by: string | null;
}

export default function OrderTracking() {
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (fetchError) {
      setError('Failed to load order.');
      return;
    }
    if (!data) {
      setError('Order not found.');
      return;
    }
    setOrder(data as OrderRow);
  }, [orderId]);

  const fetchItems = useCallback(async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('product_name', { ascending: true });
    setItems((data as OrderItemRow[]) || []);
  }, [orderId]);

  const fetchHistory = useCallback(async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: true });
    setHistory((data as HistoryRow[]) || []);
  }, [orderId]);

  useEffect(() => {
    Promise.all([fetchOrder(), fetchItems(), fetchHistory()]).finally(() =>
      setLoading(false)
    );
  }, [fetchOrder, fetchItems, fetchHistory]);

  // Realtime subscription on the orders table
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(payload.new as OrderRow);
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, fetchHistory]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-6">{error || 'Order not found.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  const currentStageIndex = ORDER_STAGES.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === 'Cancelled';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-700 font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {profile?.role === 'customer' ? 'My Orders' : 'Dashboard'}
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-green-800 to-emerald-900 rounded-2xl p-6 mb-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-green-100 text-sm mb-1">Order Number</p>
            <p className="text-2xl font-bold text-white font-mono">{order.order_number}</p>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <p className="text-green-100 text-sm">
              {new Date(order.created_at).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                isCancelled
                  ? 'bg-red-500/20 text-red-100'
                  : 'bg-white/15 text-white'
              }`}
            >
              {isCancelled ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {order.status}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline / Cancelled state */}
      {isCancelled ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 mb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Order Cancelled</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            This order has been cancelled. If you have any questions, please contact our support team.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Order Progress</h2>

          {/* Desktop horizontal stepper */}
          <div className="hidden sm:flex items-center justify-between mb-2">
            {ORDER_STAGES.map((stage, idx) => {
              const isComplete = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex flex-col items-center flex-1 relative">
                  {/* Connector line */}
                  {idx > 0 && (
                    <div
                      className={`absolute top-5 left-0 -translate-x-1/2 h-0.5 w-full ${
                        idx <= currentStageIndex ? 'bg-green-600' : 'bg-stone-200'
                      }`}
                    />
                  )}
                  {/* Circle */}
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isComplete
                        ? 'bg-green-600 text-white'
                        : isCurrent
                        ? 'bg-green-100 text-green-700 ring-4 ring-green-200'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {/* Label */}
                  <p
                    className={`mt-2 text-xs font-medium text-center transition-colors ${
                      isCurrent ? 'text-green-700' : isComplete ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mobile vertical stepper */}
          <div className="sm:hidden space-y-1">
            {ORDER_STAGES.map((stage, idx) => {
              const isComplete = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isComplete
                          ? 'bg-green-600 text-white'
                          : isCurrent
                          ? 'bg-green-100 text-green-700 ring-4 ring-green-200'
                          : 'bg-stone-100 text-stone-400'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    {idx < ORDER_STAGES.length - 1 && (
                      <div className={`w-0.5 h-8 ${idx < currentStageIndex ? 'bg-green-600' : 'bg-stone-200'}`} />
                    )}
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      isCurrent ? 'text-green-700' : isComplete ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Status history log */}
          {history.length > 0 && (
            <div className="mt-8 pt-6 border-t border-stone-100">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Status History</h3>
              <div className="space-y-3">
                {history.map((h, idx) => {
                  const stageInfo = ORDER_STAGES.find((s) => s.key === h.status);
                  const isCancel = h.status === 'Cancelled';
                  const Icon = isCancel ? XCircle : stageInfo?.icon ?? Clock;
                  return (
                    <div key={h.id} className="flex items-start gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isCancel
                            ? 'bg-red-100 text-red-600'
                            : idx === history.length - 1
                            ? 'bg-green-100 text-green-700'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{h.status}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(h.changed_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Items Ordered</h3>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-2 border-b border-stone-100 last:border-0">
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">{item.quantity}x</span> {item.product_name}
                </span>
                <span className="font-medium text-gray-900">{formatAED(item.line_total)}</span>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-gray-400">No item details available.</p>
            )}
          </div>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-stone-200 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatAED(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT (5%)</span>
              <span>{formatAED(order.vat)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery Fee</span>
              <span>{formatAED(order.delivery_fee)}</span>
            </div>
            <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-gray-900 text-base">
              <span>Total</span>
              <span>{formatAED(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Delivery & Payment */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Delivery Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <UserIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-gray-600">{order.full_name}</span>
            </div>
            {order.phone && (
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-600">{order.phone}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-gray-600">{order.delivery_address}, {order.emirate}</span>
            </div>
            {order.delivery_date && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-600">
                  {new Date(order.delivery_date).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
              </div>
            )}
            <div className="flex items-start gap-2">
              {order.payment_method === 'Cash on Delivery' ? (
                <Banknote className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              ) : (
                <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              )}
              <span className="text-gray-600">{order.payment_method}</span>
            </div>
            {order.instructions && (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-600">{order.instructions}</span>
              </div>
            )}
          </div>

          {/* Payment status */}
          <div className="mt-5 pt-4 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Payment Status</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  order.payment_method === 'Cash on Delivery'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {order.payment_method === 'Cash on Delivery' ? (
                  <>
                    <Clock className="w-3 h-3" />
                    Pay on Delivery
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Paid
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Back to shop link */}
      <div className="mt-8 text-center">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
