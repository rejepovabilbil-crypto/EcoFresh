import { useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import type { Product } from '@/data/products';
import { useCart } from '@/context/CartContext';
import { formatAED } from '@/lib/format';

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const outOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock < 10;

  function handleAdd() {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            outOfStock ? 'grayscale opacity-60' : ''
          }`}
        />
        {/* Category badge */}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 text-green-700 backdrop-blur-sm">
          {product.category}
        </span>
        {/* Stock status badge */}
        <span
          className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold ${
            outOfStock
              ? 'bg-gray-200 text-gray-600'
              : lowStock
              ? 'bg-orange-100 text-orange-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {outOfStock ? 'Out of Stock' : lowStock ? 'Low Stock' : 'In Stock'}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-base mb-1">{product.name}</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-3 flex-1">{product.description}</p>

        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
          <span>{product.unit}</span>
          <span>{outOfStock ? '0 in stock' : `${product.stock} in stock`}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-green-700">{formatAED(product.price)}</span>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              outOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : added
                ? 'bg-green-600 text-white'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
            }`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4" />
                Added
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
