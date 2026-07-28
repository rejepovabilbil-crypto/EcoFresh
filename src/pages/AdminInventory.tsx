import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, ArrowLeft, Package, AlertTriangle, X,
  Check, Save, Boxes, ShieldAlert, Pencil, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/data/products';
import {
  getAvailableStock, getInventoryStatus, INVENTORY_STATUS_STYLES,
  type InventoryStatus,
} from '@/lib/inventory';

interface InventoryRow extends Product {}

export default function AdminInventory() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const [adjustTarget, setAdjustTarget] = useState<InventoryRow | null>(null);
  const [damageTarget, setDamageTarget] = useState<InventoryRow | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error('Failed to load products:', error.message);
      return;
    }
    const mapped: InventoryRow[] = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: Number(p.price),
      unit: p.unit,
      stock: p.stock,
      min_stock: p.min_stock ?? 5,
      max_stock: p.max_stock ?? 100,
      reserved_quantity: p.reserved_quantity ?? 0,
      damaged_quantity: p.damaged_quantity ?? 0,
      image: p.image,
      featured: p.featured,
      active: p.active ?? true,
    }));
    setProducts(mapped);
  }, []);

  useEffect(() => {
    fetchProducts().finally(() => setLoading(false));
  }, [fetchProducts]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProducts]);

  const productsWithStatus = useMemo(() => {
    return products.map((p) => ({ ...p, _status: getInventoryStatus(p), _available: getAvailableStock(p) }));
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...productsWithStatus];
    if (statusFilter !== 'All') {
      result = result.filter((p) => p._status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return result;
  }, [productsWithStatus, search, statusFilter]);

  const lowStockCount = useMemo(
    () => productsWithStatus.filter((p) => p._status === 'Low Stock' || p._status === 'Out of Stock').length,
    [productsWithStatus]
  );
  const overstockedCount = useMemo(
    () => productsWithStatus.filter((p) => p._status === 'Overstocked').length,
    [productsWithStatus]
  );

  function showMessage(type: 'success' | 'error', text: string) {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
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
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-gray-500 mt-1">Monitor stock levels, adjust thresholds, and track damaged goods</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          icon={Boxes}
          label="Total Products"
          value={products.length}
          color="bg-blue-100 text-blue-700"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Low / Out of Stock"
          value={lowStockCount}
          color="bg-amber-100 text-amber-700"
          highlight={lowStockCount > 0}
        />
        <SummaryCard
          icon={ShieldAlert}
          label="Overstocked"
          value={overstockedCount}
          color="bg-cyan-100 text-cyan-700"
        />
        <SummaryCard
          icon={Package}
          label="Damaged Items"
          value={products.reduce((sum, p) => sum + p.damaged_quantity, 0)}
          color="bg-red-100 text-red-700"
        />
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {lowStockCount} {lowStockCount === 1 ? 'product' : 'products'} need{lowStockCount === 1 ? 's' : ''} restocking
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Review and reorder before running out completely
            </p>
          </div>
        </div>
      )}

      {/* Action message */}
      {actionMessage && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          actionMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {actionMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {actionMessage.text}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer min-w-[180px]"
        >
          <option value="All">All Statuses</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
          <option value="Overstocked">Overstocked</option>
        </select>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No products found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Product</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Available</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Reserved</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Damaged</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Min / Max</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((product) => {
                  const style = INVENTORY_STATUS_STYLES[product._status as InventoryStatus];
                  return (
                    <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-gray-400 truncate">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${product._available <= 0 ? 'text-red-600' : product._available < product.min_stock ? 'text-amber-600' : 'text-gray-900'}`}>
                          {product._available}
                        </span>
                        <p className="text-xs text-gray-400">of {product.stock}</p>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="text-sm text-gray-600">{product.reserved_quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-sm font-medium ${product.damaged_quantity > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {product.damaged_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="text-sm text-gray-500">
                          {product.min_stock} / {product.max_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {product._status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setAdjustTarget(product)}
                            className="p-2 rounded-lg text-gray-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Adjust thresholds"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDamageTarget(product)}
                            disabled={product._available <= 0}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={product._available <= 0 ? 'No available stock to damage' : 'Mark damaged'}
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
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

      {/* Adjust thresholds modal */}
      {adjustTarget && (
        <AdjustThresholdsModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={(msg) => { showMessage('success', msg); setAdjustTarget(null); fetchProducts(); }}
          onError={(msg) => showMessage('error', msg)}
        />
      )}

      {/* Mark damaged modal */}
      {damageTarget && (
        <MarkDamagedModal
          product={damageTarget}
          onClose={() => setDamageTarget(null)}
          onSaved={(msg) => { showMessage('success', msg); setDamageTarget(null); fetchProducts(); }}
          onError={(msg) => showMessage('error', msg)}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, highlight }: { icon: typeof Package; label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 shadow-sm ${highlight ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function AdjustThresholdsModal({
  product, onClose, onSaved, onError,
}: {
  product: InventoryRow;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [minStock, setMinStock] = useState(String(product.min_stock));
  const [maxStock, setMaxStock] = useState(String(product.max_stock));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const min = parseInt(minStock, 10);
    const max = parseInt(maxStock, 10);
    if (isNaN(min) || min < 0) { setError('Min stock must be 0 or greater'); return; }
    if (isNaN(max) || max < 0) { setError('Max stock must be 0 or greater'); return; }
    if (max <= min) { setError('Max stock must be greater than min stock'); return; }

    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('products')
      .update({ min_stock: min, max_stock: max })
      .eq('id', product.id);
    setSaving(false);

    if (updateError) {
      const msg = 'Failed to update: ' + updateError.message;
      setError(msg);
      onError(msg);
      return;
    }
    onSaved(`Thresholds updated for ${product.name}`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Adjust Stock Thresholds</h2>
        <p className="text-sm text-gray-500 mb-5">{product.name}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Stock Level</label>
            <input
              type="number"
              min="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
            <p className="text-xs text-gray-400 mt-1">Below this = Low Stock</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Stock Level</label>
            <input
              type="number"
              min="0"
              value={maxStock}
              onChange={(e) => setMaxStock(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
            <p className="text-xs text-gray-400 mt-1">Above this = Overstocked</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkDamagedModal({
  product, onClose, onSaved, onError,
}: {
  product: InventoryRow;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const available = getAvailableStock(product);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be greater than 0'); return; }
    if (qty > available) { setError(`Cannot damage more than available stock (${available})`); return; }

    setSaving(true);
    setError(null);
    const newDamaged = product.damaged_quantity + qty;
    const { error: updateError } = await supabase
      .from('products')
      .update({ damaged_quantity: newDamaged })
      .eq('id', product.id);
    setSaving(false);

    if (updateError) {
      const msg = 'Failed to mark damaged: ' + updateError.message;
      setError(msg);
      onError(msg);
      return;
    }
    onSaved(`Marked ${qty} ${product.unit} of ${product.name} as damaged`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Mark Stock as Damaged</h2>
            <p className="text-sm text-gray-500 mt-0.5">{product.name}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        <div className="space-y-4 mb-6">
          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">Available Stock</span>
            <span className="font-bold text-gray-900">{available} {product.unit}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Damaged Quantity</label>
            <input
              type="number"
              min="1"
              max={available}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Pest damage, spoilage, transport damage"
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            Mark Damaged
          </button>
        </div>
      </div>
    </div>
  );
}
