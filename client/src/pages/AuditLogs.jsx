import React, { useState, useEffect } from 'react';
import { History, Search, ShieldCheck, User, Calendar, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AuditLogs() {
  const { isOwner } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/audit', { params });
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center">
        <h2 className="text-base font-bold text-red-800">Owner Access Required</h2>
        <p className="text-xs text-red-600 mt-1">Audit Logs are restricted to Owner / Administrator accounts.</p>
      </div>
    );
  }

  const filteredLogs = logs.filter(
    (l) =>
      l.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Security & Transaction Audit Trail
          </h1>
          <p className="text-sm text-slate-500">
            Immutable log of all user activities, inward receipts, delivery challans, and data modifications.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Filter Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">User Logins</option>
            <option value="CREATE_INWARD">Create Inward Entry</option>
            <option value="CREATE_OUTWARD">Create Outward Challan</option>
            <option value="DELETE_INWARD">Delete Inward</option>
            <option value="DELETE_OUTWARD">Delete Outward</option>
            <option value="CREATE_CUSTOMER">Create Customer</option>
            <option value="UPDATE_SETTINGS">Settings Changes</option>
          </select>
        </div>

        <div className="flex-1 max-w-md">
          <label className="block font-bold text-slate-700 mb-1">Search Details / User</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, action, details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="p-3.5 w-16">ID</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entity</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-mono text-slate-400">#{l.id}</td>
                    <td className="p-3.5 text-slate-600 whitespace-nowrap font-mono text-xs">
                      {new Date(l.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{l.username}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-800 border">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 text-xs">
                      {l.entity_type} {l.entity_id ? `(#${l.entity_id})` : ''}
                    </td>
                    <td className="p-3.5 text-slate-800 font-medium">
                      {l.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
