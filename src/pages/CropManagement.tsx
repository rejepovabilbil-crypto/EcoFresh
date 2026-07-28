import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Pencil, Trash2, X, Loader2, Sprout, ArrowLeft,
  AlertTriangle, Check, Package, MapPin, Calendar, User,
  TrendingUp, Leaf, PackagePlus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/lib/supabase';
import ConfirmDialog from '@/components/ConfirmDialog';

const STAGES = ['Planned', 'Seedling', 'Growing', 'Ready for Harvest', 'Harvesting', 'Harvested', 'Failed'] as const;
const HEALTH_STATUSES = ['Healthy', 'Needs Attention', 'Critical'] as const;
const ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Greenhouse 1', 'Greenhouse 2'] as const;
const YIELD_UNITS = ['kg', 'bunches', 'trays', 'pieces', 'boxes'] as const;

const STAGE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  'Planned': { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  'Seedling': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Growing': { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  'Ready for Harvest': { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Harvesting': { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Harvested': { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  'Failed': { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

const HEALTH_STYLES: Record<string, { bg: string; text: string }> = {
  'Healthy': { bg: 'bg-green-50', text: 'text-green-700' },
  'Needs Attention': { bg: 'bg-amber-50', text: 'text-amber-700' },
  'Critical': { bg: 'bg-red-50', text: 'text-red-700' },
};

interface CropBatch {
  id: string;
  batch_number: string;
  crop_name: string;
  variety: string | null;
  zone: string;
  planting_date: string;
  expected_harvest_date: string;
  assigned_staff: string | null;
  stage: string;
  health_status: string;
  expected_yield: number;
  yield_unit: string;
  actual_yield: number | null;
  added_to_inventory: boolean;
  created_at: string;
  updated_at: string;
  assigned_staff_name?: string | null;
}

interface StaffMember {
  id: string;
  full_name: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
}

interface BatchFormData {
  id?: string;
  crop_name: string;
  variety: string;
  zone: string;
  planting_date: string;
  expected_harvest_date: string;
  assigned_staff: string;
  stage: string;
  health_status: string;
  expected_yield: string;
  yield_unit: string;
  actual_yield: string;
}

const EMPTY_FORM: BatchFormData = {
  crop_name: '',
  variety: '',
  zone: 'Zone A',
  planting_date: '',
  expected_harvest_date: '',
  assigned_staff: '',
  stage: 'Planned',
  health_status: 'Healthy',
  expected_yield: '',
  yield_unit: 'kg',
  actual_yield: '',
};

export default function CropManagement({ role }: { role: UserRole }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = role === 'admin';

  const [batches, setBatches] = useState<CropBatch[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStage, setActiveStage] = useState('All');

  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<BatchFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CropBatch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [inventoryTarget, setInventoryTarget] = useState<CropBatch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addingInventory, setAddingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBatches = useCallback(async () => {
    let query = supabase.from('crop_batches').select('*').order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) {
      console.error('Failed to load crop batches:', error.message);
      return;
    }

    // Fetch staff names for assigned batches
    const staffIds = [...new Set((data || []).map((b: CropBatch) => b.assigned_staff).filter(Boolean))] as string[];
    let staffMap: Record<string, string> = {};
    if (staffIds.length > 0) {
      const { data: staffData } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', staffIds);
      staffMap = Object.fromEntries((staffData || []).map((s: StaffMember) => [s.id, s.full_name]));
    }

    const mapped: CropBatch[] = (data || []).map((b: CropBatch) => ({
      ...b,
      assigned_staff_name: b.assigned_staff ? staffMap[b.assigned_staff] ?? null : null,
    }));
    setBatches(mapped);
  }, []);

  const fetchStaffMembers = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('role', 'staff')
      .order('full_name');
    if (error) {
      console.error('Failed to load staff:', error.message);
      return;
    }
    setStaffMembers(data as StaffMember[] || []);
  }, [isAdmin]);

  useEffect(() => {
    Promise.all([fetchBatches(), fetchStaffMembers()]).finally(() => setLoading(false));
  }, [fetchBatches, fetchStaffMembers]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('crop-batches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crop_batches' }, () => fetchBatches())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBatches]);

  const filtered = useMemo(() => {
    let result = [...batches];
    if (activeStage !== 'All') {
      result = result.filter((b) => b.stage === activeStage);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.crop_name.toLowerCase().includes(q) ||
          b.batch_number.toLowerCase().includes(q) ||
          (b.variety ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [batches, search, activeStage]);

  function canEdit(batch: CropBatch): boolean {
    if (isAdmin) return true;
    return batch.assigned_staff === profile?.id;
  }

  function openAddForm() {
    setFormData({
      ...EMPTY_FORM,
      assigned_staff: isAdmin ? '' : (profile?.id ?? ''),
      planting_date: new Date().toISOString().slice(0, 10),
    });
    setFormErrors({});
    setSaveError(null);
    setFormOpen(true);
  }

  function openEditForm(batch: CropBatch) {
    setFormData({
      id: batch.id,
      crop_name: batch.crop_name,
      variety: batch.variety ?? '',
      zone: batch.zone,
      planting_date: batch.planting_date,
      expected_harvest_date: batch.expected_harvest_date,
      assigned_staff: batch.assigned_staff ?? '',
      stage: batch.stage,
      health_status: batch.health_status,
      expected_yield: String(batch.expected_yield),
      yield_unit: batch.yield_unit,
      actual_yield: batch.actual_yield != null ? String(batch.actual_yield) : '',
    });
    setFormErrors({});
    setSaveError(null);
    setFormOpen(true);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.crop_name.trim()) errors.crop_name = 'Crop name is required';
    if (!formData.zone) errors.zone = 'Zone is required';
    if (!formData.planting_date) errors.planting_date = 'Planting date is required';
    if (!formData.expected_harvest_date) errors.expected_harvest_date = 'Expected harvest date is required';
    if (formData.expected_harvest_date && formData.planting_date && formData.expected_harvest_date < formData.planting_date) {
      errors.expected_harvest_date = 'Harvest date must be after planting date';
    }
    if (!formData.stage) errors.stage = 'Stage is required';
    if (!formData.health_status) errors.health_status = 'Health status is required';
    const expYield = parseFloat(formData.expected_yield);
    if (isNaN(expYield) || expYield <= 0) errors.expected_yield = 'Expected yield must be a positive number';
    if (!formData.yield_unit.trim()) errors.yield_unit = 'Yield unit is required';
    if (formData.stage === 'Harvested') {
      const actYield = parseFloat(formData.actual_yield);
      if (isNaN(actYield) || actYield < 0) errors.actual_yield = 'Actual yield is required when stage is Harvested';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {
      crop_name: formData.crop_name.trim(),
      variety: formData.variety.trim() || null,
      zone: formData.zone,
      planting_date: formData.planting_date,
      expected_harvest_date: formData.expected_harvest_date,
      assigned_staff: formData.assigned_staff || null,
      stage: formData.stage,
      health_status: formData.health_status,
      expected_yield: parseFloat(formData.expected_yield),
      yield_unit: formData.yield_unit,
      actual_yield: formData.stage === 'Harvested' && formData.actual_yield ? parseFloat(formData.actual_yield) : null,
    };

    let result;
    if (formData.id) {
      result = await supabase.from('crop_batches').update(payload).eq('id', formData.id);
    } else {
      // Generate batch number
      const { data: batchNum, error: batchErr } = await supabase.rpc('generate_batch_number');
      if (batchErr) {
        setSaveError('Failed to generate batch number: ' + batchErr.message);
        setSaving(false);
        return;
      }
      result = await supabase.from('crop_batches').insert({ ...payload, batch_number: batchNum });
    }

    if (result.error) {
      setSaveError(result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setFormOpen(false);
    await fetchBatches();
    setActionMessage({ type: 'success', text: formData.id ? 'Batch updated successfully' : 'Batch created successfully' });
    setTimeout(() => setActionMessage(null), 3000);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('crop_batches').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      setActionMessage({ type: 'error', text: 'Failed to delete: ' + error.message });
      setTimeout(() => setActionMessage(null), 5000);
      return;
    }
    setDeleteTarget(null);
    await fetchBatches();
    setActionMessage({ type: 'success', text: 'Batch deleted' });
    setTimeout(() => setActionMessage(null), 3000);
  }

  async function openInventoryDialog(batch: CropBatch) {
    setInventoryTarget(batch);
    setInventoryError(null);
    setSelectedProductId('');
    // Fetch products and try to auto-match by crop_name
    const { data: prodData } = await supabase
      .from('products')
      .select('id, name, stock')
      .order('name');
    const prods = (prodData || []) as Product[];
    setProducts(prods);
    // Auto-match: find product whose name matches crop_name (case-insensitive)
    const match = prods.find((p) => p.name.toLowerCase() === batch.crop_name.toLowerCase());
    if (match) setSelectedProductId(match.id);
  }

  async function handleAddToInventory() {
    if (!inventoryTarget || !selectedProductId) return;
    setAddingInventory(true);
    setInventoryError(null);

    const yieldAmount = inventoryTarget.actual_yield ?? 0;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) {
      setInventoryError('Please select a product');
      setAddingInventory(false);
      return;
    }

    const newStock = product.stock + Math.round(yieldAmount);

    const { error: prodErr } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProductId);

    if (prodErr) {
      setInventoryError('Failed to update product: ' + prodErr.message);
      setAddingInventory(false);
      return;
    }

    // Mark batch as added to inventory
    const { error: batchErr } = await supabase
      .from('crop_batches')
      .update({ added_to_inventory: true })
      .eq('id', inventoryTarget.id);

    if (batchErr) {
      setInventoryError('Product updated, but failed to mark batch: ' + batchErr.message);
      setAddingInventory(false);
      return;
    }

    setAddingInventory(false);
    setInventoryTarget(null);
    await fetchBatches();
    setActionMessage({ type: 'success', text: `Added ${Math.round(yieldAmount)} ${inventoryTarget.yield_unit} to ${product.name} (stock: ${product.stock} → ${newStock})` });
    setTimeout(() => setActionMessage(null), 5000);
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
            onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/staff/dashboard')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-700 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Crop Management</h1>
          <p className="text-gray-500 mt-1">Track and manage crop batches from planting to harvest</p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Batch
        </button>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
          actionMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {actionMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
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
            placeholder="Search by crop name, batch number, or variety..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
          />
        </div>
        <select
          value={activeStage}
          onChange={(e) => setActiveStage(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer min-w-[180px]"
        >
          <option value="All">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Batch cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm text-center py-16">
          <Sprout className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No crop batches found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((batch) => {
            const editable = canEdit(batch);
            const stageStyle = STAGE_STYLES[batch.stage] ?? STAGE_STYLES.Planned;
            const healthStyle = HEALTH_STYLES[batch.health_status] ?? HEALTH_STYLES.Healthy;
            return (
              <div
                key={batch.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Card header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gray-400 mb-0.5">{batch.batch_number}</p>
                      <h3 className="font-semibold text-gray-900 truncate">{batch.crop_name}</h3>
                      {batch.variety && <p className="text-xs text-gray-400 truncate">{batch.variety}</p>}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${stageStyle.bg} ${stageStyle.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                      {batch.stage}
                    </span>
                  </div>

                  {/* Health + Zone row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${healthStyle.bg} ${healthStyle.text}`}>
                      <Leaf className="w-3 h-3" />
                      {batch.health_status}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-gray-600">
                      <MapPin className="w-3 h-3" />
                      {batch.zone}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 pb-3 space-y-1.5 text-sm flex-1">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>Planted {new Date(batch.planting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="text-gray-300">→</span>
                    <span>Harvest {new Date(batch.expected_harvest_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>{batch.assigned_staff_name ?? 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      Expected: {batch.expected_yield} {batch.yield_unit}
                      {batch.actual_yield != null && (
                        <span className="text-green-600 font-medium"> · Actual: {batch.actual_yield} {batch.yield_unit}</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Add to inventory banner */}
                {batch.stage === 'Harvested' && batch.actual_yield != null && !batch.added_to_inventory && (
                  <div className="px-4 pb-2">
                    <button
                      onClick={() => openInventoryDialog(batch)}
                      disabled={!editable}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PackagePlus className="w-4 h-4" />
                      Add to Inventory
                    </button>
                  </div>
                )}
                {batch.added_to_inventory && (
                  <div className="px-4 pb-2">
                    <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-green-700 bg-green-50 border border-green-200">
                      <Check className="w-4 h-4" />
                      Added to Inventory
                    </div>
                  </div>
                )}

                {/* Card footer */}
                <div className="px-4 py-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {editable ? 'Editable' : 'View only'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditForm(batch)}
                      disabled={!editable}
                      className="p-2 rounded-lg text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={editable ? 'Edit' : 'You can only edit batches assigned to you'}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setDeleteTarget(batch)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {formOpen && (
        <BatchFormModal
          formData={formData}
          formErrors={formErrors}
          saving={saving}
          saveError={saveError}
          isEdit={!!formData.id}
          isAdmin={isAdmin}
          staffMembers={staffMembers}
          currentUserId={profile?.id ?? ''}
          onChange={setFormData}
          onSave={handleSave}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Crop Batch"
        message={`Are you sure you want to delete batch "${deleteTarget?.batch_number}" (${deleteTarget?.crop_name})? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {/* Add to Inventory Dialog */}
      {inventoryTarget && (
        <InventoryDialog
          batch={inventoryTarget}
          products={products}
          selectedProductId={selectedProductId}
          onSelectProduct={setSelectedProductId}
          onConfirm={handleAddToInventory}
          onCancel={() => setInventoryTarget(null)}
          adding={addingInventory}
          error={inventoryError}
        />
      )}
    </div>
  );
}

function BatchFormModal({
  formData, formErrors, saving, saveError, isEdit, isAdmin, staffMembers, currentUserId,
  onChange, onSave, onClose,
}: {
  formData: BatchFormData;
  formErrors: Record<string, string>;
  saving: boolean;
  saveError: string | null;
  isEdit: boolean;
  isAdmin: boolean;
  staffMembers: StaffMember[];
  currentUserId: string;
  onChange: (data: BatchFormData) => void;
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

  function update<K extends keyof BatchFormData>(key: K, value: BatchFormData[K]) {
    onChange({ ...formData, [key]: value });
  }

  const isHarvested = formData.stage === 'Harvested';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">{isEdit ? 'Edit Batch' : 'Add New Batch'}</h2>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Crop Name" error={formErrors.crop_name} required>
              <input
                type="text"
                value={formData.crop_name}
                onChange={(e) => update('crop_name', e.target.value)}
                placeholder="e.g. Romaine Lettuce"
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>

            <FormField label="Variety" error={formErrors.variety}>
              <input
                type="text"
                value={formData.variety}
                onChange={(e) => update('variety', e.target.value)}
                placeholder="e.g. Paris Island (optional)"
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Zone" error={formErrors.zone} required>
              <select
                value={formData.zone}
                onChange={(e) => update('zone', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Assigned Staff" error={formErrors.assigned_staff}>
              {isAdmin ? (
                <select
                  value={formData.assigned_staff}
                  onChange={(e) => update('assigned_staff', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value="You (Staff)"
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-gray-500 cursor-not-allowed"
                />
              )}
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Planting Date" error={formErrors.planting_date} required>
              <input
                type="date"
                value={formData.planting_date}
                onChange={(e) => update('planting_date', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>

            <FormField label="Expected Harvest Date" error={formErrors.expected_harvest_date} required>
              <input
                type="date"
                value={formData.expected_harvest_date}
                onChange={(e) => update('expected_harvest_date', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Stage" error={formErrors.stage} required>
              <select
                value={formData.stage}
                onChange={(e) => update('stage', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Health Status" error={formErrors.health_status} required>
              <select
                value={formData.health_status}
                onChange={(e) => update('health_status', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
              >
                {HEALTH_STATUSES.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Expected Yield" error={formErrors.expected_yield} required>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.expected_yield}
                onChange={(e) => update('expected_yield', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              />
            </FormField>

            <FormField label="Yield Unit" error={formErrors.yield_unit} required>
              <select
                value={formData.yield_unit}
                onChange={(e) => update('yield_unit', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
              >
                {YIELD_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Actual yield — required when stage is Harvested */}
          {isHarvested && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <FormField label="Actual Yield" error={formErrors.actual_yield} required>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.actual_yield}
                    onChange={(e) => update('actual_yield', e.target.value)}
                    placeholder="Enter actual harvested amount"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                  />
                  <span className="text-sm text-gray-500">{formData.yield_unit}</span>
                </div>
              </FormField>
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Actual yield is required when stage is set to Harvested
              </p>
            </div>
          )}
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
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'Save Changes' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryDialog({
  batch, products, selectedProductId, onSelectProduct, onConfirm, onCancel, adding, error,
}: {
  batch: CropBatch;
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  adding: boolean;
  error: string | null;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const yieldAmount = batch.actual_yield ?? 0;
  const newStock = selectedProduct ? selectedProduct.stock + Math.round(yieldAmount) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <PackagePlus className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Add to Inventory</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Add {yieldAmount} {batch.yield_unit} of {batch.crop_name} to a product's stock
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => onSelectProduct(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition appearance-none bg-white cursor-pointer"
            >
              <option value="">Choose a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (current stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Current Stock</span>
                <span className="font-medium text-gray-900">{selectedProduct.stock}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Adding</span>
                <span className="font-medium text-blue-600">+{Math.round(yieldAmount)}</span>
              </div>
              <div className="border-t border-blue-200 mt-2 pt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">New Stock</span>
                <span className="font-bold text-green-700">{newStock}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={adding}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={adding || !selectedProductId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Add to Inventory
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
