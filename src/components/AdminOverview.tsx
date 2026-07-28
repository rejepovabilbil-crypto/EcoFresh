import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Package, Users, AlertTriangle, ChevronRight,
  Clock, CheckCircle2, Truck, XCircle, Loader2, BarChart3,
  ShoppingBag, Boxes,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatAED } from '@/lib/format';

const LOW_STOCK_THRESHOLD = 5;

const STATUS_STYLES: Record<string, { bg: string; text: string; bar: string; icon: typeof Clock }> = {
  'Pending':         { bg: 'bg-amber-100',   text: 'text-amber-700',   bar: 'bg-amber-500',   icon: Clock },
  'Confirmed':       { bg: 'bg-blue-100',    text: 'text-blue-700',    bar: 'bg-blue-500',    icon: CheckCircle2 },
  'Preparing':       { bg: 'bg-cyan-100',    text: 'text-cyan-700',    bar: 'bg-cyan-500',    icon: Package },
  'Packed':          { bg: 'bg-indigo-100',  text: 'text-indigo-700',  bar: 'bg-indigo-500',  icon: Package },
  'Out for Delivery':{ bg: 'bg-orange-100',  text: 'text-orange-700',  bar: 'bg-orange-500',  icon: Truck },
  'Delivered':       { bg: 'bg-green-100',   text: 'text-green-700',   bar: 'bg-green-500',   icon: CheckCircle2 },
  'Cancelled':       { bg: 'bg-red-100',     text: 'text-red-700',     bar: 'bg-red-500',     icon: XCircle },
};

const ALL_STATUSES = Object.keys(STATUS_STYLES);

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  full_name: string;
}

interface ProductRow {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  max_stock: number;
  reserved_quantity: number;
  damaged_quantity: number;
}

interface TopProductRow {
  product_name: string;
  total_qty: number;
}

interface KpiData {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  lowStockCount: number;
}

interface StatusCount {
  status: string;
  count: number;
}

export default function AdminOverview() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiData>({ totalSales: 0, totalOrders: 0, totalCustomers: 0, lowStockCount: 0 });
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<ProductRow[]>([]);

  const fetchAll = useCallback(async () => {
    const [
      ordersRes,
      customersRes,
      productsRes,
      topProductsRes,
    ] = await Promise.all([
      supabase.from('orders').select('id, order_number, status, total, created_at, full_name').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('products').select('id, name, stock, min_stock, max_stock, reserved_quantity, damaged_quantity').order('stock', { ascending: true }),
      supabase.from('order_items').select('product_name, quantity'),
    ]);

    // KPIs
    const orders = (ordersRes.data as OrderRow[]) || [];
    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const products = (productsRes.data as ProductRow[]) || [];
    const lowStock = products.filter((p) => {
      const available = p.stock - (p.reserved_quantity ?? 0) - (p.damaged_quantity ?? 0);
      return available < (p.min_stock || LOW_STOCK_THRESHOLD);
    });

    setKpi({
      totalSales,
      totalOrders: orders.length,
      totalCustomers: customersRes.count || 0,
      lowStockCount: lowStock.length,
    });

    // Status distribution
    const counts: Record<string, number> = {};
    ALL_STATUSES.forEach((s) => (counts[s] = 0));
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status]++;
    });
    setStatusCounts(ALL_STATUSES.map((s) => ({ status: s, count: counts[s] })));

    // Top 5 products by quantity
    const itemRows = (topProductsRes.data as { product_name: string; quantity: number }[]) || [];
    const productMap: Record<string, number> = {};
    itemRows.forEach((r) => {
      productMap[r.product_name] = (productMap[r.product_name] || 0) + r.quantity;
    });
    const sorted = Object.entries(productMap)
      .map(([product_name, total_qty]) => ({ product_name, total_qty }))
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 5);
    setTopProducts(sorted);

    // Recent orders (5 most recent)
    setRecentOrders(orders.slice(0, 5));

    // Low stock products
    setLowStockProducts(lowStock);
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      </div>
    );
  }

  const maxStatusCount = Math.max(...statusCounts.map((s) => s.count), 1);
  const maxProductQty = Math.max(...topProducts.map((p) => p.total_qty), 1);

  return (
    <div className="space-y-8">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          iconBg="bg-green-100"
          iconColor="text-green-700"
          label="Total Sales"
          value={formatAED(kpi.totalSales)}
        />
        <KpiCard
          icon={<Package className="w-5 h-5" />}
          iconBg="bg-blue-100"
          iconColor="text-blue-700"
          label="Total Orders"
          value={String(kpi.totalOrders)}
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-cyan-100"
          iconColor="text-cyan-700"
          label="Total Customers"
          value={String(kpi.totalCustomers)}
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
          label="Low Stock Items"
          value={String(kpi.lowStockCount)}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-green-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Orders by Status</h2>
          </div>
          <div className="space-y-3">
            {statusCounts.map(({ status, count }) => {
              const style = STATUS_STYLES[status];
              const Icon = style.icon;
              const pct = (count / maxStatusCount) * 100;
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 w-32 shrink-0">
                    <Icon className={`w-3.5 h-3.5 ${style.text}`} />
                    <span className="text-xs font-medium text-gray-600 truncate">{status}</span>
                  </div>
                  <div className="flex-1 h-7 bg-stone-100 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full ${style.bar} rounded-lg transition-all duration-500`}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Best-Selling Products */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-green-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Top 5 Best-Selling Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, idx) => {
                const pct = (product.total_qty / maxProductQty) * 100;
                return (
                  <div key={product.product_name} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-gray-400 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate pr-2">{product.product_name}</span>
                        <span className="text-xs font-bold text-gray-900 shrink-0">{product.total_qty} sold</span>
                      </div>
                      <div className="h-6 bg-stone-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg transition-all duration-500"
                          style={{ width: `${Math.max(pct, 10)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Orders & Low Stock Alert ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const style = STATUS_STYLES[order.status] ?? STATUS_STYLES['Pending'];
                const Icon = style.icon;
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 hover:border-green-300 hover:bg-green-50/30 transition-all text-left group"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-gray-900 truncate">{order.order_number}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {order.full_name} · {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-sm text-gray-900 hidden sm:inline">{formatAED(order.total)}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                        <Icon className="w-3 h-3" />
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

        {/* Low Stock Alert */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-amber-700" />
            </div>
            <h2 className="font-semibold text-gray-900">Low Stock Alert</h2>
            <span className="ml-auto text-xs text-gray-400">Threshold: &lt; {LOW_STOCK_THRESHOLD} units</span>
          </div>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">All products are well stocked.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map((product) => {
                const available = product.stock - (product.reserved_quantity ?? 0) - (product.damaged_quantity ?? 0);
                return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-amber-50/30"
                >
                  <span className="text-sm font-medium text-gray-900">{product.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`text-sm font-bold ${available <= 0 ? 'text-red-600' : 'text-amber-700'}`}>
                        {available}
                      </span>
                      <span className="text-xs text-gray-400"> / {product.min_stock || LOW_STOCK_THRESHOLD}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      available <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {available <= 0 ? 'Out of Stock' : 'Low'}
                    </span>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon, iconBg, iconColor, label, value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}