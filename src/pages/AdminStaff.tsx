import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowLeft, Loader2, UserCog, Power, Plus, X, Check,
  Pencil, MapPin, Sprout,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

interface CropBatch {
  id: string;
  batch_number: string;
  crop_name: string;
  zone: string;
}

interface StaffWithZones extends StaffRow {
  zones: string[];
  batchCount: number;
}

interface AddStaffForm {
  fullName: string;
  email: string;
  password: string;
}

const EMPTY_FORM: AddStaffForm = { fullName: '', email: '', password: '' };

export default function AdminStaff() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffWithZones[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AddStaffForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editZonesFor, setEditZonesFor] = useState<StaffWithZones | null>(null);
  const [allBatches, setAllBatches] = useState<CropBatch[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    const [staffRes, batchesRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, is_active')
        .eq('role', 'staff')
        .order('created_at', { ascending: false }),
      supabase.from('crop_batches').select('id, batch_number, crop_name, zone, assigned_staff'),
    ]);

    const rows = (staffRes.data as StaffRow[]) || [];
    const batches = (batchesRes.data as (CropBatch & { assigned_staff: string | null })[]) || [];

    const withZones: StaffWithZones[] = rows.map((s) => {
      const assigned = batches.filter((b) => b.assigned_staff === s.id);
      const zones = [...new Set(assigned.map((b) => b.zone))];
      return { ...s, zones, batchCount: assigned.length };
    });

    setStaff(withZones);
    setAllBatches(batches.map(({ id, batch_number, crop_name, zone }) => ({ id, batch_number, crop_name, zone })));
  }, []);

  useEffect(() => {
    fetchStaff().finally(() => setLoading(false));
  }, [fetchStaff]);

  const filtered = useMemo(() => {
    if (!search.trim()) return staff;
    const q = search.toLowerCase();
    return staff.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [staff, search]);

  async function handleToggleStatus(member: StaffWithZones) {
    setToggleLoadingId(member.id);
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: !member.is_active })
      .eq('id', member.id);
    setToggleLoadingId(null);
    if (error) {
      console.error('Failed to toggle status:', error.message);
      return;
    }
    await fetchStaff();
  }

  function openAddForm() {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSaveError(null);
    setAddOpen(true);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email';
    if (!form.password.trim()) errors.password = 'Password is required';
    else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAddStaff() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);

    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'create_staff',
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
        },
      });

      const response = data as { error?: string } | null;

      if (error || (response && response.error)) {
        setSaveError((response?.error ?? error?.message) || 'Failed to create staff account');
        setSaving(false);
        return;
      }

      setSaving(false);
      setAddOpen(false);
      await fetchStaff();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setSaving(false);
    }
  }

  function openEditZones(member: StaffWithZones) {
    setEditZonesFor(member);
    setZoneError(null);
    fetchStaffBatchesForStaff(member.id);
  }

  async function fetchStaffBatchesForStaff(staffId: string) {
    const { data } = await supabase
      .from('crop_batches')
      .select('id, assigned_staff')
      .eq('assigned_staff', staffId);
    const ids = new Set(((data as { id: string }[]) || []).map((b) => b.id));
    setSelectedBatchIds(ids);
  }

  function toggleBatchSelection(batchId: string) {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  async function handleSaveZones() {
    if (!editZonesFor) return;
    setZoneSaving(true);
    setZoneError(null);

    const previouslyAssigned = allBatches.filter((b) =>
      selectedBatchIds.has(b.id),
    );

    // First, unassign all batches currently assigned to this staff
    const { error: unassignErr } = await supabase
      .from('crop_batches')
      .update({ assigned_staff: null })
      .eq('assigned_staff', editZonesFor.id);

    if (unassignErr) {
      setZoneError(unassignErr.message);
      setZoneSaving(false);
      return;
    }

    // Then assign the selected batches
    if (previouslyAssigned.length > 0) {
      const { error: assignErr } = await supabase
        .from('crop_batches')
        .update({ assigned_staff: editZonesFor.id })
        .in('id', previouslyAssigned.map((b) => b.id));

      if (assignErr) {
        setZoneError(assignErr.message);
        setZoneSaving(false);
        return;
      }
    }

    setZoneSaving(false);
    setEditZonesFor(null);
    await fetchStaff();
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
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <UserCog className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
              <p className="text-gray-500 mt-0.5">Manage staff accounts, zones, and assignments</p>
            </div>
          </div>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
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
            <UserCog className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No staff members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Phone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Assigned Zones</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Batches</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((member) => (
                  <tr key={member.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{member.full_name}</p>
                      <p className="text-xs text-gray-400 md:hidden">{member.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{member.email}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">{member.phone || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {member.zones.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {member.zones.map((zone) => (
                            <span
                              key={zone}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                            >
                              <MapPin className="w-3 h-3" />
                              {zone}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No zones assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900">{member.batchCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(member)}
                        disabled={toggleLoadingId === member.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          member.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        } disabled:opacity-50`}
                      >
                        {toggleLoadingId === member.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Power className="w-3 h-3" />
                        )}
                        {member.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditZones(member)}
                          className="p-2 rounded-lg text-gray-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          title="Edit assigned zones"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {addOpen && (
        <AddStaffModal
          form={form}
          formErrors={formErrors}
          saving={saving}
          saveError={saveError}
          onChange={setForm}
          onSave={handleAddStaff}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Edit Zones Modal */}
      {editZonesFor && (
        <EditZonesModal
          staffName={editZonesFor.full_name}
          batches={allBatches}
          selectedIds={selectedBatchIds}
          onToggle={toggleBatchSelection}
          saving={zoneSaving}
          error={zoneError}
          onSave={handleSaveZones}
          onClose={() => setEditZonesFor(null)}
        />
      )}
    </div>
  );
}

function AddStaffModal({
  form, formErrors, saving, saveError, onChange, onSave, onClose,
}: {
  form: AddStaffForm;
  formErrors: Record<string, string>;
  saving: boolean;
  saveError: string | null;
  onChange: (data: AddStaffForm) => void;
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

  function update<K extends keyof AddStaffForm>(key: K, value: AddStaffForm[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <h2 className="text-xl font-semibold text-gray-900">Add Staff Member</h2>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
            {formErrors.fullName && <p className="text-xs text-red-500 mt-1">{formErrors.fullName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="staff@ecofresh.com"
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
            {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Temporary Password <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
            {formErrors.password && <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>}
            <p className="text-xs text-gray-400 mt-1.5">Share this password with the staff member securely.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
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
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}

function EditZonesModal({
  staffName, batches, selectedIds, onToggle, saving, error, onSave, onClose,
}: {
  staffName: string;
  batches: CropBatch[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  saving: boolean;
  error: string | null;
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Assigned Zones</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Select crop batches to assign to {staffName}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}
          {batches.length === 0 ? (
            <div className="text-center py-8">
              <Sprout className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No crop batches available.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => {
                const checked = selectedIds.has(batch.id);
                return (
                  <label
                    key={batch.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'border-green-300 bg-green-50/50'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(batch.id)}
                      className="w-4 h-4 rounded border-stone-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{batch.crop_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{batch.batch_number}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 shrink-0">
                      <MapPin className="w-3 h-3" />
                      {batch.zone}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-stone-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
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
            Save Assignments
          </button>
        </div>
      </div>
    </div>
  );
}
