import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MasterBase from './pages/MasterBase';
import InwardRegister from './pages/InwardRegister';
import OutwardChallan from './pages/OutwardChallan';
import StockLedger from './pages/StockLedger';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import WorkerManagement from './pages/WorkerManagement';
import AuditLogs from './pages/AuditLogs';

// Protected Route wrapper
function ProtectedRoute({ children, requireOwner = false }) {
  const { user, loading, isOwner } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireOwner && !isOwner) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="masters" element={<MasterBase />} />
            <Route path="inward" element={<InwardRegister />} />
            <Route path="outward" element={<OutwardChallan />} />
            <Route path="stock" element={<StockLedger />} />
            <Route path="reports" element={<Reports />} />

            {/* Owner Only Routes */}
            <Route
              path="settings"
              element={
                <ProtectedRoute requireOwner>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="workers"
              element={
                <ProtectedRoute requireOwner>
                  <WorkerManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit"
              element={
                <ProtectedRoute requireOwner>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
