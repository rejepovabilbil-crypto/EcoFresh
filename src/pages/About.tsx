import { Leaf, Target, Heart, Award, Users, Sprout } from 'lucide-react';

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-green-800 to-emerald-900 py-20 md:py-28">
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://images.pexels.com/photos/2284166/pexels-photo-2284166.jpeg?auto=compress&cs=tinysrgb&w=1600"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">About EcoFresh</h1>
          <p className="text-green-100 max-w-2xl mx-auto text-lg leading-relaxed">
            Pioneering sustainable urban agriculture in the heart of Dubai.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-5">
                <Sprout className="w-4 h-4" /> Our Story
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                From Vision to Vertical Farm
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Founded in 2021, EcoFresh Urban Farms began with a simple question: how do you grow
                  fresh, healthy produce in a desert city like Dubai? The answer was hydroponics —
                  a soil-free growing method that uses nutrient-rich water to cultivate plants
                  with remarkable efficiency.
                </p>
                <p>
                  Starting from a small facility in Dubai Silicon Oasis, we've grown into a
                  leading urban farm supplying households and restaurants across the UAE with
                  premium, pesticide-free greens. Our climate-controlled indoor farms operate
                  year-round, unaffected by the harsh outdoor conditions.
                </p>
                <p>
                  Today, we're proud to grow over a dozen varieties of leafy greens, herbs, and
                  microgreens — all delivered within 24 hours of harvest.
                </p>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/2284166/pexels-photo-2284166.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Hydroponic farm"
                className="rounded-2xl shadow-lg w-full aspect-[4/3] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Values</h2>
            <p className="text-gray-500">The principles that guide everything we grow</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Heart, title: 'Sustainability', desc: 'We minimize water, eliminate pesticides, and reduce food miles by growing locally.' },
              { icon: Award, title: 'Quality', desc: 'Every plant is monitored and harvested at peak nutrition for unmatched freshness.' },
              { icon: Users, title: 'Community', desc: 'We support local restaurants, families, and a healthier food system for all of Dubai.' },
            ].map((v) => (
              <div key={v.title} className="bg-white rounded-2xl p-8 border border-stone-200 text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-5">
                  <v.icon className="w-7 h-7 text-green-700" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-green-700 to-emerald-900 rounded-3xl p-10 md:p-16 text-center">
            <Target className="w-12 h-12 text-green-200 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Our Mission</h2>
            <p className="text-green-100 text-lg leading-relaxed max-w-2xl mx-auto">
              To transform how Dubai eats by making fresh, sustainable, pesticide-free produce
              accessible to everyone — while using 95% less water and zero harmful chemicals.
              We believe the future of food is local, clean, and grown with care.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '2021', label: 'Founded' },
              { value: '12+', label: 'Product Varieties' },
              { value: '500+', label: 'Happy Customers' },
              { value: '95%', label: 'Less Water' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 border border-stone-200">
                <div className="text-3xl font-bold text-green-700">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
