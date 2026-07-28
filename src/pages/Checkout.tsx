import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Banknote, Lock, CheckCircle2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatAED } from '@/lib/format';

const VAT_RATE = 0.05;
const DELIVERY_FEE = 15.0;
const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];

interface FormData {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  emirate: string;
  deliveryDate: string;
  instructions: string;
  paymentMethod: 'cod' | 'card';
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
}

const initialForm: FormData = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  emirate: '',
  deliveryDate: '',
  instructions: '',
  paymentMethod: 'cod',
  cardName: '',
  cardNumber: '',
  cardExpiry: '',
  cardCvc: '',
};

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(() => ({
    ...initialForm,
    fullName: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    email: profile?.email ?? '',
    address: profile?.delivery_address ?? '',
    emirate: profile?.emirate ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat + DELIVERY_FEE;

  const today = new Date().toISOString().split('T')[0];

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    else if (!/^[+]?[\d\s-]{6,}$/.test(form.phone)) errs.phone = 'Enter a valid phone number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.address.trim()) errs.address = 'Street/Building/Area is required';
    if (!form.emirate) errs.emirate = 'Please select an emirate';
    if (!form.deliveryDate) errs.deliveryDate = 'Delivery date is required';
    else if (form.deliveryDate <= today) errs.deliveryDate = 'Date must be in the future';

    if (form.paymentMethod === 'card') {
      if (!form.cardName.trim()) errs.cardName = 'Name on card is required';
      if (!form.cardNumber.trim()) errs.cardNumber = 'Card number is required';
      else if (form.cardNumber.replace(/\s/g, '').length < 12) errs.cardNumber = 'Enter a valid card number';
      if (!form.cardExpiry.trim()) errs.cardExpiry = 'Expiry date is required';
      if (!form.cardCvc.trim()) errs.cardCvc = 'CVC is required';
      else if (form.cardCvc.length < 3) errs.cardCvc = 'Enter a valid CVC';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);

    const orderNum = `ECO-2026-${String(Math.floor(1000 + Math.random() * 9000))}`;

    try {
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNum,
          status: 'Confirmed',
          subtotal,
          vat,
          delivery_fee: DELIVERY_FEE,
          total,
          full_name: form.fullName,
          phone: form.phone || null,
          email: form.email || null,
          delivery_address: form.address,
          emirate: form.emirate,
          delivery_date: form.deliveryDate || null,
          instructions: form.instructions || null,
          payment_method: form.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Card Payment',
        })
        .select('id')
        .single();

      if (orderError) throw orderError;
      if (!orderRow) throw new Error('Failed to create order');

      const orderItems = items.map((i) => ({
        order_id: orderRow.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        line_total: i.product.price * i.quantity,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      await supabase.from('notifications').insert({
        message: `Your order ${orderNum} has been confirmed. We'll start preparing your fresh produce shortly.`,
        order_id: orderRow.id,
      });

      const orderData = {
        orderNumber: orderNum,
        subtotal,
        vat,
        delivery: DELIVERY_FEE,
        total,
        items: items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.product.price })),
        customer: { fullName: form.fullName, phone: form.phone, email: form.email, address: form.address, emirate: form.emirate, deliveryDate: form.deliveryDate, instructions: form.instructions },
        paymentMethod: form.paymentMethod,
      };

      sessionStorage.setItem('lastOrder', JSON.stringify(orderData));
      clearCart();
      window.dispatchEvent(new Event('order-placed'));
      navigate('/order-confirmation');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Your cart is empty.</p>
          <Link to="/shop" className="text-green-700 font-semibold">Go to Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg border outline-none transition ${
                    errors.fullName ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  }`}
                  placeholder="John Doe"
                />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg border outline-none transition ${
                    errors.phone ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  }`}
                  placeholder="+971 50 123 4567"
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email (optional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg border outline-none transition ${
                    errors.email ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  }`}
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Street / Building / Area *</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg border outline-none transition ${
                    errors.address ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  }`}
                  placeholder="Building 5, Street 10, Silicon Oasis"
                />
                {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Emirate *</label>
                <select
                  value={form.emirate}
                  onChange={(e) => update('emirate', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg border outline-none transition bg-white ${
                    errors.emirate ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  }`}
                >
                  <option value="">Select emirate</option>
                  {EMIRATES.map((em) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                </select>
                {errors.emirate && <p className="text-xs text-red-500 mt-1">{errors.emirate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred Delivery Date *</label>
                <input
                  type="date"
                  min={today}
                  value={form.deliveryDate}
                  onChange={(e) => update('deliveryDate', e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-lg border outline-none transition ${
                    errors.deliveryDate ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  }`}
                />
                {errors.deliveryDate && <p className="text-xs text-red-500 mt-1">{errors.deliveryDate}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Instructions (optional)</label>
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={(e) => update('instructions', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
                  placeholder="Leave at door, call on arrival, etc."
                />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h2>
            <div className="space-y-3">
              <label
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  form.paymentMethod === 'cod' ? 'border-green-500 bg-green-50' : 'border-stone-300 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={form.paymentMethod === 'cod'}
                  onChange={() => update('paymentMethod', 'cod')}
                  className="w-4 h-4 accent-green-600"
                />
                <Banknote className="w-5 h-5 text-green-700" />
                <div>
                  <div className="font-medium text-gray-900">Cash on Delivery</div>
                  <div className="text-xs text-gray-500">Pay with cash when your order arrives</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  form.paymentMethod === 'card' ? 'border-green-500 bg-green-50' : 'border-stone-300 hover:bg-stone-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={form.paymentMethod === 'card'}
                  onChange={() => update('paymentMethod', 'card')}
                  className="w-4 h-4 accent-green-600"
                />
                <CreditCard className="w-5 h-5 text-green-700" />
                <div>
                  <div className="font-medium text-gray-900">Card Payment</div>
                  <div className="text-xs text-gray-500">Demo only — no real payment processed</div>
                </div>
              </label>

              {form.paymentMethod === 'card' && (
                <div className="ml-7 space-y-3 pt-2 border-t border-stone-100 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                    <Lock className="w-3 h-3" />
                    Demo fields — do not enter real card details
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name on Card</label>
                    <input
                      type="text"
                      value={form.cardName}
                      onChange={(e) => update('cardName', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border outline-none transition text-sm ${
                        errors.cardName ? 'border-red-400' : 'border-stone-300 focus:ring-2 focus:ring-green-500'
                      }`}
                      placeholder="John Doe"
                    />
                    {errors.cardName && <p className="text-xs text-red-500 mt-1">{errors.cardName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
                    <input
                      type="text"
                      value={form.cardNumber}
                      onChange={(e) => update('cardNumber', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border outline-none transition text-sm ${
                        errors.cardNumber ? 'border-red-400' : 'border-stone-300 focus:ring-2 focus:ring-green-500'
                      }`}
                      placeholder="4242 4242 4242 4242"
                    />
                    {errors.cardNumber && <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Expiry</label>
                      <input
                        type="text"
                        value={form.cardExpiry}
                        onChange={(e) => update('cardExpiry', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border outline-none transition text-sm ${
                          errors.cardExpiry ? 'border-red-400' : 'border-stone-300 focus:ring-2 focus:ring-green-500'
                        }`}
                        placeholder="MM/YY"
                      />
                      {errors.cardExpiry && <p className="text-xs text-red-500 mt-1">{errors.cardExpiry}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
                      <input
                        type="text"
                        value={form.cardCvc}
                        onChange={(e) => update('cardCvc', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border outline-none transition text-sm ${
                          errors.cardCvc ? 'border-red-400' : 'border-stone-300 focus:ring-2 focus:ring-green-500'
                        }`}
                        placeholder="123"
                      />
                      {errors.cardCvc && <p className="text-xs text-red-500 mt-1">{errors.cardCvc}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3 text-sm">
                  <img src={item.product.image} alt={item.product.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{item.product.name}</div>
                    <div className="text-xs text-gray-400">{item.quantity} × {formatAED(item.product.price)}</div>
                  </div>
                  <div className="font-medium text-gray-900">{formatAED(item.product.price * item.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatAED(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT (5%)</span>
                <span>{formatAED(vat)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span>{formatAED(DELIVERY_FEE)}</span>
              </div>
              <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-gray-900 text-base">
                <span>Total</span>
                <span>{formatAED(total)}</span>
              </div>
            </div>

            {submitError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-5 h-5" />
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
            <Link
              to="/cart"
              className="w-full mt-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-green-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Cart
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
