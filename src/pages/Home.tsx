import { Link } from 'react-router-dom';
import { Leaf, Droplets, Sun, Recycle, ArrowRight, Truck, ShieldCheck, Sprout } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Product } from '@/data/products';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('featured', true)
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(4);
      if (error) {
        console.error('Failed to load featured products:', error.message);
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
        min_stock: p.min_stock,
        max_stock: p.max_stock,
        reserved_quantity: p.reserved_quantity,
        damaged_quantity: p.damaged_quantity,
        image: p.image,
        featured: p.featured,
        active: p.active,
      }));
      setFeatured(mapped);
    }
    load();
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/28129609/pexels-photo-28129609.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt="Vertical hydroponic farm with LED lighting"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-green-950/90 via-green-900/80 to-emerald-950/85" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-600/30 text-green-100 text-sm font-medium backdrop-blur-sm border border-green-400/30 mb-6">
              <Sprout className="w-4 h-4" />
              Dubai's Smart Hydroponic Farm
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
              Fresh Produce,<br />Grown Sustainably
            </h1>
            <p className="text-lg text-green-100 mb-8 leading-relaxed max-w-xl">
              EcoFresh Urban Farms uses cutting-edge hydroponic technology to grow
              pesticide-free, nutrient-rich greens right here in Dubai — delivered to your door.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-green-700 font-semibold hover:bg-green-50 transition-colors shadow-lg"
              >
                Shop Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600/30 text-white font-semibold border border-green-400/40 hover:bg-green-600/50 transition-colors backdrop-blur-sm"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '15+', label: 'Fresh Products' },
              { value: '95%', label: 'Less Water Used' },
              { value: '0', label: 'Pesticides Used' },
              { value: '24h', label: 'Farm to Door' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl md:text-4xl font-bold text-green-700">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose EcoFresh?</h2>
            <p className="text-gray-500 leading-relaxed">
              Our hydroponic systems deliver superior produce while protecting the planet.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Droplets, title: 'Water Efficient', desc: 'Uses up to 95% less water than traditional farming by recirculating nutrient solutions.' },
              { icon: Sun, title: 'Climate Controlled', desc: 'Indoor vertical farming means perfect growing conditions year-round, regardless of weather.' },
              { icon: Recycle, title: 'Zero Pesticides', desc: 'No soil means no pests. We grow completely chemical-free, safe produce every time.' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-8 border border-stone-200 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-5">
                  <f.icon className="w-6 h-6 text-green-700" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Featured Produce</h2>
              <p className="text-gray-500">Our most popular fresh picks this week</p>
            </div>
            <Link to="/shop" className="hidden sm:inline-flex items-center gap-2 text-green-700 font-semibold hover:gap-3 transition-all">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link to="/shop" className="inline-flex items-center gap-2 text-green-700 font-semibold">
              View All Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-500">From our farm to your table in three simple steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Leaf, step: '01', title: 'We Grow', desc: 'Seeds are planted in our hydroponic systems and nurtured with precision nutrient delivery.' },
              { icon: Truck, step: '02', title: 'We Harvest & Deliver', desc: 'Produce is harvested at peak freshness and delivered to your door within 24 hours.' },
              { icon: ShieldCheck, step: '03', title: 'You Enjoy', desc: 'Enjoy crisp, nutrient-dense, pesticide-free greens that stay fresh longer.' },
            ].map((s) => (
              <div key={s.step} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center mx-auto mb-5 shadow-md">
                  <s.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-sm font-bold text-green-600 mb-1">STEP {s.step}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-700 to-emerald-900 px-8 py-16 text-center">
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Taste the Difference?
              </h2>
              <p className="text-green-100 mb-8 max-w-xl mx-auto">
                Browse our full selection of fresh hydroponic produce and have it delivered fresh to your door.
              </p>
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white text-green-700 font-semibold hover:bg-green-50 transition-colors shadow-lg"
              >
                Start Shopping
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
