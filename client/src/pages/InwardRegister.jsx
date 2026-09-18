import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  Calendar,
  Truck,
  FileCheck,
  Building,
  Search,
  Eye,
  AlertCircle,
  CheckCircle,
  Save,
  Clock,
  Printer
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function InwardRegister() {
  const { user, isOwner } = useAuth();
  const [activeView, setActiveView] = useState('new'); // 'new' or 'history'

  // Master options
  const [customers, setCustomers] = useState([]);
  const [goodsMaster, setGoodsMaster] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [packages, setPackages] = useState([]);
  const [notes, setNotes] = useState([]);

  // Inward Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerDetails, setCustomerDetails] = useState(null);
  const [poNo, setPoNo] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [dcNo, setDcNo] = useState('');
  const [dcDate, setDcDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Items in current inward entry
  const [items, setItems] = useState([
    {
      goods_id: '',
      item_description: '',
      is_manual: false,
      quantity: 1,
      uom: 'Nos',
      package_type: 'Loose',
      unit_value: 0,
      note: '',
      remarks: '',
    },
  ]);

  // History list
  const [inwardList, setInwardList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewModal, setViewModal] = useState({ open: false, entry: null, items: [] });

  // Notifications
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMasters();
    loadInwardHistory();
  }, []);

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadMasters = async () => {
    try {
      const [custRes, goodsRes, uomRes, pkgRes, noteRes] = await Promise.all([
        api.get('/customers?activeOnly=true'),
        api.get('/goods?activeOnly=true'),
        api.get('/uom'),
        api.get('/packages'),
        api.get('/notes'),
      ]);
      setCustomers(custRes.data.customers || []);
      setGoodsMaster(goodsRes.data.goods || []);
      setUoms(uomRes.data.uom || []);
      setPackages(pkgRes.data.packages || []);
      setNotes(noteRes.data.notes || []);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  const loadInwardHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/inward');
      setInwardList(res.data.entries || []);
    } catch (err) {
      console.error('Failed to fetch inward history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handle customer selection
  const handleCustomerChange = (e) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    const found = customers.find((c) => String(c.id) === String(custId));
    setCustomerDetails(found || null);
  };

  // Handle item change
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // If changing goods_id
    if (field === 'goods_id') {
      if (value === '__MANUAL__') {
        updated[index].is_manual = true;
        updated[index].goods_id = null;
        updated[index].item_description = '';
        updated[index].unit_value = 0;
      } else {
        const found = goodsMaster.find((g) => String(g.id) === String(value));
        if (found) {
          updated[index].is_manual = false;
          updated[index].item_description = found.description;
          updated[index].unit_value = found.unit_value;
          updated[index].uom = found.uom || 'Nos';
        }
      }
    }

    setItems(updated);
  };

  const addItemRow = () => {
    const defaultGood = goodsMaster[0];
    setItems([
      ...items,
      {
        goods_id: defaultGood ? defaultGood.id : '',
        item_description: defaultGood ? defaultGood.description : '',
        is_manual: false,
        quantity: 1,
        uom: defaultGood ? defaultGood.uom : 'Nos',
        package_type: packages[0]?.name || 'Loose',
        unit_value: defaultGood ? defaultGood.unit_value : 0,
        note: notes[0]?.text || '',
        remarks: '',
      },
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) {
      showToast('At least one item is required in the inward register.', 'error');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate totals
  const totalQuantity = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0), 0);
  const totalValue = items.reduce(
    (sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_value) || 0),
    0
  );

  // Submit Inward Entry
  const handleSaveInward = async (e) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      showToast('Please select a customer.', 'error');
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.item_description || !it.item_description.trim()) {
        showToast(`Item #${i + 1} must have a valid description.`, 'error');
        return;
      }
      if (isNaN(it.quantity) || parseFloat(it.quantity) <= 0) {
        showToast(`Item #${i + 1} quantity must be greater than zero.`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        po_no: poNo,
        po_date: poDate,
        dc_no: dcNo,
        dc_date: dcDate,
        vehicle_no: vehicleNo,
        remarks,
        items,
      };

      const res = await api.post('/inward', payload);
      showToast(`Inward Entry ${res.data.inwardNo} saved permanently!`);

      // Reset form
      setSelectedCustomerId('');
      setCustomerDetails(null);
      setPoNo('');
      setDcNo('');
      setVehicleNo('');
      setRemarks('');
      setItems([
        {
          goods_id: '',
          item_description: '',
          is_manual: false,
          quantity: 1,
          uom: 'Nos',
          package_type: 'Loose',
          unit_value: 0,
          note: '',
          remarks: '',
        },
      ]);

      loadInwardHistory();
      setActiveView('history');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save inward entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  // View details modal
  const openViewModal = async (id) => {
    try {
      const res = await api.get(`/inward/${id}`);
      setViewModal({ open: true, entry: res.data.entry, items: res.data.items });
    } catch (err) {
      showToast('Failed to load entry details', 'error');
    }
  };

  // Delete Inward (Owner only)
  const handleDeleteInward = async (id, no) => {
    if (!window.confirm(`Are you sure you want to delete Inward Entry ${no}? Stock will be reversed.`)) return;
    try {
      await api.delete(`/inward/${id}`);
      showToast(`Inward Entry ${no} deleted successfully.`);
      loadInwardHistory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete inward entry', 'error');
    }
  };

  // Filter history
  const filteredHistory = inwardList.filter(
    (e) =>
      e.inward_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.po_no && e.po_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.dc_no && e.dc_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.vehicle_no && e.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase()))
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

      {/* Header & Tab Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Inward Stock Register
          </h1>
          <p className="text-sm text-slate-500">
            Record raw materials, job-work consignments, and customer goods received at the factory.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveView('new')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeView === 'new'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + New Inward Entry
          </button>
          <button
            onClick={() => {
              setActiveView('history');
              loadInwardHistory();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeView === 'history'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inward History & Register ({inwardList.length})
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: NEW INWARD ENTRY FORM ================= */}
      {activeView === 'new' && (
        <form onSubmit={handleSaveInward} className="space-y-6">
          {/* Section 1: Customer & Consignment Details Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Building className="w-5 h-5 text-blue-600" />
                <span>Customer & Delivery Details</span>
              </h2>
              <span className="text-xs font-semibold text-slate-400">
                Fields strictly matched to reference sheet
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Customer Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  1. Customer Name *
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Customer from Master Base --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} ({c.gst_no})
                    </option>
                  ))}
                </select>
              </div>

              {/* P.O. Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  2. P.O. Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-78912"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium"
                />
              </div>

              {/* P.O. Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  3. P.O. Date
                </label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Delivery Challan / Note Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  4. Delivery Challan (or Note) Number
                </label>
                <input
                  type="text"
                  placeholder="Customer DC No e.g. DC-1045"
                  value={dcNo}
                  onChange={(e) => setDcNo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium"
                />
              </div>

              {/* Delivery Challan Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  5. Delivery Challan Date
                </label>
                <input
                  type="date"
                  value={dcDate}
                  onChange={(e) => setDcDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Vehicle Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  6. Vehicle Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TN 38 BX 5412"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold uppercase"
                />
              </div>
            </div>

            {/* Auto-populated Customer Info Box */}
            {customerDetails && (
              <div className="mt-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <span className="font-bold">Auto-Populated Customer Address: </span>
                  <span>{customerDetails.address}</span>
                </div>
                <div className="font-mono font-bold bg-white px-3 py-1 rounded-lg border border-blue-300 text-blue-800">
                  GSTIN: {customerDetails.gst_no}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Multiple Goods Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  7. Inward Goods / Particulars Table
                </h2>
                <p className="text-xs text-slate-500">
                  Select predefined goods from master or choose "Manual Typing". Rates auto-populate from Goods Master.
                </p>
              </div>

              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Item</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5 min-w-[200px]">Particular / Description</th>
                    <th className="p-2.5 w-24">Quantity</th>
                    <th className="p-2.5 w-24">UOM</th>
                    <th className="p-2.5 min-w-[140px]">Kind of Package</th>
                    <th className="p-2.5 w-28">Unit Value (₹)</th>
                    <th className="p-2.5 w-28 text-right">Total (₹)</th>
                    <th className="p-2.5 min-w-[160px]">Note</th>
                    <th className="p-2.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => {
                    const lineTotal =
                      (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_value) || 0);

                    return (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>

                        {/* Particular / Description */}
                        <td className="p-2.5">
                          {!item.is_manual ? (
                            <select
                              value={item.goods_id || ''}
                              onChange={(e) =>
                                handleItemChange(index, 'goods_id', e.target.value)
                              }
                              className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold text-slate-800"
                            >
                              <option value="">-- Select Goods from Master --</option>
                              {goodsMaster.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.description} (₹{g.unit_value})
                                </option>
                              ))}
                              <option value="__MANUAL__">✏️ OR Manual Typing...</option>
                            </select>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <input
                                type="text"
                                placeholder="Type custom description..."
                                value={item.item_description}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    'item_description',
                                    e.target.value.toUpperCase()
                                  )
                                }
                                className="w-full p-2 bg-amber-50/60 border border-amber-300 rounded-lg text-xs font-bold uppercase"
                              />
                              <button
                                type="button"
                                title="Switch back to Master Dropdown"
                                onClick={() => {
                                  const updated = [...items];
                                  updated[index].is_manual = false;
                                  updated[index].goods_id = '';
                                  setItems(updated);
                                }}
                                className="text-[10px] text-blue-600 hover:underline px-1 whitespace-nowrap"
                              >
                                Master
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(index, 'quantity', e.target.value)
                            }
                            className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-bold text-center"
                          />
                        </td>

                        {/* UOM */}
                        <td className="p-2.5">
                          <select
                            value={item.uom || 'Nos'}
                            onChange={(e) =>
                              handleItemChange(index, 'uom', e.target.value)
                            }
                            className="w-full p-2 bg-slate-50 border rounded-lg text-xs"
                          >
                            {uoms.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Kind of Package */}
                        <td className="p-2.5">
                          <select
                            value={item.package_type || 'Loose'}
                            onChange={(e) =>
                              handleItemChange(index, 'package_type', e.target.value)
                            }
                            className="w-full p-2 bg-slate-50 border rounded-lg text-xs"
                          >
                            {packages.map((pkg) => (
                              <option key={pkg.id} value={pkg.name}>
                                {pkg.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Unit Value */}
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_value}
                            onChange={(e) =>
                              handleItemChange(index, 'unit_value', e.target.value)
                            }
                            className="w-full p-2 bg-slate-50 border rounded-lg text-xs font-mono font-bold text-emerald-700"
                          />
                        </td>

                        {/* Total Line Value */}
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                          ₹{lineTotal.toFixed(2)}
                        </td>

                        {/* Note */}
                        <td className="p-2.5">
                          <select
                            value={item.note || ''}
                            onChange={(e) =>
                              handleItemChange(index, 'note', e.target.value)
                            }
                            className="w-full p-2 bg-slate-50 border rounded-lg text-xs"
                          >
                            <option value="">-- Select Note --</option>
                            {notes.map((n) => (
                              <option key={n.id} value={n.text}>
                                {n.text}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Remove */}
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Inward Remarks */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Consignment Remarks / Observations
              </label>
              <input
                type="text"
                placeholder="Optional notes or condition of received boxes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Section 3: Summary & Action Bar */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  TOTAL QUANTITY
                </span>
                <span className="text-2xl font-black text-slate-900">
                  {totalQuantity} <span className="text-xs font-normal text-slate-500">Units</span>
                </span>
              </div>
              <div className="h-10 w-px bg-slate-200"></div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  TOTAL INWARD VALUE
                </span>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center space-x-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving to Database...' : 'Save Inward Entry'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ================= VIEW 2: INWARD HISTORY & REGISTER ================= */}
      {activeView === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search Inward #, Customer, PO, DC, Vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setActiveView('new')}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-blue-700"
            >
              + Create Inward
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3.5">Inward #</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">PO / DC Details</th>
                  <th className="p-3.5">Vehicle No</th>
                  <th className="p-3.5 text-center">Items</th>
                  <th className="p-3.5 text-right">Total Qty</th>
                  <th className="p-3.5 text-right">Total Value</th>
                  <th className="p-3.5">Created By</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-8 text-center text-slate-400">
                      No inward entries found.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-mono font-bold text-blue-700">
                        {entry.inward_no}
                      </td>
                      <td className="p-3.5 text-slate-600 text-xs">
                        {new Date(entry.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {entry.customer_name}
                      </td>
                      <td className="p-3.5 text-xs text-slate-600">
                        <div>PO: {entry.po_no || 'N/A'}</div>
                        <div>DC: {entry.dc_no || 'N/A'}</div>
                      </td>
                      <td className="p-3.5 font-mono uppercase font-semibold text-slate-700">
                        {entry.vehicle_no || '-'}
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-600">
                        {entry.item_count} items
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-800">
                        {entry.total_quantity}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                        ₹{parseFloat(entry.total_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-slate-500 text-xs">
                        {entry.created_by_name}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => openViewModal(entry.id)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteInward(entry.id, entry.inward_no)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete Inward Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: Inward Consignment Details & Pending Items ================= */}
      {viewModal.open && viewModal.entry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase font-mono">
                  {viewModal.entry.inward_no}
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {viewModal.entry.customer_name}
                </h3>
              </div>
              <button
                onClick={() => setViewModal({ open: false, entry: null, items: [] })}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl">
              <div>
                <span className="text-slate-500 font-bold block">P.O. Number</span>
                <span className="font-semibold">{viewModal.entry.po_no || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Delivery Challan</span>
                <span className="font-semibold">{viewModal.entry.dc_no || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Vehicle No</span>
                <span className="font-semibold font-mono uppercase">
                  {viewModal.entry.vehicle_no || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Recorded By</span>
                <span className="font-semibold">{viewModal.entry.created_by_name}</span>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Consignment Items & Live Dispatch Status
              </h4>
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5 text-center">Inward Qty</th>
                    <th className="p-2.5 text-center">Outward Dispatched</th>
                    <th className="p-2.5 text-center">Pending Qty</th>
                    <th className="p-2.5 text-right">Unit Rate</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewModal.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2.5 font-bold text-slate-800">
                        {it.item_description}
                        <span className="text-[10px] text-slate-400 block">
                          Pkg: {it.package_type} | {it.note || 'No note'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-semibold">
                        {it.quantity} {it.uom}
                      </td>
                      <td className="p-2.5 text-center font-semibold text-amber-700">
                        {it.already_outward_qty} {it.uom}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold ${
                            it.pending_qty > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {it.pending_qty} {it.uom}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono">₹{it.unit_value}</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        ₹{it.total_value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setViewModal({ open: false, entry: null, items: [] })}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
