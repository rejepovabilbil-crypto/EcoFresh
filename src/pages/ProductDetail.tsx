import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, ArrowLeft, Minus, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { formatAED } from '@/lib/format';
import type { Product } from '@/data/products';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      setError('Product not found.');
      return;
    }
    const p = data;
    setProduct({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: Number(p.price),
      unit: p.unit,
      stock: p.stock,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      reserved_quantity: p.reserved_quantity,
      damaged_quantity: p.damaged_quantity,
      image: p.image,
      featured: p.featured,
      active: p.active,
    });
  }, [id]);

  useEffect(() => {
    fetchProduct().finally(() => setLoading(false));
  }, [fetchProduct]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <p className="text-gray-400 text-lg">Loading product...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
        <p className="text-gray-500 mb-8">The product you're looking for doesn't exist or may have been removed.</p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </Link>
      </div>
    );
  }

  const outOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock < 10;

  function handleAdd() {
    if (!product) return;
    for (let i = 0; i < quantity; i++) {
      addItem(product);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const maxQty = product.stock;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 text-green-700 font-medium hover:gap-3 transition-all mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Shop
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image */}
        <div className="relative rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100">
          <img
            src={product.image}
            alt={product.name}
            className={`w-full aspect-square object-cover ${outOfStock ? 'grayscale opacity-60' : ''}`}
          />
          <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-sm font-semibold bg-white/90 text-green-700 backdrop-blur-sm">
            {product.category}
          </span>
          <span
            className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-sm font-semibold ${
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

        {/* Details */}
        <div className="flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{product.name}</h1>
          <p className="text-2xl font-bold text-green-700 mb-4">{formatAED(product.price)}</p>
          <p className="text-gray-600 leading-relaxed text-lg mb-6">{product.description}</p>

          <div className="space-y-2 text-sm text-gray-500 mb-8">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Unit:</span>
              <span>{product.unit}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Availability:</span>
              <span className={outOfStock ? 'text-red-600' : lowStock ? 'text-orange-600' : 'text-green-600'}>
                {outOfStock ? 'Out of Stock' : `${product.stock} in stock`}
              </span>
            </div>
          </div>

          {!outOfStock && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-lg border border-stone-300 flex items-center justify-center hover:bg-stone-100 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-14 text-center font-medium text-gray-900 text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${
                    quantity >= maxQty
                      ? 'border-stone-200 text-gray-300 cursor-not-allowed'
                      : 'border-stone-300 hover:bg-stone-100'
                  }`}
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {quantity >= maxQty && (
                  <span className="text-xs text-orange-600 ml-2">Max stock reached</span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-base font-semibold transition-all ${
                outOfStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : added
                  ? 'bg-green-700 text-white'
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-5 h-5" />
                  Added to Cart
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Add to Cart
                </>
              )}
            </button>
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-base font-semibold border border-stone-300 text-gray-700 hover:bg-stone-50 transition-colors"
            >
              View Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
