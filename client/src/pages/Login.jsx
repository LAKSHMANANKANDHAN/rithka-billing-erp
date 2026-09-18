import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ShieldCheck, AlertCircle, Building, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-md">
        {/* Company Header Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400 text-slate-950 font-black text-3xl shadow-xl mb-4 border-2 border-amber-300">
            SB
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Shri.Bharathi & Co.,
          </h1>
          <p className="text-amber-400 text-sm font-semibold tracking-wide uppercase mt-1">
            Billing, Inward Stock & Outward Challan ERP
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            Coimbatore - 641 049 | GST: 33AATPY9887A1ZU
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-800">Secure Sign In</h2>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or worker1"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-all duration-150 disabled:opacity-50 mt-2 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <span>Login to ERP Dashboard</span>
              )}
            </button>
          </form>

          {/* Quick Demo Access Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 text-center">
              Quick One-Click Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'admin123')}
                className="p-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 rounded-xl text-xs font-semibold text-left transition"
              >
                <div className="flex items-center space-x-1.5 text-purple-700 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Owner / Admin</span>
                </div>
                <div className="text-[11px] text-purple-600 mt-0.5">admin / admin123</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('worker1', 'worker123')}
                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold text-left transition"
              >
                <div className="flex items-center space-x-1.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Worker Account</span>
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">worker1 / worker123</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security / audit footer note */}
        <div className="text-center text-xs text-slate-500 mt-6">
          Protected by Role-Based Authorization & Immutable Audit Trail
        </div>
      </div>
    </div>
  );
}
