import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute.tsx';
import MainLayout from './components/layout/MainLayout.tsx';
import { SellerSearchProvider } from './context/SellerSearchContext.tsx';

import Login from './pages/Login.tsx';
import Register from './pages/Register.tsx';
import Legal from './pages/Legal.tsx';
import ForgotPasswordScreen from './pages/ForgotPasswordScreen.tsx';
import OtpVerificationScreen from './pages/OtpVerificationScreen.tsx';
import ResetPasswordScreen from './pages/ResetPasswordScreen.tsx';

import Dashboard from './pages/Dashboard.tsx';
import Products from './pages/Products.tsx';
import Orders from './pages/Orders.tsx';
import Payments from './pages/Payments.tsx';
import Messages from './pages/Messages.tsx';
import Reviews from './pages/Reviews.tsx';
import Profile from './pages/Profile.tsx';
import Notifications from './pages/Notifications.tsx';
import DeliveryCourier from './pages/DeliveryCourier.tsx';
import DeliverySettings from './pages/DeliverySettings.tsx';
import Help from './pages/Help.tsx';
import Analytics from './pages/Analytics.tsx';
import Campaigns from './pages/Campaigns.tsx';
import ProductsAdvanced from './pages/ProductsAdvanced.tsx';
import Storefront from './pages/Storefront.tsx';
import SupportInbox from './pages/SupportInbox.tsx';
import SupportConversation from './pages/SupportConversation.tsx';
import CategoryManagement from './pages/CategoryManagement.tsx';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/verify-otp" element={<OtpVerificationScreen />} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />

      <Route
        element={
          <ProtectedRoute>
            <SellerSearchProvider>
              <MainLayout />
            </SellerSearchProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<CategoryManagement />} />
        <Route path="/products-advanced" element={<ProductsAdvanced />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/magazam" element={<Storefront />} />
        <Route path="/chat" element={<Navigate to="/support-messages" replace />} />
        <Route path="/chat/:id" element={<Navigate to="/support-messages" replace />} />
        <Route path="/support-messages" element={<SupportInbox />} />
        <Route path="/support-messages/:id" element={<SupportConversation />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/delivery-courier" element={<DeliveryCourier />} />
        <Route path="/delivery-settings" element={<DeliverySettings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/help" element={<Help />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
