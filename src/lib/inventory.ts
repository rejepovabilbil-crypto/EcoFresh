export type InventoryStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Overstocked';

export interface InventoryFields {
  stock: number;
  reserved_quantity: number;
  damaged_quantity: number;
  min_stock: number;
  max_stock: number;
}

export function getAvailableStock(p: InventoryFields): number {
  return p.stock - p.reserved_quantity - p.damaged_quantity;
}

export function getInventoryStatus(p: InventoryFields): InventoryStatus {
  const available = getAvailableStock(p);
  if (available <= 0) return 'Out of Stock';
  if (available < p.min_stock) return 'Low Stock';
  if (available > p.max_stock) return 'Overstocked';
  return 'In Stock';
}

export const INVENTORY_STATUS_STYLES: Record<InventoryStatus, { bg: string; text: string; dot: string }> = {
  'In Stock': { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  'Low Stock': { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  'Out of Stock': { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  'Overstocked': { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
};
