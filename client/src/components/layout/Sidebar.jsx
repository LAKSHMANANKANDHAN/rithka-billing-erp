import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  ArrowDownLeft,
  FileText,
  Boxes,
  BarChart3,
  Building2,
  Users,
  History,
  X,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { isOwner } = useAuth();

  const mainNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Master Base', path: '/masters', icon: Database },
    { name: 'Inward Register', path: '/inward', icon: ArrowDownLeft },
    { name: 'Outward Challan', path: '/outward', icon: FileText },
    { name: 'Stock Ledger', path: '/stock', icon: Boxes },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
  ];

  const adminNav = [
    { name: 'Company Settings', path: '/settings', icon: Building2 },
    { name: 'Worker Accounts', path: '/workers', icon: Users },
    { name: 'Audit Logs', path: '/audit', icon: History },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } print:hidden`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-md">
              R
            </div>
            <div>
              <span className="font-bold text-base tracking-wide text-white block leading-tight">
                RITHKA ERP
              </span>
              <span className="text-xs text-amber-400 font-medium">
                Billing & Stock
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          <div>
            <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Main Modules
            </div>
            <nav className="space-y-1">
              {mainNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Owner Administration */}
          {isOwner && (
            <div>
              <div className="px-3 mb-2 text-xs font-semibold text-amber-400/90 uppercase tracking-wider flex items-center justify-between">
                <span>Owner Admin</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded">
                  Admin
                </span>
              </div>
              <nav className="space-y-1">
                {adminNav.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => onClose && onClose()}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 text-center">
          <p className="font-semibold text-slate-300">Shri.Bharathi & Co.,</p>
          <p className="text-[11px] text-slate-500">Coimbatore, Tamil Nadu</p>
        </div>
      </aside>
    </>
  );
}
