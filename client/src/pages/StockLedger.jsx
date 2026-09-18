import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Download,
  Filter,
  ArrowDownLeft,
  FileText,
  Building,
  CheckCircle2,
  Clock,
  RefreshCw
} from 'lucide-react';
import api from '../api/client';

export default function StockLedger() {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'ledger'
  const [summaryData, setSummaryData] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadData();
  }, [activeTab, selectedCustomerId, transactionType, startDate, endDate]);

  const loadCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data.customers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'summary') {
        const params = {};
        if (selectedCustomerId) params.customer_id = selectedCustomerId;
        const res = await api.get('/stock/summary', { params });
        setSummaryData(res.data.summary || []);
      } else {
        const params = {};
        if (selectedCustomerId) params.customer_id = selectedCustomerId;
        if (transactionType) params.transaction_type = transactionType;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const res = await api.get('/stock/ledger', { params });
        setLedgerData(res.data.transactions || []);
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export CSV helper
  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'summary') {
      csvContent += 'Customer Name,GSTIN,Item Description,UOM,Total Inward Qty,Total Outward Qty,Pending Stock Qty,Pending Value,Status\r\n';
      filteredSummary.forEach((row) => {
        const status = row.pending_qty > 0 ? 'PENDING' : 'COMPLETED';
        csvContent += `"${row.customer_name}","${row.customer_gst}","${row.item_description}","${row.uom}",${row.total_inward_qty},${row.total_outward_qty},${row.pending_qty},${row.pending_value},"${status}"\r\n`;
      });
    } else {
      csvContent += 'Trans ID,Date,Customer,Type,Inward No,Challan No,Item Description,Quantity,UOM,Unit Value,Total Value,Worker,Notes\r\n';
      filteredLedger.forEach((row) => {
        csvContent += `${row.id},"${row.transaction_date}","${row.customer_name}","${row.transaction_type}","${row.inward_no || ''}","${row.challan_no || ''}","${row.item_description}",${row.quantity},"${row.uom}",${row.unit_value},${row.total_value},"${row.worker_name}","${row.notes || ''}"\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter client-side search
  const filteredSummary = summaryData.filter(
    (s) =>
      s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.item_description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLedger = ledgerData.filter(
    (l) =>
      l.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.item_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.inward_no && l.inward_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.challan_no && l.challan_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.worker_name && l.worker_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Stock Entry & Inventory Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Real-time stock balance tracking, inward receipts, and outward delivery audit ledger.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* View Switcher & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'summary'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              1. Live Stock Balance Summary
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'ledger'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              2. Transaction Ledger History
            </button>
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            {activeTab === 'summary'
              ? `${filteredSummary.length} Particulars tracked`
              : `${filteredLedger.length} Transactions logged`}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Filter by Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl"
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'ledger' && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="">INWARD & OUTWARD</option>
                <option value="INWARD">INWARD Receipts Only</option>
                <option value="OUTWARD">OUTWARD Dispatches Only</option>
              </select>
            </div>
          )}

          {activeTab === 'ledger' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </>
          )}

          <div className={activeTab === 'summary' ? 'md:col-span-3' : 'md:col-span-4'}>
            <label className="block font-bold text-slate-700 mb-1">Search Particular / Customer / Reference</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Type customer name, item description, inward number or DC number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: SUMMARY MATRIX ================= */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Particular / Item</th>
                  <th className="p-3.5 text-center">UOM</th>
                  <th className="p-3.5 text-right">Total Inward Qty</th>
                  <th className="p-3.5 text-right">Total Outward Qty</th>
                  <th className="p-3.5 text-right">Pending In Factory</th>
                  <th className="p-3.5 text-right">Pending Value (₹)</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-400">
                      No stock records matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSummary.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold text-slate-900">
                        {s.customer_name}
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {s.customer_gst}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        {s.item_description}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {s.uom}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-blue-700">
                        {s.total_inward_qty}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-amber-700">
                        {s.total_outward_qty}
                      </td>
                      <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                        {s.pending_qty}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                        ₹{parseFloat(s.pending_value).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                            s.pending_qty > 0
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {s.pending_qty > 0 ? (
                            <>
                              <Clock className="w-3 h-3 mr-1" />
                              <span>PENDING</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              <span>COMPLETED</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: TRANSACTION LEDGER ================= */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3 w-16">Trans ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-center">Type</th>
                  <th className="p-3">Inward #</th>
                  <th className="p-3">Challan #</th>
                  <th className="p-3">Particular</th>
                  <th className="p-3 text-right">Inward Qty</th>
                  <th className="p-3 text-right">Outward Qty</th>
                  <th className="p-3 text-right">Total Value</th>
                  <th className="p-3">Worker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="p-8 text-center text-slate-400">
                      No transactions recorded.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-slate-400">#{row.id}</td>
                      <td className="p-3 text-slate-600 font-medium">
                        {new Date(row.transaction_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {row.customer_name}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                            row.transaction_type === 'INWARD'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {row.transaction_type === 'INWARD' ? (
                            <ArrowDownLeft className="w-3 h-3 mr-1" />
                          ) : (
                            <FileText className="w-3 h-3 mr-1" />
                          )}
                          {row.transaction_type}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-700">
                        {row.inward_no || '-'}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-900">
                        {row.challan_no || '-'}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {row.item_description}
                      </td>
                      <td className="p-3 text-right font-bold text-blue-700">
                        {row.transaction_type === 'INWARD' ? `${row.quantity} ${row.uom}` : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-800">
                        {row.transaction_type === 'OUTWARD' ? `${row.quantity} ${row.uom}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        ₹{parseFloat(row.total_value).toFixed(2)}
                      </td>
                      <td className="p-3 text-slate-500 text-xs">
                        {row.worker_name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
