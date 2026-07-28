import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, BarChart3, TrendingUp, ShoppingBag,
  Boxes, Sprout, Activity, Download, Calendar, ChevronDown,
  AlertTriangle, Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatAED } from '@/lib/format';

// ── Types ──
interface OrderRow {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
}
interface OrderItemRow {
  product_name: string;
  quantity: number;
  line_total: number;
}
interface ProductRow {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  damaged_quantity: number;
  unit: string;
}
interface CropBatchRow {
  id: string;
  batch_number: string;
  crop_name: string;
  zone: string;
  actual_yield: number | null;
  expected_yield: number | null;
  yield_unit: string;
  expected_harvest_date: string;
  stage: string;
  updated_at: string;
}
interface SensorReadingRow {
  zone: string;
  temperature: number;
  humidity: number;
  reading_time: string;
}
interface AlertRow {
  id: string;
  zone: string;
  parameter: string;
  severity: 'warning' | 'critical';
  status: string;
  triggered_at: string;
  reading_value: number;
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

// ── CSV Export Utility ──
function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(','),
    ),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateForInput(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Main Component ──
export default function Reports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const [dateFrom, setDateFrom] = useState(formatDateForInput(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(formatDateForInput(today));

  // Sales data
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  // Inventory data
  const [products, setProducts] = useState<ProductRow[]>([]);
  // Crop data
  const [cropBatches, setCropBatches] = useState<CropBatchRow[]>([]);
  // Sensor data
  const [sensorReadings, setSensorReadings] = useState<SensorReadingRow[]>([]);
  // Alert data
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  const startDate = useMemo(() => new Date(dateFrom + 'T00:00:00'), [dateFrom]);
  const endDate = useMemo(() => new Date(dateTo + 'T23:59:59'), [dateTo]);

  const fetchAll = useCallback(async () => {
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const [
      ordersRes,
      itemsRes,
      productsRes,
      cropsRes,
      sensorsRes,
      alertsRes,
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, total, status, created_at')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: true }),
      supabase
        .from('order_items')
        .select('product_name, quantity, line_total, order_id'),
      supabase
        .from('products')
        .select('id, name, category, stock, min_stock, damaged_quantity, unit')
        .order('name', { ascending: true }),
      supabase
        .from('crop_batches')
        .select('id, batch_number, crop_name, zone, actual_yield, expected_yield, yield_unit, expected_harvest_date, stage, updated_at')
        .eq('stage', 'Harvested')
        .gte('updated_at', startISO)
        .lte('updated_at', endISO)
        .order('updated_at', { ascending: false }),
      supabase
        .from('sensor_readings')
        .select('zone, temperature, humidity, reading_time')
        .gte('reading_time', startISO)
        .lte('reading_time', endISO)
        .order('reading_time', { ascending: true }),
      supabase
        .from('environmental_alerts')
        .select('id, zone, parameter, severity, status, triggered_at, reading_value')
        .gte('triggered_at', startISO)
        .lte('triggered_at', endISO)
        .order('triggered_at', { ascending: false }),
    ]);

    // Filter order_items to only those belonging to orders in range
    const orderIds = new Set(((ordersRes.data as OrderRow[]) || []).map((o) => o.id));
    const filteredItems = ((itemsRes.data as (OrderItemRow & { order_id: string })[]) || []).filter(
      (item) => orderIds.has(item.order_id),
    );

    setOrders((ordersRes.data as OrderRow[]) || []);
    setOrderItems(filteredItems.map(({ product_name, quantity, line_total }) => ({ product_name, quantity, line_total })));
    setProducts((productsRes.data as ProductRow[]) || []);
    setCropBatches((cropsRes.data as CropBatchRow[]) || []);
    setSensorReadings((sensorsRes.data as SensorReadingRow[]) || []);
    setAlerts((alertsRes.data as AlertRow[]) || []);
  }, [startDate, endDate, dateFrom, dateTo]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // ── Sales Metrics ──
  const salesMetrics = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Revenue by day
    const byDay: Record<string, number> = {};
    orders.forEach((o) => {
      const day = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDay[day] = (byDay[day] || 0) + (o.total || 0);
    });

    // Top products
    const productMap: Record<string, { name: string; units: number; revenue: number }> = {};
    orderItems.forEach((item) => {
      if (!productMap[item.product_name]) {
        productMap[item.product_name] = { name: item.product_name, units: 0, revenue: 0 };
      }
      productMap[item.product_name].units += item.quantity;
      productMap[item.product_name].revenue += Number(item.line_total) || 0;
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { totalRevenue, totalOrders, avgOrderValue, byDay, topProducts };
  }, [orders, orderItems]);

  // ── Inventory Metrics ──
  const inventoryMetrics = useMemo(() => {
    const lowStock = products.filter((p) => p.stock <= p.min_stock && p.min_stock > 0);
    const hasDamaged = products.filter((p) => p.damaged_quantity > 0);

    // Stock movement: units sold (from order_items) vs units restocked
    // We don't have a restock log table, so we approximate restocked as max_stock - (stock + sold)
    // For a simpler approach: show units sold from order_items, and current stock levels
    const unitsSoldByProduct: Record<string, number> = {};
    orderItems.forEach((item) => {
      unitsSoldByProduct[item.product_name] = (unitsSoldByProduct[item.product_name] || 0) + item.quantity;
    });

    return { lowStock, hasDamaged, unitsSoldByProduct };
  }, [products, orderItems]);

  // ── Crop Yield Metrics ──
  const cropMetrics = useMemo(() => {
    const harvested = cropBatches;
    const yieldByZone: Record<string, number> = {};
    harvested.forEach((c) => {
      yieldByZone[c.zone] = (yieldByZone[c.zone] || 0) + Number(c.actual_yield || 0);
    });
    return { harvested, yieldByZone };
  }, [cropBatches]);

  // ── Environmental Metrics ──
  const envMetrics = useMemo(() => {
    // Alert counts by zone and severity
    const alertCounts: Record<string, { warning: number; critical: number; total: number }> = {};
    ZONES.forEach((z) => {
      alertCounts[z] = { warning: 0, critical: 0, total: 0 };
    });
    alerts.forEach((a) => {
      if (!alertCounts[a.zone]) alertCounts[a.zone] = { warning: 0, critical: 0, total: 0 };
      alertCounts[a.zone][a.severity] += 1;
      alertCounts[a.zone].total += 1;
    });

    return { alertCounts };
  }, [alerts, sensorReadings]);

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
            <BarChart3 className="w-6 h-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-500 mt-0.5">Business intelligence across sales, inventory, crops, and environment</p>
          </div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition text-sm"
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: '7D', days: 7 },
              { label: '30D', days: 30 },
              { label: '90D', days: 90 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(end.getDate() - preset.days);
                  setDateFrom(formatDateForInput(start));
                  setDateTo(formatDateForInput(end));
                }}
                className="px-3 py-2.5 rounded-lg text-xs font-medium text-gray-600 bg-stone-100 hover:bg-stone-200 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sales Report ── */}
      <ReportSection
        icon={<TrendingUp className="w-5 h-5 text-green-700" />}
        iconBg="bg-green-100"
        title="Sales Report"
        onExport={() =>
          exportCSV(`sales-report_${dateFrom}_to_${dateTo}.csv`, [
            ...orders.map((o) => ({
              order_number: o.order_number,
              total: o.total,
              status: o.status,
              date: new Date(o.created_at).toLocaleDateString(),
            })),
          ])
        }
      >
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <SummaryCard label="Total Revenue" value={formatAED(salesMetrics.totalRevenue)} icon={<TrendingUp className="w-4 h-4 text-green-600" />} />
          <SummaryCard label="Total Orders" value={String(salesMetrics.totalOrders)} icon={<ShoppingBag className="w-4 h-4 text-blue-600" />} />
          <SummaryCard label="Avg Order Value" value={formatAED(salesMetrics.avgOrderValue)} icon={<BarChart3 className="w-4 h-4 text-purple-600" />} />
        </div>

        {/* Revenue chart */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue Over Time</h3>
          <RevenueChart data={salesMetrics.byDay} />
        </div>

        {/* Top products */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Top 5 Best-Selling Products</h3>
            <button
              onClick={() =>
                exportCSV(`top-products_${dateFrom}_to_${dateTo}.csv`, salesMetrics.topProducts.map((p) => ({
                  product: p.name,
                  units_sold: p.units,
                  revenue: p.revenue.toFixed(2),
                })))
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
          {salesMetrics.topProducts.length === 0 ? (
            <EmptyState message="No sales in this period." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Product</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Units Sold</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {salesMetrics.topProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{p.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{p.units}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatAED(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ReportSection>

      {/* ── Inventory Report ── */}
      <ReportSection
        icon={<Boxes className="w-5 h-5 text-teal-700" />}
        iconBg="bg-teal-100"
        title="Inventory Report"
        onExport={() =>
          exportCSV(`inventory-report_${dateFrom}_to_${dateTo}.csv`, products.map((p) => ({
            product: p.name,
            category: p.category,
            current_stock: p.stock,
            min_stock: p.min_stock,
            damaged: p.damaged_quantity,
            unit: p.unit,
            status: p.stock <= p.min_stock && p.min_stock > 0 ? 'LOW STOCK' : p.damaged_quantity > 0 ? 'HAS DAMAGED' : 'OK',
          })))
        }
      >
        {/* Stock levels table */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Current Stock Levels</h3>
          {products.length === 0 ? (
            <EmptyState message="No products found." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Product</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Category</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Stock</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Min Stock</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Damaged</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {products.map((p) => {
                    const isLow = p.stock <= p.min_stock && p.min_stock > 0;
                    const hasDamaged = p.damaged_quantity > 0;
                    return (
                      <tr key={p.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{p.name}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-gray-500">{p.category}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{p.stock} {p.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500 hidden md:table-cell">{p.min_stock}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className={`text-sm ${hasDamaged ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>{p.damaged_quantity}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock
                            </span>
                          ) : hasDamaged ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Package className="w-3 h-3" />
                              Damaged
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stock movement chart */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Stock Movement (Units Sold by Product)</h3>
          <StockMovementChart products={products} unitsSold={inventoryMetrics.unitsSoldByProduct} />
        </div>
      </ReportSection>

      {/* ── Crop Yield Report ── */}
      <ReportSection
        icon={<Sprout className="w-5 h-5 text-blue-700" />}
        iconBg="bg-blue-100"
        title="Crop Yield Report"
        onExport={() =>
          exportCSV(`crop-yield_${dateFrom}_to_${dateTo}.csv`, cropMetrics.harvested.map((c) => ({
            batch_number: c.batch_number,
            crop_name: c.crop_name,
            zone: c.zone,
            actual_yield: c.actual_yield,
            yield_unit: c.yield_unit,
            harvest_date: new Date(c.updated_at).toLocaleDateString(),
            stage: c.stage,
          })))
        }
      >
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Harvested Crop Batches</h3>
          {cropMetrics.harvested.length === 0 ? (
            <EmptyState message="No harvested crops in this period." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Crop</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Batch</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Zone</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Yield</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Harvest Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {cropMetrics.harvested.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{c.crop_name}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="font-mono text-xs text-gray-400">{c.batch_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{c.zone}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900">{c.actual_yield} {c.yield_unit}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-500">{new Date(c.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Yield by zone chart */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Total Yield by Zone</h3>
          <YieldByZoneChart yieldByZone={cropMetrics.yieldByZone} />
        </div>
      </ReportSection>

      {/* ── Environmental Report ── */}
      <ReportSection
        icon={<Activity className="w-5 h-5 text-cyan-700" />}
        iconBg="bg-cyan-100"
        title="Environmental Report"
        onExport={() =>
          exportCSV(`environmental-report_${dateFrom}_to_${dateTo}.csv`, alerts.map((a) => ({
            zone: a.zone,
            parameter: PARAMETER_LABELS[a.parameter] || a.parameter,
            severity: a.severity,
            status: a.status,
            value: a.reading_value,
            triggered_at: new Date(a.triggered_at).toLocaleString(),
          })))
        }
      >
        {/* Alert counts by zone */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Alert Counts by Zone & Severity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ZONES.map((zone) => {
              const counts = envMetrics.alertCounts[zone] || { warning: 0, critical: 0, total: 0 };
              return (
                <div key={zone} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold bg-cyan-50 text-cyan-700">{zone}</span>
                    <span className="text-xs text-gray-400">{counts.total} total</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        Critical
                      </span>
                      <span className="text-sm font-semibold text-red-600">{counts.critical}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        Warning
                      </span>
                      <span className="text-sm font-semibold text-amber-600">{counts.warning}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sensor trend chart */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Average Temperature & Humidity Trend by Zone</h3>
          <EnvTrendChart readings={sensorReadings} />
        </div>
      </ReportSection>
    </div>
  );
}

// ── Sub-components ──

function ReportSection({
  icon, iconBg, title, onExport, children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  onExport: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <h2 className="font-semibold text-gray-900 text-lg">{title}</h2>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-stone-100 hover:bg-stone-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10 bg-stone-50/50 rounded-xl border border-stone-200">
      <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ── Charts (SVG-based, matching existing style) ──

function RevenueChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <EmptyState message="No revenue data for this period." />;

  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = entries.map(([, v]) => v);
  const maxVal = Math.max(...values, 1);
  const xStep = entries.length > 1 ? chartW / (entries.length - 1) : 0;

  function toX(i: number) {
    return padding.left + (entries.length > 1 ? i * xStep : chartW / 2);
  }
  function toY(val: number) {
    return padding.top + chartH - (val / maxVal) * chartH;
  }

  const barWidth = Math.min(30, entries.length > 1 ? xStep * 0.6 : 40);
  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal * i) / yTicks);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ height: 'auto' }}>
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
        {entries.map(([label, val], i) => {
          if (entries.length > 10 && i % Math.ceil(entries.length / 8) !== 0) return null;
          return (
            <text key={i} x={toX(i)} y={height - padding.bottom + 18} textAnchor="middle" className="fill-stone-400" style={{ fontSize: '11px' }}>
              {label}
            </text>
          );
        })}
        {entries.map(([label, val], i) => {
          const x = toX(i) - barWidth / 2;
          const y = toY(val);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={padding.top + chartH - y} rx={3} fill="#16a34a" opacity={0.85} />
              <text x={toX(i)} y={y - 6} textAnchor="middle" className="fill-stone-500" style={{ fontSize: '10px' }}>
                {val > 0 ? val.toFixed(0) : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StockMovementChart({ products, unitsSold }: { products: ProductRow[]; unitsSold: Record<string, number> }) {
  const topProducts = products
    .map((p) => ({ name: p.name, sold: unitsSold[p.name] || 0, stock: p.stock }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 8);

  if (topProducts.length === 0 || topProducts.every((p) => p.sold === 0)) {
    return <EmptyState message="No stock movement in this period." />;
  }

  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...topProducts.map((p) => Math.max(p.sold, p.stock)), 1);
  const barGroupWidth = chartW / topProducts.length;
  const barWidth = Math.min(16, barGroupWidth * 0.3);
  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal * i) / yTicks);

  function toY(val: number) {
    return padding.top + chartH - (val / maxVal) * chartH;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ height: 'auto' }}>
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
        {topProducts.map((p, i) => {
          const groupX = padding.left + i * barGroupWidth + barGroupWidth / 2;
          return (
            <g key={i}>
              <rect x={groupX - barWidth - 2} y={toY(p.sold)} width={barWidth} height={padding.top + chartH - toY(p.sold)} rx={3} fill="#0d9488" opacity={0.85} />
              <rect x={groupX + 2} y={toY(p.stock)} width={barWidth} height={padding.top + chartH - toY(p.stock)} rx={3} fill="#94a3b8" opacity={0.7} />
              <text x={groupX} y={height - padding.bottom + 18} textAnchor="middle" className="fill-stone-400" style={{ fontSize: '10px' }}>
                {p.name.length > 12 ? p.name.slice(0, 10) + '…' : p.name}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <g transform={`translate(${padding.left}, ${padding.top - 6})`}>
          <rect x={0} y={-8} width={10} height={10} rx={2} fill="#0d9488" opacity={0.85} />
          <text x={14} y={1} className="fill-stone-600" style={{ fontSize: '11px' }}>Units Sold</text>
          <rect x={90} y={-8} width={10} height={10} rx={2} fill="#94a3b8" opacity={0.7} />
          <text x={104} y={1} className="fill-stone-600" style={{ fontSize: '11px' }}>Current Stock</text>
        </g>
      </svg>
    </div>
  );
}

function YieldByZoneChart({ yieldByZone }: { yieldByZone: Record<string, number> }) {
  const zones = ZONES.filter((z) => yieldByZone[z] !== undefined);
  if (zones.length === 0) return <EmptyState message="No harvested yield data for this period." />;

  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...zones.map((z) => yieldByZone[z]), 1);
  const barWidth = Math.min(60, chartW / zones.length * 0.5);
  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal * i) / yTicks);

  function toY(val: number) {
    return padding.top + chartH - (val / maxVal) * chartH;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ height: 'auto' }}>
        {tickVals.map((tv, i) => {
          const y = toY(tv);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f5f5f4" strokeWidth={1} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-stone-400" style={{ fontSize: '11px' }}>
                {tv.toFixed(1)}
              </text>
            </g>
          );
        })}
        {zones.map((zone, i) => {
          const val = yieldByZone[zone];
          const x = padding.left + (i + 0.5) * (chartW / zones.length) - barWidth / 2;
          const y = toY(val);
          return (
            <g key={zone}>
              <rect x={x} y={y} width={barWidth} height={padding.top + chartH - y} rx={4} fill="#2563eb" opacity={0.85} />
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="fill-stone-500" style={{ fontSize: '11px', fontWeight: 600 }}>
                {val.toFixed(1)}
              </text>
              <text x={x + barWidth / 2} y={height - padding.bottom + 18} textAnchor="middle" className="fill-stone-400" style={{ fontSize: '11px' }}>
                {zone}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EnvTrendChart({ readings }: { readings: SensorReadingRow[] }) {
  const zonesWithData = ZONES.filter((z) => readings.some((r) => r.zone === z));
  if (zonesWithData.length === 0) return <EmptyState message="No sensor data for this period." />;

  // Group readings by zone, sorted by time
  const zoneReadings: Record<string, SensorReadingRow[]> = {};
  zonesWithData.forEach((z) => {
    zoneReadings[z] = readings
      .filter((r) => r.zone === z)
      .sort((a, b) => new Date(a.reading_time).getTime() - new Date(b.reading_time).getTime());
  });

  // Collect all unique timestamps across zones, sorted
  const allTimestamps = [...new Set(readings.map((r) => r.reading_time))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  const width = 800;
  const height = 280;
  const padding = { top: 20, right: 50, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const allTemps = readings.map((r) => r.temperature);
  const allHumids = readings.map((r) => r.humidity);
  const minVal = Math.min(...allTemps, ...allHumids) - 2;
  const maxVal = Math.max(...allTemps, ...allHumids) + 2;
  const valRange = maxVal - minVal || 1;

  const xStep = allTimestamps.length > 1 ? chartW / (allTimestamps.length - 1) : 0;

  function toX(i: number) {
    return padding.left + (allTimestamps.length > 1 ? i * xStep : chartW / 2);
  }
  function toY(val: number) {
    return padding.top + chartH - ((val - minVal) / valRange) * chartH;
  }

  const zoneColors: Record<string, { temp: string; humid: string }> = {
    'Zone A': { temp: '#f97316', humid: '#3b82f6' },
    'Zone B': { temp: '#ea580c', humid: '#2563eb' },
    'Zone C': { temp: '#dc2626', humid: '#1d4ed8' },
  };

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => minVal + (valRange * i) / yTicks);

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]" style={{ height: 'auto' }}>
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
          {allTimestamps.map((ts, i) => {
            if (allTimestamps.length > 8 && i % Math.ceil(allTimestamps.length / 6) !== 0) return null;
            return (
              <text key={i} x={toX(i)} y={height - padding.bottom + 18} textAnchor="middle" className="fill-stone-400" style={{ fontSize: '11px' }}>
                {new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </text>
            );
          })}
          {zonesWithData.map((zone) => {
            const points = zoneReadings[zone];
            if (points.length === 0) return null;
            const colors = zoneColors[zone] || { temp: '#f97316', humid: '#3b82f6' };
            const pointData = points.map((p) => {
              const idx = allTimestamps.indexOf(p.reading_time);
              return { x: toX(idx), temp: p.temperature, humid: p.humidity };
            });
            const tempPath = pointData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${toY(p.temp)}`).join(' ');
            const humidPath = pointData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${toY(p.humid)}`).join(' ');
            return (
              <g key={zone}>
                <path d={tempPath} fill="none" stroke={colors.temp} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
                <path d={humidPath} fill="none" stroke={colors.humid} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} strokeDasharray="4 2" />
                {pointData.map((p, i) => (
                  <circle key={`t${i}`} cx={p.x} cy={toY(p.temp)} r={3} fill={colors.temp} />
                ))}
                {pointData.map((p, i) => (
                  <circle key={`h${i}`} cx={p.x} cy={toY(p.humid)} r={3} fill={colors.humid} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      {/* HTML Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 px-2">
        {zonesWithData.map((zone) => {
          const colors = zoneColors[zone] || { temp: '#f97316', humid: '#3b82f6' };
          return (
            <div key={zone} className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600">{zone}</span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: colors.temp }} />
                <span className="text-xs text-gray-500">Temp</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: colors.humid }} />
                <span className="text-xs text-gray-500">Humidity</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
