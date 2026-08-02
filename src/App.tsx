import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from '@/pages/Home';
import About from '@/pages/About';
import Shop from '@/pages/Shop';
import ProductDetail from '@/pages/ProductDetail';
import Contact from '@/pages/Contact';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import OrderConfirmation from '@/pages/OrderConfirmation';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminProducts from '@/pages/AdminProducts';
import AdminInventory from '@/pages/AdminInventory';
import CropManagement from '@/pages/CropManagement';
import AdminCustomers from '@/pages/AdminCustomers';
import AdminStaff from '@/pages/AdminStaff';
import SensorDashboard from '@/pages/SensorDashboard';
import EnvironmentalAlerts from '@/pages/EnvironmentalAlerts';
import Reports from '@/pages/Reports';
import StaffDashboard from '@/pages/StaffDashboard';
import AccountDashboard from '@/pages/AccountDashboard';
import OrderTracking from '@/pages/OrderTracking';
import { supabase } from '@/lib/supabase';

function RoleRedirect() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || redirected.current) return;
    if (user && profile && location.pathname === '/') {
      redirected.current = true;
      if (profile.role === 'admin') navigate('/admin/dashboard', { replace: true });
      else if (profile.role === 'staff') navigate('/staff/dashboard', { replace: true });
      else navigate('/account/dashboard', { replace: true });
    }
  }, [user, profile, loading, location.pathname, navigate]);

  return <Home />;
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/about" element={<About />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminProducts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminInventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/crops"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CropManagement role="admin" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/customers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminCustomers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminStaff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sensors"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SensorDashboard role="admin" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/alerts"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <EnvironmentalAlerts role="admin" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/alerts"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <EnvironmentalAlerts role="staff" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/sensors"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <SensorDashboard role="staff" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/crops"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <CropManagement role="staff" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/dashboard"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/dashboard"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <AccountDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute allowedRoles={['customer', 'staff', 'admin']}>
              <OrderTracking />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function SeedDemoUsers() {
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    supabase.functions.invoke('seed-demo-users').catch(() => {});
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SeedDemoUsers />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
