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
  Plus,
  Edit,
  X,
  Save,
  Loader2
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ChallanPrintPreview, { formatDateDDMMYYYY } from '../components/challan/ChallanPrintPreview';

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

  // Edit Challan Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editingChallan, setEditingChallan] = useState(null);
  const [editFormData, setEditFormData] = useState({
    challan_date: '',
    vehicle_no: '',
    po_no: '',
    po_date: '',
    cust_dc_no: '',
    cust_dc_date: '',
    note: '',
    remarks: '',
  });
  const [editItemsList, setEditItemsList] = useState([]);

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

  // Open Edit Challan Modal
  const handleOpenEditModal = async (challanId) => {
    setEditModalOpen(true);
    setEditLoading(true);
    try {
      const res = await api.get(`/outward/${challanId}`);
      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to load challan data');
      }
      const { challan, items: currChallanItems } = res.data;
      setEditingChallan(challan);

      // Load original inward items for this consignment to allow modifying/adding items
      const inwardRes = await api.get(`/inward/${challan.inward_id}`);
      const inwardItemsData = inwardRes.data.items || [];

      setEditFormData({
        challan_date: challan.challan_date ? challan.challan_date.split('T')[0] : '',
        vehicle_no: challan.vehicle_no || '',
        po_no: challan.po_no || '',
        po_date: challan.po_date ? challan.po_date.split('T')[0] : '',
        cust_dc_no: challan.cust_dc_no || '',
        cust_dc_date: challan.cust_dc_date ? challan.cust_dc_date.split('T')[0] : '',
        note: challan.note || '',
        remarks: challan.remarks || '',
      });

      // Merge inward items with current challan's items
      const merged = inwardItemsData.map((inwIt) => {
        const match = currChallanItems.find((ci) => ci.inward_item_id === inwIt.id);
        const currentQtyInThisChallan = match ? parseFloat(match.quantity || 0) : 0;
        const maxAvailable = parseFloat(inwIt.pending_qty || 0) + currentQtyInThisChallan;

        return {
          inward_item_id: inwIt.id,
          goods_id: inwIt.goods_id,
          item_description: inwIt.item_description,
          uom: inwIt.uom,
          unit_value: match ? match.unit_value : inwIt.unit_value,
          total_inward_qty: inwIt.quantity,
          max_available: maxAvailable,
          selected: Boolean(match),
          quantity: match ? match.quantity : (inwIt.pending_qty > 0 ? inwIt.pending_qty : 0),
          your_ref_no: match ? (match.your_ref_no || '') : '',
          package_type: match ? (match.package_type || 'Loose') : (inwIt.package_type || 'Loose'),
        };
      });

      setEditItemsList(merged);
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to load challan for editing', 'error');
      setEditModalOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditItemChange = (inwardItemId, field, val) => {
    setEditItemsList((prev) =>
      prev.map((it) => {
        if (it.inward_item_id !== inwardItemId) return it;
        return { ...it, [field]: val };
      })
    );
  };

  // Calculate live financial totals for Edit Modal
  let editSubtotal = 0;
  editItemsList.forEach((it) => {
    if (it.selected) {
      const q = parseFloat(it.quantity) || 0;
      const rate = parseFloat(it.unit_value) || 0;
      editSubtotal += q * rate;
    }
  });
  const editTaxRate = parseFloat(editingChallan?.tax_rate ?? companySettings?.default_tax_rate ?? 9.0);
  const editTaxAmount = (editSubtotal * editTaxRate) / 100.0;
  const editGrandTotal = editSubtotal + editTaxAmount;

  const handleSaveEditChallan = async (e) => {
    e.preventDefault();
    if (!editingChallan) return;

    const selectedItems = [];
    for (const it of editItemsList) {
      if (it.selected) {
        const q = parseFloat(it.quantity);
        if (isNaN(q) || q <= 0) continue;
        if (q > (it.max_available + 0.0001)) {
          showToast(
            `Error: Outward quantity (${q}) for "${it.item_description}" exceeds available quantity (${it.max_available})!`,
            'error'
          );
          return;
        }
        selectedItems.push({
          inward_item_id: it.inward_item_id,
          goods_id: it.goods_id,
          item_description: it.item_description,
          your_ref_no: it.your_ref_no || '',
          quantity: q,
          uom: it.uom,
          package_type: it.package_type,
          unit_value: it.unit_value,
        });
      }
    }

    if (selectedItems.length === 0) {
      showToast('Please select at least one item with valid quantity > 0.', 'error');
      return;
    }

    setEditSaving(true);
    try {
      const payload = {
        challan_date: editFormData.challan_date,
        vehicle_no: editFormData.vehicle_no,
        po_no: editFormData.po_no,
        po_date: editFormData.po_date || null,
        cust_dc_no: editFormData.cust_dc_no,
        cust_dc_date: editFormData.cust_dc_date || null,
        note: editFormData.note,
        remarks: editFormData.remarks,
        items: selectedItems,
      };

      await api.put(`/outward/${editingChallan.id}`, payload);
      showToast(`Delivery Challan ${editingChallan.challan_no} updated successfully!`);
      setEditModalOpen(false);
      loadChallansRegister();
      loadPrerequisites();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update challan', 'error');
    } finally {
      setEditSaving(false);
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
                      <td className="p-3.5 text-slate-600 font-medium">
                        {formatDateDDMMYYYY(c.challan_date)}
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
                      <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openChallanPreview(c.id)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition inline-flex items-center space-x-1"
                          title="Print / View Challan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="font-bold text-xs">Print</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c.id)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition inline-flex items-center space-x-1"
                          title="Edit Challan"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span className="font-bold text-xs">Edit</span>
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteChallan(c.id, c.challan_no)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition inline-flex items-center"
                            title="Delete Challan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          onEdit={() => handleOpenEditModal(previewData.challan.id)}
        />
      )}

      {/* ================= EDIT CHALLAN MODAL ================= */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Edit Outward Delivery Challan
                  </h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      DC #{editingChallan?.challan_no}
                    </span>
                    <span className="text-xs text-slate-500">
                      Linked to Inward #{editingChallan?.inward_no} • {editingChallan?.customer_name}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm font-semibold text-slate-600">Loading Challan Details...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveEditChallan} className="p-4 sm:p-6 space-y-5">
                {/* Delivery Metadata Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Challan Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editFormData.challan_date}
                      onChange={(e) => setEditFormData({ ...editFormData, challan_date: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Dispatch Vehicle Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TN 38 BX 5412"
                      value={editFormData.vehicle_no}
                      onChange={(e) => setEditFormData({ ...editFormData, vehicle_no: e.target.value.toUpperCase() })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      P.O. Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PO-101"
                      value={editFormData.po_no}
                      onChange={(e) => setEditFormData({ ...editFormData, po_no: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      P.O. Date
                    </label>
                    <input
                      type="date"
                      value={editFormData.po_date}
                      onChange={(e) => setEditFormData({ ...editFormData, po_date: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Cust DC Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 260701019"
                      value={editFormData.cust_dc_no}
                      onChange={(e) => setEditFormData({ ...editFormData, cust_dc_no: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Cust DC Date
                    </label>
                    <input
                      type="date"
                      value={editFormData.cust_dc_date}
                      onChange={(e) => setEditFormData({ ...editFormData, cust_dc_date: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Challan Note
                    </label>
                    <select
                      value={editFormData.note}
                      onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="">-- None --</option>
                      {notes.map((n) => (
                        <option key={n.id} value={n.text}>
                          {n.text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Challan Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="Remarks..."
                      value={editFormData.remarks}
                      onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* Items Dispatch Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                      Items To Dispatch
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Check items to include & adjust dispatch quantities
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                        <tr>
                          <th className="p-2 text-center w-10">Select</th>
                          <th className="p-2">Item Description</th>
                          <th className="p-2 text-center w-24">Avail. Qty</th>
                          <th className="p-2 w-28">Your Ref No</th>
                          <th className="p-2 text-center w-28">Dispatch Qty *</th>
                          <th className="p-2 w-28">Package</th>
                          <th className="p-2 text-right w-24">Rate (₹)</th>
                          <th className="p-2 text-right w-24">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {editItemsList.map((it, idx) => {
                          const isOver = it.selected && parseFloat(it.quantity) > (it.max_available + 0.0001);
                          const lineVal = it.selected ? (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_value) || 0) : 0;

                          return (
                            <tr key={it.inward_item_id || idx} className={it.selected ? 'bg-amber-50/30' : 'bg-slate-50/50 opacity-60'}>
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={it.selected}
                                  onChange={(e) => handleEditItemChange(it.inward_item_id, 'selected', e.target.checked)}
                                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                                />
                              </td>
                              <td className="p-2 font-bold text-slate-900">
                                {it.item_description}
                                <span className="block text-[10px] text-slate-400 font-normal">UOM: {it.uom}</span>
                              </td>
                              <td className="p-2 text-center font-bold text-slate-600">
                                {it.max_available} {it.uom}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  disabled={!it.selected}
                                  value={it.your_ref_no}
                                  onChange={(e) => handleEditItemChange(it.inward_item_id, 'your_ref_no', e.target.value)}
                                  placeholder="Ref..."
                                  className="w-full p-1 border rounded text-xs bg-white disabled:opacity-50"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0.01"
                                  max={it.max_available}
                                  step="any"
                                  disabled={!it.selected}
                                  value={it.quantity}
                                  onChange={(e) => handleEditItemChange(it.inward_item_id, 'quantity', e.target.value)}
                                  className={`w-full p-1 border rounded text-xs text-center font-black ${
                                    isOver ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-300 bg-white'
                                  }`}
                                />
                                {isOver && (
                                  <span className="text-[9px] text-red-600 font-bold block">
                                    Max {it.max_available}!
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                <select
                                  disabled={!it.selected}
                                  value={it.package_type}
                                  onChange={(e) => handleEditItemChange(it.inward_item_id, 'package_type', e.target.value)}
                                  className="w-full p-1 border rounded text-xs bg-white disabled:opacity-50"
                                >
                                  {packages.map((pkg) => (
                                    <option key={pkg.id} value={pkg.name}>
                                      {pkg.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2 text-right font-mono">
                                ₹{parseFloat(it.unit_value || 0).toFixed(2)}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900">
                                ₹{lineVal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary & Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200">
                  <div className="flex items-center space-x-4 bg-slate-100 px-4 py-2 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Subtotal</span>
                      <span className="font-mono font-bold text-slate-800">₹{editSubtotal.toFixed(2)}</span>
                    </div>
                    <span className="text-slate-400 font-bold">+</span>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Tax @ {editTaxRate}%</span>
                      <span className="font-mono font-bold text-amber-700">₹{editTaxAmount.toFixed(2)}</span>
                    </div>
                    <span className="text-slate-400 font-bold">=</span>
                    <div>
                      <span className="text-slate-700 block text-[10px] uppercase font-black">Grand Total</span>
                      <span className="font-mono font-black text-slate-950 text-sm">₹{editGrandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving || editSubtotal <= 0}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editSaving ? 'Updating...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
