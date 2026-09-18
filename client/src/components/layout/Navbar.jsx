import React from 'react';
import { Menu, LogOut, User, PlusCircle, ArrowDownLeft, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ onMenuToggle }) {
  const { user, logout, isOwner } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 print:hidden shadow-xs">
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="hidden sm:block">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Shri.Bharathi & Co.
          </span>
          <h1 className="text-sm font-bold text-slate-800">
            Inward Stock & Outward Delivery Challan System
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Quick entry buttons */}
        <Link
          to="/inward"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold border border-blue-200 transition-colors"
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span className="hidden md:inline">+ Inward Stock</span>
          <span className="md:hidden">+ Inward</span>
        </Link>
        <Link
          to="/outward"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold border border-amber-300 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden md:inline">+ Outward Challan</span>
          <span className="md:hidden">+ Challan</span>
        </Link>

        {/* User Role Badge */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-800">{user?.full_name || user?.username}</div>
            <span
              className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                isOwner
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isOwner ? 'Owner / Admin' : 'Worker'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
