import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { isOwner } = useAuth();
  const [formData, setFormData] = useState({
    company_name: '',
    gst_no: '',
    address: '',
    phone: '',
    email: '',
    default_tax_rate: 9.0,
    inward_prefix: 'INW-',
    outward_prefix: 'DC-',
    challan_year_format: '26-27',
    starting_serial_no: 1,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    loadSettings();
  }, []);

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      if (res.data.success && res.data.settings) {
        setFormData(res.data.settings);
      }
    } catch (err) {
      showToast('Failed to load company settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOwner) {
      showToast('Only the Owner / Admin can update company settings.', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.put('/settings', formData);
      showToast('Company settings updated successfully! These changes will reflect on future challans.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-red-600 mx-auto" />
        <h2 className="text-base font-bold text-red-800">Access Restricted</h2>
        <p className="text-xs text-red-600">Company Settings are reserved for the Owner / Administrator role.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Company Settings & Tax Configuration
        </h1>
        <p className="text-sm text-slate-500">
          Configure company profile, GST registration, tax percentages, and challan serial numbering formats.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        {/* Section 1: Company Profile */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b pb-2 mb-4">
            1. Company Legal & Contact Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Registered Company Name *</label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Company GST Number *</label>
              <input
                type="text"
                required
                value={formData.gst_no}
                onChange={(e) => setFormData({ ...formData, gst_no: e.target.value.toUpperCase() })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Phone Number</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Factory & Office Address (Appears on Challan) *</label>
              <textarea
                required
                rows="3"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Company Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Tax & Challan Numbering Configuration */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b pb-2 mb-4">
            2. Tax & Serial Number Rules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Default Tax % (e.g. 9.0) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={formData.default_tax_rate}
                onChange={(e) => setFormData({ ...formData, default_tax_rate: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Inward Serial Prefix</label>
              <input
                type="text"
                value={formData.inward_prefix || 'INW-'}
                onChange={(e) => setFormData({ ...formData, inward_prefix: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Challan Fiscal Year</label>
              <input
                type="text"
                value={formData.challan_year_format || '26-27'}
                onChange={(e) => setFormData({ ...formData, challan_year_format: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Starting Serial #</label>
              <input
                type="number"
                min="1"
                value={formData.starting_serial_no || 1}
                onChange={(e) => setFormData({ ...formData, starting_serial_no: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl shadow transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Update Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
