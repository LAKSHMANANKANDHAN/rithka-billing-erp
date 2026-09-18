import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, ShieldCheck, CheckCircle2, XCircle, AlertCircle, X, Lock } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function WorkerManagement() {
  const { isOwner, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, isEdit: false, data: {} });
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    loadUsers();
  }, []);

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.users || []);
    } catch (err) {
      showToast('Failed to load users list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (modal.isEdit) {
        await api.put(`/auth/users/${modal.data.id}`, modal.data);
        showToast('Worker account updated successfully.');
      } else {
        await api.post('/auth/users', modal.data);
        showToast('New worker account created successfully.');
      }
      setModal({ open: false, isEdit: false, data: {} });
      loadUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save account', 'error');
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center">
        <h2 className="text-base font-bold text-red-800">Owner Access Required</h2>
        <p className="text-xs text-red-600 mt-1">Worker Management is restricted to Owner / Administrator accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification.show && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-sm font-semibold flex items-center space-x-2 transition-all ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Worker & User Account Management
          </h1>
          <p className="text-sm text-slate-500">
            Create and maintain worker log-in credentials with role-based permissions and activity tracking.
          </p>
        </div>

        <button
          onClick={() =>
            setModal({
              open: true,
              isEdit: false,
              data: { username: '', password: '', full_name: '', role: 'worker' },
            })
          }
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Worker Account</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="p-4">User ID</th>
                <th className="p-4">Full Name</th>
                <th className="p-4">Username / Login</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Account Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-mono text-slate-400">#{u.id}</td>
                  <td className="p-4 font-bold text-slate-900">{u.full_name}</td>
                  <td className="p-4 font-mono font-semibold text-slate-700">{u.username}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        u.role === 'owner'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {u.role === 'owner' ? 'Owner / Admin' : 'Worker'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() =>
                        setModal({
                          open: true,
                          isEdit: true,
                          data: { ...u, password: '' },
                        })
                      }
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit Account"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Add/Edit User */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {modal.isEdit ? 'Edit User Account' : 'Create New Worker Account'}
              </h3>
              <button
                onClick={() => setModal({ open: false, isEdit: false, data: {} })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={modal.data.full_name || ''}
                  onChange={(e) =>
                    setModal({ ...modal, data: { ...modal.data, full_name: e.target.value } })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  disabled={modal.isEdit}
                  placeholder="e.g. worker2"
                  value={modal.data.username || ''}
                  onChange={(e) =>
                    setModal({ ...modal, data: { ...modal.data, username: e.target.value } })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {modal.isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!modal.isEdit}
                  placeholder="••••••••"
                  value={modal.data.password || ''}
                  onChange={(e) =>
                    setModal({ ...modal, data: { ...modal.data, password: e.target.value } })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Role</label>
                <select
                  value={modal.data.role || 'worker'}
                  onChange={(e) =>
                    setModal({ ...modal, data: { ...modal.data, role: e.target.value } })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                >
                  <option value="worker">Worker (Create Inward & Outward Challans)</option>
                  <option value="owner">Owner / Admin (Full Access)</option>
                </select>
              </div>

              {modal.isEdit && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="userActive"
                    checked={modal.data.is_active === 1 || modal.data.is_active === true}
                    onChange={(e) =>
                      setModal({
                        ...modal,
                        data: { ...modal.data, is_active: e.target.checked ? 1 : 0 },
                      })
                    }
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <label htmlFor="userActive" className="font-bold text-slate-700">
                    Active Account
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, isEdit: false, data: {} })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
