import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Home, Package } from 'lucide-react';
import { formatAED } from '@/lib/format';

interface OrderData {
  orderNumber: string;
  subtotal: number;
  vat: number;
  delivery: number;
  total: number;
  items: { name: string; quantity: number; price: number }[];
  customer: { fullName: string; emirate: string; deliveryDate: string };
  paymentMethod: string;
}

export default function OrderConfirmation() {
  const [order, setOrder] = useState<OrderData | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('lastOrder');
    if (stored) {
      setOrder(JSON.parse(stored));
    }
  }, []);

  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No recent order found.</p>
          <Link to="/shop" className="text-green-700 font-semibold">Go to Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Order Confirmed!</h1>
        <p className="text-gray-500">Thank you, {order.customer.fullName}. Your fresh produce is on its way.</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Order number banner */}
        <div className="bg-gradient-to-r from-green-700 to-emerald-800 px-6 py-5 text-center">
          <div className="text-sm text-green-100 mb-1">Your Order Number</div>
          <div className="text-2xl font-bold text-white tracking-wider">{order.orderNumber}</div>
        </div>

        <div className="p-6">
          {/* Order items */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" /> Order Items
            </h2>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.quantity} × {item.name}</span>
                  <span className="font-medium text-gray-900">{formatAED(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-stone-200 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatAED(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT (5%)</span>
              <span>{formatAED(order.vat)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery</span>
              <span>{formatAED(order.delivery)}</span>
            </div>
            <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-gray-900 text-base">
              <span>Total Paid</span>
              <span>{formatAED(order.total)}</span>
            </div>
          </div>

          {/* Delivery info */}
          <div className="border-t border-stone-200 mt-4 pt-4 text-sm text-gray-500 space-y-1">
            <p><span className="font-medium text-gray-700">Delivering to:</span> {order.customer.emirate}</p>
            <p><span className="font-medium text-gray-700">Preferred date:</span> {order.customer.deliveryDate}</p>
            <p><span className="font-medium text-gray-700">Payment:</span> {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card Payment'}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
        <Link
          to="/shop"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors shadow-sm"
        >
          Continue Shopping
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white border border-stone-300 text-gray-700 font-semibold hover:bg-stone-50 transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
