import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2, X, Loader2, Package, ArrowLeft,
  Image as ImageIcon, Check, Power,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatAED } from '@/lib/format';
import type { Product } from '@/data/products';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getAvailableStock, getInventoryStatus, INVENTORY_STATUS_STYLES, type InventoryStatus } from '@/lib/inventory';

const CATEGORIES = ['Leafy Greens', 'Herbs', 'Microgreens', 'Fruiting Plants'] as const;
const UNITS = ['per bunch', 'per tray', 'per piece', 'per kg', 'per 100g', 'per box'] as const;

interface ProductFormData {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: string;
  unit: string;
  stock: string;
  min_stock: string;
  image: string;
  active: boolean;
}

const EMPTY_FORM: ProductFormData = {
  name: '',
  description: '',
  category: 'Leafy Greens',
  price: '',
  unit: 'per bunch',
  stock: '0',
  min_stock: '5',
  image: '',
  active: true,
};

export default function AdminProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to load products:', error.message);
      return;
    }
    const mapped: Product[] = (data || []).map((p) => ({
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

  const filtered = useMemo(() => {
    let result = [...products];
    if (activeCategory !== 'All') {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, search, activeCategory]);

  function openAddForm() {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setSaveError(null);
    setFormOpen(true);
  }

  function openEditForm(product: Product) {
    setFormData({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
      stock: String(product.stock),
      min_stock: String(product.min_stock),
      image: product.image,
      active: product.active,
    });
    setFormErrors({});
    setSaveError(null);
    setFormOpen(true);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.category) errors.category = 'Category is required';
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) errors.price = 'Price must be a positive number';
    if (!formData.unit.trim()) errors.unit = 'Unit is required';
    const stock = parseInt(formData.stock, 10);
    if (isNaN(stock) || stock < 0) errors.stock = 'Stock must be 0 or greater';
    const minStock = parseInt(formData.min_stock, 10);
    if (isNaN(minStock) || minStock < 0) errors.min_stock = 'Min stock must be 0 or greater';
    if (!formData.image.trim()) errors.image = 'Image URL is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      category: formData.category,
      price: parseFloat(formData.price),
      unit: formData.unit,
      stock: parseInt(formData.stock, 10),
      min_stock: parseInt(formData.min_stock, 10),
      image: formData.image.trim(),
      active: formData.active,
    };

    let result;
    if (formData.id) {
      result = await supabase.from('products').update(payload).eq('id', formData.id);
    } else {
      const slug = formData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      result = await supabase.from('products').insert({ ...payload, id: slug });
    }

    if (result.error) {
      setSaveError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setFormOpen(false);
    await fetchProducts();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setDeleteTarget(null);
    await fetchProducts();
  }

  async function handleToggleActive(product: Product) {
    setToggleLoadingId(product.id);
    const { error } = await supabase
      .from('products')
      .update({ active: !product.active })
      .eq('id', product.id);
    setToggleLoadingId(null);
    if (error) {
      console.error('Failed to toggle product status:', error.message);
      return;
    }
    await fetchProducts();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-500 mt-1">Manage your product catalog</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

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
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer min-w-[180px]"
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Product Table */}
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
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Category</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Price</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Stock</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((product) => {
                  const invStatus = getInventoryStatus(product);
                  const invStyle = INVENTORY_STATUS_STYLES[invStatus as InventoryStatus];
                  return (
                    <tr key={product.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-gray-400 truncate md:hidden">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-600">{product.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-gray-900">{formatAED(product.price)}</span>
                        <p className="text-xs text-gray-400">{product.unit}</p>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-sm font-medium ${invStatus === 'Out of Stock' ? 'text-red-600' : invStatus === 'Low Stock' ? 'text-amber-600' : 'text-gray-700'}`}>
                          {getAvailableStock(product)}
                        </span>
                        <span className={`inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${invStyle.bg} ${invStyle.text}`}>
                          {invStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(product)}
                          disabled={toggleLoadingId === product.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            product.active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          } disabled:opacity-50`}
                        >
                          {toggleLoadingId === product.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Power className="w-3 h-3" />
                          )}
                          {product.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(product)}
                            className="p-2 rounded-lg text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Add/Edit Modal */}
      {formOpen && (
        <ProductFormModal
          formData={formData}
          formErrors={formErrors}
          saving={saving}
          saveError={saveError}
          isEdit={!!formData.id}
          onChange={setFormData}
          onSave={handleSave}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function ProductFormModal({
  formData, formErrors, saving, saveError, isEdit, onChange, onSave, onClose,
}: {
  formData: ProductFormData;
  formErrors: Record<string, string>;
  saving: boolean;
  saveError: string | null;
  isEdit: boolean;
  onChange: (data: ProductFormData) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function update<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    onChange({ ...formData, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          {/* Image preview */}
          {formData.image && (
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <FormField label="Image URL" error={formErrors.image} required>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.image}
                onChange={(e) => update('image', e.target.value)}
                placeholder="https://images.pexels.com/..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </div>
          </FormField>

          <FormField label="Name" error={formErrors.name} required>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Fresh Basil"
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </FormField>

          <FormField label="Description" error={formErrors.description} required>
            <textarea
              value={formData.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="Brief product description..."
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category" error={formErrors.category} required>
              <select
                value={formData.category}
                onChange={(e) => update('category', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Unit" error={formErrors.unit} required>
              <select
                value={formData.unit}
                onChange={(e) => update('unit', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Price (AED)" error={formErrors.price} required>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>

            <FormField label="Stock Quantity" error={formErrors.stock} required>
              <input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => update('stock', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>

            <FormField label="Min Stock Level" error={formErrors.min_stock} required>
              <input
                type="number"
                min="0"
                value={formData.min_stock}
                onChange={(e) => update('min_stock', e.target.value)}
                placeholder="5"
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-stone-50 border border-stone-200">
            <div>
              <p className="text-sm font-medium text-gray-900">Product Status</p>
              <p className="text-xs text-gray-500 mt-0.5">Inactive products are hidden from the customer shop</p>
            </div>
            <button
              onClick={() => update('active', !formData.active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.active ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label, error, required, children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
