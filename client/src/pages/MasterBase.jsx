import React, { useState, useEffect } from 'react';
import {
  Users,
  Package,
  FileText,
  Boxes,
  Ruler,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  X
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function MasterBase() {
  const { isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState('customers');

  // Master states
  const [customers, setCustomers] = useState([]);
  const [goods, setGoods] = useState([]);
  const [packages, setPackages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [uoms, setUoms] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // Modal forms
  const [customerModal, setCustomerModal] = useState({ open: false, isEdit: false, data: {} });
  const [goodsModal, setGoodsModal] = useState({ open: false, isEdit: false, data: {} });
  const [simpleModal, setSimpleModal] = useState({ open: false, type: '', value: '' });

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'customers') {
        const res = await api.get('/customers');
        setCustomers(res.data.customers || []);
      } else if (activeTab === 'goods') {
        const res = await api.get('/goods');
        setGoods(res.data.goods || []);
      } else if (activeTab === 'packages') {
        const res = await api.get('/packages');
        setPackages(res.data.packages || []);
      } else if (activeTab === 'notes') {
        const res = await api.get('/notes');
        setNotes(res.data.notes || []);
      } else if (activeTab === 'uom') {
        const res = await api.get('/uom');
        setUoms(res.data.uom || []);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to fetch master data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =================== Customer Actions ===================
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    try {
      const data = customerModal.data;
      if (customerModal.isEdit) {
        await api.put(`/customers/${data.id}`, data);
        showToast('Customer updated successfully');
      } else {
        await api.post('/customers', data);
        showToast('Customer created successfully');
      }
      setCustomerModal({ open: false, isEdit: false, data: {} });
      loadTabData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save customer', 'error');
    }
  };

  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove or deactivate ${name}?`)) return;
    try {
      const res = await api.delete(`/customers/${id}`);
      showToast(res.data.message || 'Customer deleted');
      loadTabData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete customer', 'error');
    }
  };

  // =================== Goods Actions ===================
  const handleSaveGoods = async (e) => {
    e.preventDefault();
    try {
      const data = goodsModal.data;
      if (goodsModal.isEdit) {
        await api.put(`/goods/${data.id}`, data);
        showToast('Item updated successfully');
      } else {
        await api.post('/goods', data);
        showToast('Item created successfully');
      }
      setGoodsModal({ open: false, isEdit: false, data: {} });
      loadTabData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save goods item', 'error');
    }
  };

  const handleDeleteGoods = async (id, desc) => {
    if (!window.confirm(`Are you sure you want to delete ${desc}?`)) return;
    try {
      const res = await api.delete(`/goods/${id}`);
      showToast(res.data.message || 'Item deleted');
      loadTabData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete item', 'error');
    }
  };

  // =================== Simple Master (Package/Note/UOM) ===================
  const handleSaveSimple = async (e) => {
    e.preventDefault();
    try {
      const val = simpleModal.value.trim();
      if (!val) return;
      if (simpleModal.type === 'package') {
        await api.post('/packages', { name: val });
        showToast('Package type added');
      } else if (simpleModal.type === 'note') {
        await api.post('/notes', { text: val });
        showToast('Note added');
      } else if (simpleModal.type === 'uom') {
        await api.post('/uom', { name: val });
        showToast('UOM added');
      }
      setSimpleModal({ open: false, type: '', value: '' });
      loadTabData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add record', 'error');
    }
  };

  const handleDeleteSimple = async (type, id) => {
    if (!window.confirm('Are you sure you want to remove this entry?')) return;
    try {
      if (type === 'package') await api.delete(`/packages/${id}`);
      else if (type === 'note') await api.delete(`/notes/${id}`);
      else if (type === 'uom') await api.delete(`/uom/${id}`);
      showToast('Record deleted successfully');
      loadTabData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  // Filtered list
  const filteredCustomers = customers.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.gst_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredGoods = goods.filter(
    (g) =>
      g.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.uom.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Master Base Management
          </h1>
          <p className="text-sm text-slate-500">
            Central database for customers, goods rates, packaging types, notes, and units of measurement.
          </p>
        </div>

        {isOwner && (
          <div>
            {activeTab === 'customers' && (
              <button
                onClick={() =>
                  setCustomerModal({
                    open: true,
                    isEdit: false,
                    data: {
                      customer_code: `CUST-${Date.now().toString().slice(-4)}`,
                      company_name: '',
                      address: '',
                      gst_no: '',
                      company_type: 'Private Limited',
                      contact_person: '',
                      phone: '',
                      email: '',
                    },
                  })
                }
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Customer</span>
              </button>
            )}

            {activeTab === 'goods' && (
              <button
                onClick={() =>
                  setGoodsModal({
                    open: true,
                    isEdit: false,
                    data: { description: '', unit_value: 0, uom: 'Nos' },
                  })
                }
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Particular / Goods</span>
              </button>
            )}

            {['packages', 'notes', 'uom'].includes(activeTab) && (
              <button
                onClick={() =>
                  setSimpleModal({
                    open: true,
                    type:
                      activeTab === 'packages'
                        ? 'package'
                        : activeTab === 'notes'
                        ? 'note'
                        : 'uom',
                    value: '',
                  })
                }
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>
                  + Add {activeTab === 'packages' ? 'Package Type' : activeTab === 'notes' ? 'Note' : 'UOM'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-2 sm:space-x-4 bg-white px-4 pt-3 rounded-xl shadow-xs">
        {[
          { id: 'customers', label: '1. Customer Master', icon: Users },
          { id: 'goods', label: '2. Goods / Particulars Master', icon: Package },
          { id: 'packages', label: '3. Package Master', icon: Boxes },
          { id: 'notes', label: '4. Note Master', icon: FileText },
          { id: 'uom', label: '5. UOM Master', icon: Ruler },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSearchTerm('');
            }}
            className={`flex items-center space-x-2 py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-amber-500 text-slate-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search Bar for items and customers */}
      {['customers', 'goods'].includes(activeTab) && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
        </div>
      )}

      {/* TAB CONTENT 1: CUSTOMERS */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-4">Customer ID / Code</th>
                  <th className="p-4">Company Name</th>
                  <th className="p-4">Address</th>
                  <th className="p-4">GST Number</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 text-center">Status</th>
                  {isOwner && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-400">
                      No customers found. Click "+ Add Customer" to add one.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-mono font-semibold text-slate-600">
                        {c.customer_code || `CUST-${c.id}`}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        {c.company_name}
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate" title={c.address}>
                        {c.address}
                      </td>
                      <td className="p-4 font-mono font-bold text-blue-700">
                        {c.gst_no}
                      </td>
                      <td className="p-4 text-slate-600">
                        {c.company_type || '-'}
                      </td>
                      <td className="p-4 text-slate-600">
                        <div>{c.contact_person || '-'}</div>
                        <div className="text-[11px] text-slate-400">{c.phone}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            c.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isOwner && (
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() =>
                              setCustomerModal({ open: true, isEdit: true, data: c })
                            }
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c.id, c.company_name)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete / Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: GOODS MASTER */}
      {activeTab === 'goods' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-amber-50/50 border-b border-amber-100 text-xs text-amber-900 font-medium">
            💡 Each particular / item has a configured default unit value (₹) which auto-populates in Inward entries and Delivery Challans.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-4">Item ID</th>
                  <th className="p-4">Particular / Description</th>
                  <th className="p-4">Default Unit Value (₹)</th>
                  <th className="p-4">UOM</th>
                  <th className="p-4 text-center">Status</th>
                  {isOwner && <th className="p-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGoods.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      No goods found. Click "+ Add Particular / Goods" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredGoods.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-mono text-slate-500">#{g.id}</td>
                      <td className="p-4 font-bold text-slate-900">{g.description}</td>
                      <td className="p-4 font-mono font-bold text-emerald-700">
                        ₹{parseFloat(g.unit_value).toFixed(2)}
                      </td>
                      <td className="p-4 text-slate-600 font-semibold">{g.uom}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            g.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {g.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isOwner && (
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() =>
                              setGoodsModal({ open: true, isEdit: true, data: g })
                            }
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteGoods(g.id, g.description)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PACKAGES */}
      {activeTab === 'packages' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-2">
            Kind of Package Master
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Configured package types appearing in Inward and Outward Delivery Challan dropdowns.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between font-semibold text-slate-800 text-sm"
              >
                <span>{pkg.name}</span>
                {isOwner && (
                  <button
                    onClick={() => handleDeleteSimple('package', pkg.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: NOTES MASTER */}
      {activeTab === 'notes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-2">Note Master</h3>
          <p className="text-xs text-slate-500 mb-6">
            Standard notes appearing in the Inward Register and printed Outward Delivery Challan bottom section.
          </p>
          <div className="space-y-2.5">
            {notes.map((n) => (
              <div
                key={n.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-sm font-medium text-slate-800"
              >
                <span>• {n.text}</span>
                {isOwner && (
                  <button
                    onClick={() => handleDeleteSimple('note', n.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: UOM MASTER */}
      {activeTab === 'uom' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-base font-bold text-slate-900 mb-2">
            Unit of Measurement (UOM) Master
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Configured measurement units (Nos, Kgs, Litres, Meter, etc.) for stock calculations.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {uoms.map((u) => (
              <div
                key={u.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between font-bold text-slate-800 text-sm"
              >
                <span>{u.name}</span>
                {isOwner && (
                  <button
                    onClick={() => handleDeleteSimple('uom', u.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODAL: Customer Add / Edit ================= */}
      {customerModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {customerModal.isEdit ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setCustomerModal({ open: false, isEdit: false, data: {} })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Customer Code</label>
                  <input
                    type="text"
                    required
                    value={customerModal.data.customer_code || ''}
                    onChange={(e) =>
                      setCustomerModal({
                        ...customerModal,
                        data: { ...customerModal.data, customer_code: e.target.value },
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Type</label>
                  <select
                    value={customerModal.data.company_type || 'Private Limited'}
                    onChange={(e) =>
                      setCustomerModal({
                        ...customerModal,
                        data: { ...customerModal.data, company_type: e.target.value },
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  >
                    <option value="Private Limited">Private Limited</option>
                    <option value="Public Limited">Public Limited</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Proprietorship">Proprietorship</option>
                    <option value="LLP">LLP</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Texmo Precision Tools Pvt Ltd"
                  value={customerModal.data.company_name || ''}
                  onChange={(e) =>
                    setCustomerModal({
                      ...customerModal,
                      data: { ...customerModal.data, company_name: e.target.value },
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Factory Address *</label>
                <textarea
                  required
                  rows="2"
                  placeholder="Site No, Street, Landmark, City, PIN"
                  value={customerModal.data.address || ''}
                  onChange={(e) =>
                    setCustomerModal({
                      ...customerModal,
                      data: { ...customerModal.data, address: e.target.value },
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 33AAACT1984Q1Z2"
                  value={customerModal.data.gst_no || ''}
                  onChange={(e) =>
                    setCustomerModal({
                      ...customerModal,
                      data: { ...customerModal.data, gst_no: e.target.value.toUpperCase() },
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono uppercase font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={customerModal.data.contact_person || ''}
                    onChange={(e) =>
                      setCustomerModal({
                        ...customerModal,
                        data: { ...customerModal.data, contact_person: e.target.value },
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={customerModal.data.phone || ''}
                    onChange={(e) =>
                      setCustomerModal({
                        ...customerModal,
                        data: { ...customerModal.data, phone: e.target.value },
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  />
                </div>
              </div>

              {customerModal.isEdit && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="custActive"
                    checked={customerModal.data.is_active === 1 || customerModal.data.is_active === true}
                    onChange={(e) =>
                      setCustomerModal({
                        ...customerModal,
                        data: { ...customerModal.data, is_active: e.target.checked ? 1 : 0 },
                      })
                    }
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <label htmlFor="custActive" className="font-bold text-slate-700">
                    Active Customer
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCustomerModal({ open: false, isEdit: false, data: {} })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: Goods Add / Edit ================= */}
      {goodsModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {goodsModal.isEdit ? 'Edit Particular / Item' : 'Add New Particular / Goods'}
              </h3>
              <button
                onClick={() => setGoodsModal({ open: false, isEdit: false, data: {} })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoods} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Particular / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STEEL TRAY, PLASTIC BIN"
                  value={goodsModal.data.description || ''}
                  onChange={(e) =>
                    setGoodsModal({
                      ...goodsModal,
                      data: { ...goodsModal.data, description: e.target.value.toUpperCase() },
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Unit Rate (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="e.g. 50.00"
                  value={goodsModal.data.unit_value ?? ''}
                  onChange={(e) =>
                    setGoodsModal({
                      ...goodsModal,
                      data: { ...goodsModal.data, unit_value: e.target.value },
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">UOM</label>
                <select
                  value={goodsModal.data.uom || 'Nos'}
                  onChange={(e) =>
                    setGoodsModal({
                      ...goodsModal,
                      data: { ...goodsModal.data, uom: e.target.value },
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl"
                >
                  <option value="Nos">Nos</option>
                  <option value="Kgs">Kgs</option>
                  <option value="Litres">Litres</option>
                  <option value="Meter">Meter</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setGoodsModal({ open: false, isEdit: false, data: {} })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: Simple Master Add (Package / Note / UOM) ================= */}
      {simpleModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 capitalize">
                Add {simpleModal.type}
              </h3>
              <button
                onClick={() => setSimpleModal({ open: false, type: '', value: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSimple} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 capitalize">
                  {simpleModal.type} Name / Description *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={`Enter ${simpleModal.type}...`}
                  value={simpleModal.value}
                  onChange={(e) =>
                    setSimpleModal({ ...simpleModal, value: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSimpleModal({ open: false, type: '', value: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
