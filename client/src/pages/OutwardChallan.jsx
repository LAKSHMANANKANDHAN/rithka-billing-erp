import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Printer,
  Trash2,
  AlertCircle,
  CheckCircle,
  Eye,
  Calendar,
  Truck,
  Building,
  ArrowRight,
  RefreshCw,
  Plus
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ChallanPrintPreview from '../components/challan/ChallanPrintPreview';

export default function OutwardChallan() {
  const { user, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'register', or 'preview'

  // Master options
  const [pendingInwards, setPendingInwards] = useState([]);
  const [packages, setPackages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);

  // Outward Form Selection
  const [selectedInwardId, setSelectedInwardId] = useState('');
  const [selectedInwardData, setSelectedInwardData] = useState(null);
  const [inwardItems, setInwardItems] = useState([]);
  const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [selectedNote, setSelectedNote] = useState('');
  const [remarks, setRemarks] = useState('');

  // Selected items with dispatch quantities
  // Mapping: { [inward_item_id]: { quantity, your_ref_no, package_type } }
  const [dispatchItems, setDispatchItems] = useState({});

  // Register & History
  const [challansList, setChallansList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Active Challan for Preview
  const [previewData, setPreviewData] = useState({ challan: null, items: [], company: null });

  // Notifications
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    loadPrerequisites();
    loadChallansRegister();
  }, []);

  const showToast = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const loadPrerequisites = async () => {
    try {
      const [pendRes, pkgRes, noteRes, settRes] = await Promise.all([
        api.get('/inward/pending-items'),
        api.get('/packages'),
        api.get('/notes'),
        api.get('/settings'),
      ]);
      setPendingInwards(pendRes.data.pendingInwards || []);
      setPackages(pkgRes.data.packages || []);
      setNotes(noteRes.data.notes || []);
      setCompanySettings(settRes.data.settings || null);
      if (noteRes.data.notes?.length > 0) {
        setSelectedNote(noteRes.data.notes[0].text);
      }
    } catch (err) {
      console.error('Failed to load prerequisites:', err);
    }
  };

  const loadChallansRegister = async () => {
    setLoading(true);
    try {
      const res = await api.get('/outward');
      setChallansList(res.data.challans || []);
    } catch (err) {
      console.error('Failed to load challans register:', err);
    } finally {
      setLoading(false);
    }
  };

  // When worker chooses an Inward Entry from dropdown
  const handleSelectInward = async (e) => {
    const inwardId = e.target.value;
    setSelectedInwardId(inwardId);
    setDispatchItems({});

    if (!inwardId) {
      setSelectedInwardData(null);
      setInwardItems([]);
      return;
    }

    try {
      const res = await api.get(`/inward/${inwardId}`);
      if (res.data.success) {
        const { entry, items } = res.data;
        setSelectedInwardData(entry);
        setInwardItems(items);
        setVehicleNo(entry.vehicle_no || '');

        // Initialize dispatch quantities with remaining pending amounts
        const initialDispatch = {};
        items.forEach((it) => {
          initialDispatch[it.id] = {
            quantity: it.pending_qty > 0 ? it.pending_qty : 0,
            your_ref_no: '',
            package_type: it.package_type || 'Loose',
            selected: it.pending_qty > 0,
          };
        });
        setDispatchItems(initialDispatch);
      }
    } catch (err) {
      showToast('Failed to load inward entry items', 'error');
    }
  };

  // Handle item dispatch quantity input
  const handleItemDispatchChange = (inwardItemId, field, val) => {
    setDispatchItems((prev) => ({
      ...prev,
      [inwardItemId]: {
        ...prev[inwardItemId],
        [field]: val,
      },
    }));
  };

  // Calculate live financial totals
  let subtotal = 0;
  inwardItems.forEach((it) => {
    const disp = dispatchItems[it.id];
    if (disp && disp.selected) {
      const q = parseFloat(disp.quantity) || 0;
      const rate = parseFloat(it.unit_value) || 0;
      subtotal += q * rate;
    }
  });

  const taxRate = parseFloat(companySettings?.default_tax_rate ?? 9.0);
  const taxAmount = (subtotal * taxRate) / 100.0;
  const grandTotal = subtotal + taxAmount;

  // Save Outward Challan
  const handleCreateChallan = async (e) => {
    e.preventDefault();

    if (!selectedInwardId) {
      showToast('Please select an Inward Stock Entry first.', 'error');
      return;
    }

    // Build items payload & validate pending boundaries
    const itemsToDispatch = [];
    for (const it of inwardItems) {
      const disp = dispatchItems[it.id];
      if (disp && disp.selected) {
        const qty = parseFloat(disp.quantity);
        if (isNaN(qty) || qty <= 0) {
          continue;
        }

        if (qty > it.pending_qty) {
          showToast(
            `Error: Outward quantity (${qty}) for "${it.item_description}" exceeds available pending inward quantity (${it.pending_qty})!`,
            'error'
          );
          return;
        }

        itemsToDispatch.push({
          inward_item_id: it.id,
          goods_id: it.goods_id,
          item_description: it.item_description,
          your_ref_no: disp.your_ref_no || '',
          quantity: qty,
          uom: it.uom,
          package_type: disp.package_type || it.package_type,
          unit_value: it.unit_value,
        });
      }
    }

    if (itemsToDispatch.length === 0) {
      showToast('Please select at least one item with a valid dispatch quantity > 0.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        inward_id: selectedInwardId,
        challan_date: challanDate,
        vehicle_no: vehicleNo,
        note: selectedNote,
        remarks,
        items: itemsToDispatch,
      };

      const res = await api.post('/outward', payload);
      showToast(`Delivery Challan ${res.data.challanNo} created successfully!`);

      // Open print preview directly
      openChallanPreview(res.data.challanId);

      // Refresh list
      loadChallansRegister();
      loadPrerequisites();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create outward challan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Open dedicated print preview
  const openChallanPreview = async (challanId) => {
    try {
      const res = await api.get(`/outward/${challanId}`);
      if (res.data.success) {
        setPreviewData({
          challan: res.data.challan,
          items: res.data.items,
          company: res.data.company,
        });
        setActiveTab('preview');
      }
    } catch (err) {
      showToast('Failed to load challan preview data', 'error');
    }
  };

  // Delete Challan (Owner only)
  const handleDeleteChallan = async (id, challanNo) => {
    if (!window.confirm(`Are you sure you want to delete Challan ${challanNo}? Stock deduction will be reversed.`)) return;
    try {
      await api.delete(`/outward/${id}`);
      showToast(`Challan ${challanNo} deleted and stock rolled back.`);
      loadChallansRegister();
      loadPrerequisites();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete challan', 'error');
    }
  };

  // Filter register
  const filteredChallans = challansList.filter(
    (c) =>
      c.challan_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.inward_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.po_no && c.po_no.toLowerCase().includes(searchTerm.toLowerCase()))
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

      {/* Header & Tabs (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Outward Delivery Challan
          </h1>
          <p className="text-sm text-slate-500">
            Generate official A4 Delivery Challan Cum Packing Notes with automatic inward linkage, 9% GST, and stock deduction.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + Create Challan
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              loadChallansRegister();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'register'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Challan Register ({challansList.length})
          </button>
        </div>
      </div>

      {/* ================= TAB 1: CREATE OUTWARD CHALLAN ================= */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateChallan} className="space-y-6">
          {/* Step 1: Select Inward Consignment Dropdown */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <span>Step 1: Select Inward Stock Entry</span>
              </h2>
              <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-full">
                {pendingInwards.length} Inward Consignments Pending
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Choose Inward Receipt (Consignment with Pending Goods) *
              </label>
              <select
                required
                value={selectedInwardId}
                onChange={handleSelectInward}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white"
              >
                <option value="">-- Click to Select Inward Entry --</option>
                {pendingInwards.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.inward_no} | {new Date(p.created_at).toLocaleDateString('en-IN')} | {p.customer_name} | PO: {p.po_no || 'N/A'} | DC: {p.dc_no || 'N/A'}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-populated details card */}
            {selectedInwardData && (
              <div className="mt-4 p-4 bg-amber-50/50 border border-amber-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block">Customer / Consignee:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedInwardData.customer_name}</span>
                  <span className="text-slate-600 block mt-0.5">{selectedInwardData.customer_address}</span>
                  <span className="font-mono font-bold text-blue-700 block mt-0.5">GSTIN: {selectedInwardData.customer_gst}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block">Customer References:</span>
                  <span className="block"><strong>P.O. No:</strong> {selectedInwardData.po_no || '-'}</span>
                  <span className="block"><strong>P.O. Date:</strong> {selectedInwardData.po_date || '-'}</span>
                  <span className="block"><strong>Cust DC No:</strong> {selectedInwardData.dc_no || '-'}</span>
                  <span className="block"><strong>Cust DC Date:</strong> {selectedInwardData.dc_date || '-'}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-bold block">Inward Metadata:</span>
                  <span className="block font-mono font-bold text-amber-800">Inward No: {selectedInwardData.inward_no}</span>
                  <span className="block">Vehicle No: {selectedInwardData.vehicle_no || '-'}</span>
                  <span className="block">Received Date: {new Date(selectedInwardData.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Outward Items Selection & Pending Limits */}
          {selectedInwardData && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Step 2: Select Items & Enter Outward Quantities
                  </h2>
                  <p className="text-xs text-slate-500">
                    System verifies that Current Outward Quantity cannot exceed the Pending Balance.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="p-3 w-10 text-center">Include</th>
                      <th className="p-3 min-w-[180px]">Particular / Description</th>
                      <th className="p-3 text-center">Inward Qty</th>
                      <th className="p-3 text-center">Dispatched</th>
                      <th className="p-3 text-center">Pending Qty</th>
                      <th className="p-3 min-w-[120px]">Your Ref. No</th>
                      <th className="p-3 w-28">Outward Qty *</th>
                      <th className="p-3 min-w-[130px]">Kind of Package</th>
                      <th className="p-3 text-right">Unit Rate</th>
                      <th className="p-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inwardItems.map((it) => {
                      const disp = dispatchItems[it.id] || {
                        quantity: 0,
                        your_ref_no: '',
                        package_type: it.package_type,
                        selected: false,
                      };
                      const outwardQty = parseFloat(disp.quantity) || 0;
                      const lineTotal = outwardQty * (parseFloat(it.unit_value) || 0);
                      const isOverLimit = outwardQty > it.pending_qty;

                      return (
                        <tr
                          key={it.id}
                          className={`${
                            disp.selected ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'
                          } transition`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={disp.selected}
                              onChange={(e) =>
                                handleItemDispatchChange(it.id, 'selected', e.target.checked)
                              }
                              className="w-4 h-4 rounded text-amber-500"
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {it.item_description}
                            <span className="text-[10px] text-slate-400 block font-normal">
                              UOM: {it.uom}
                            </span>
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-600">
                            {it.quantity} {it.uom}
                          </td>
                          <td className="p-3 text-center text-slate-500 font-semibold">
                            {it.already_outward_qty} {it.uom}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${
                                it.pending_qty > 0
                                  ? 'bg-amber-100 text-amber-900 font-black'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {it.pending_qty} {it.uom}
                            </span>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              disabled={!disp.selected}
                              placeholder="e.g. REF-01"
                              value={disp.your_ref_no}
                              onChange={(e) =>
                                handleItemDispatchChange(it.id, 'your_ref_no', e.target.value)
                              }
                              className="w-full p-1.5 bg-white border rounded text-xs disabled:opacity-50"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0.01"
                              max={it.pending_qty}
                              step="any"
                              disabled={!disp.selected}
                              value={disp.quantity}
                              onChange={(e) =>
                                handleItemDispatchChange(it.id, 'quantity', e.target.value)
                              }
                              className={`w-full p-1.5 border rounded font-black text-center text-xs disabled:opacity-50 ${
                                isOverLimit
                                  ? 'bg-red-50 border-red-500 text-red-700'
                                  : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                            {isOverLimit && (
                              <span className="text-[10px] text-red-600 block mt-0.5 font-bold">
                                Exceeds {it.pending_qty}!
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <select
                              disabled={!disp.selected}
                              value={disp.package_type || 'Loose'}
                              onChange={(e) =>
                                handleItemDispatchChange(it.id, 'package_type', e.target.value)
                              }
                              className="w-full p-1.5 bg-white border rounded text-xs disabled:opacity-50"
                            >
                              {packages.map((pkg) => (
                                <option key={pkg.id} value={pkg.name}>
                                  {pkg.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            ₹{parseFloat(it.unit_value).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 text-xs">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Delivery Metadata: Challan Date, Vehicle, Note, Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Challan Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Dispatch Vehicle Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TN 38 BX 5412"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Challan Note (From Note Master)
                  </label>
                  <select
                    value={selectedNote}
                    onChange={(e) => setSelectedNote(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="">-- None --</option>
                    {notes.map((n) => (
                      <option key={n.id} value={n.text}>
                        {n.text}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Challan Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Material inspected & cleared"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Tax Calculation Summary Card & Save Button */}
          {selectedInwardData && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Financial Calculations Box matching prompt */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">
                    Value of Goods (Subtotal)
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-800">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="text-slate-400 font-bold">+</div>

                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block">
                    Tax @ {taxRate}%
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-700">
                    ₹{taxAmount.toFixed(2)}
                  </span>
                </div>

                <div className="text-slate-400 font-bold">=</div>

                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-700 block">
                    GRAND TOTAL
                  </span>
                  <span className="text-2xl font-black font-mono text-slate-950">
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || subtotal <= 0}
                className="inline-flex items-center justify-center space-x-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl shadow-md transition disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{saving ? 'Generating Challan...' : 'Generate & Print Challan'}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* ================= TAB 2: CHALLAN REGISTER ================= */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search DC #, Customer, Inward #, PO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-xs hover:bg-amber-600"
            >
              + Create New Challan
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3.5">DC Number</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Linked Inward #</th>
                  <th className="p-3.5">Vehicle No</th>
                  <th className="p-3.5 text-right">Subtotal</th>
                  <th className="p-3.5 text-right">Tax @ 9%</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5">Created By</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChallans.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-8 text-center text-slate-400">
                      No delivery challans issued yet.
                    </td>
                  </tr>
                ) : (
                  filteredChallans.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-mono font-bold text-amber-900">
                        {c.challan_no}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {new Date(c.challan_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {c.customer_name}
                      </td>
                      <td className="p-3.5 font-mono text-blue-700 font-semibold">
                        {c.inward_no}
                      </td>
                      <td className="p-3.5 font-mono uppercase font-semibold text-slate-700">
                        {c.vehicle_no || '-'}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-700">
                        ₹{parseFloat(c.subtotal).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-700">
                        ₹{parseFloat(c.tax_amount).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-emerald-800">
                        ₹{parseFloat(c.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-slate-500 text-xs">
                        {c.created_by_name}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => openChallanPreview(c.id)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition"
                          title="Print / View Challan"
                        >
                          <Printer className="w-4 h-4 inline mr-1" />
                          <span className="font-bold text-xs">Print</span>
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteChallan(c.id, c.challan_no)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete Challan"
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

      {/* ================= TAB 3: DEDICATED PRINT PREVIEW ================= */}
      {activeTab === 'preview' && previewData.challan && (
        <ChallanPrintPreview
          challan={previewData.challan}
          items={previewData.items}
          company={previewData.company}
          onBack={() => setActiveTab('register')}
        />
      )}
    </div>
  );
}
