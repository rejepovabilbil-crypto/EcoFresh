import { Link } from 'react-router-dom';
import { Leaf, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-green-900 text-green-50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">EcoFresh Urban Farms</span>
            </div>
            <p className="text-sm text-green-200 leading-relaxed">
              Smart hydroponic farming bringing fresh, sustainable produce to Dubai and the UAE.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-green-200 hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/about" className="text-green-200 hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/shop" className="text-green-200 hover:text-white transition-colors">Online Shop</Link></li>
              <li><Link to="/contact" className="text-green-200 hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4">Contact</h3>
            <ul className="space-y-2 text-sm text-green-200">
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Dubai Silicon Oasis, Dubai, UAE</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +971 4 123 4567</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> hello@ecofresh.com</li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4">Follow Us</h3>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 rounded-lg bg-green-800 hover:bg-green-700 flex items-center justify-center transition-colors" aria-label="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-green-800 hover:bg-green-700 flex items-center justify-center transition-colors" aria-label="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-green-800 hover:bg-green-700 flex items-center justify-center transition-colors" aria-label="Twitter">
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-green-800 text-center text-sm text-green-300">
          <p>&copy; {new Date().getFullYear()} EcoFresh Urban Farms. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
