import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Users,
  Clock,
  Download,
  Printer,
  Search,
  Building,
  CheckCircle2,
  FileText,
  Boxes,
  ArrowDownLeft,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/client';

function formatDotDate(val) {
  if (!val || val === '-' || val === 'null' || val === 'undefined') return '';
  const str = String(val).trim();
  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
  }
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
  }
  return str;
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('closing_stock');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Closing Stock & Despatch Statement Filters
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedPartNo, setSelectedPartNo] = useState('');
  const [openingStockInput, setOpeningStockInput] = useState('');
  const [closingStockReport, setClosingStockReport] = useState(null);

  // Date filters for other legacy reports
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Report results state
  const [dailyData, setDailyData] = useState(null);
  const [rangeData, setRangeData] = useState(null);
  const [customerReport, setCustomerReport] = useState(null);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [completeWork, setCompleteWork] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [
    activeTab,
    selectedCustomerId,
    selectedMonth,
    selectedPartNo,
    openingStockInput,
    singleDate,
    startDate,
    endDate
  ]);

  const loadCustomers = async () => {
    try {
      const res = await api.get('/customers');
      const custList = res.data.customers || [];
      setCustomers(custList);
      if (custList.length > 0 && !selectedCustomerId) {
        // Prefer LGB customer if available to match typical report
        const lgb = custList.find((c) =>
          c.company_name?.toLowerCase().includes('lgb') ||
          c.company_name?.toLowerCase().includes('l.g.b')
        );
        setSelectedCustomerId(lgb ? lgb.id : custList[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'closing_stock') {
        const res = await api.get('/reports/closing-stock', {
          params: {
            customer_id: selectedCustomerId || undefined,
            month: selectedMonth,
            part_no: selectedPartNo || undefined,
            opening_stock_override: openingStockInput !== '' ? openingStockInput : undefined,
          },
        });
        setClosingStockReport(res.data);
        if (res.data.partsList?.length > 0 && !selectedPartNo) {
          setSelectedPartNo(res.data.selectedPart || res.data.partsList[0]);
        }
      } else if (activeTab === 'daily') {
        const res = await api.get('/reports/daily', { params: { date: singleDate } });
        setDailyData(res.data);
      } else if (activeTab === 'range') {
        const res = await api.get('/reports/date-range', { params: { startDate, endDate } });
        setRangeData(res.data);
      } else if (activeTab === 'customer') {
        if (selectedCustomerId) {
          const res = await api.get('/reports/customer-wise', {
            params: { customer_id: selectedCustomerId, startDate, endDate },
          });
          setCustomerReport(res.data);
        }
      } else if (activeTab === 'pending') {
        const res = await api.get('/reports/pending-tasks', {
          params: { customer_id: selectedCustomerId || undefined },
        });
        setPendingTasks(res.data.tasks || []);
      } else if (activeTab === 'complete') {
        const res = await api.get('/reports/complete-work', {
          params: { startDate, endDate, customer_id: selectedCustomerId || undefined },
        });
        setCompleteWork(res.data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  const printCurrentReport = () => {
    window.print();
  };

  // Export Closing Stock Statement to genuine Excel (.xlsx) matching the photo layout
  const exportClosingStockExcel = () => {
    if (!closingStockReport) return;

    const {
      monthLabel,
      customer,
      selectedPart,
      summary,
      tableRows = []
    } = closingStockReport;

    const customerName = customer?.company_name || 'Customer';
    const isLgb = customerName.toLowerCase().includes('lgb') || customerName.toLowerCase().includes('l.g.b');
    const dcColHeader = isLgb ? 'LGB DC/J.O NO' : 'CUSTOMER DC/J.O NO';

    const wb = XLSX.utils.book_new();

    // Data array matching the paper layout
    const sheetData = [
      ['CLOSING STOCK AS ON', monthLabel || ''],
      ['PART NO', selectedPart || 'ALL PARTS', '', '', 'CUSTOMER:', customerName],
      [], // blank separator
      [
        dcColHeader,
        'RECEIVED DATE',
        'RECEIVED QTY',
        'OUR DESPATCHED DC NO',
        'DESPATCHED DATE',
        'DESPATCHED QTY',
        'PENDING QTY',
        'REMARKS'
      ]
    ];

    // Data rows
    tableRows.forEach((row) => {
      sheetData.push([
        row.cust_dc_no || '',
        row.received_date ? formatDotDate(row.received_date) : '',
        row.received_qty !== '' && row.received_qty !== undefined ? Number(row.received_qty) : '',
        row.despatch_dc_no || '',
        row.despatch_date ? formatDotDate(row.despatch_date) : '',
        row.despatch_qty !== '' && row.despatch_qty !== undefined ? Number(row.despatch_qty) : '',
        row.pending_qty !== '' && row.pending_qty !== undefined ? Number(row.pending_qty) : '',
        row.remarks || ''
      ]);
    });

    // Blank row before totals
    sheetData.push([]);

    // Totals row
    sheetData.push([
      '',
      '',
      summary?.totalReceivedMonth || 0,
      '',
      '',
      summary?.totalDespatchedMonth || 0,
      '',
      ''
    ]);

    // Blank row before summary box
    sheetData.push([]);

    // Bottom Summary Box
    sheetData.push(['OPENING STOCK', summary?.openingStock || 0]);
    sheetData.push([
      'RECEIPT FOR THIS MONTH',
      summary?.totalReceivedMonth || 0,
      '',
      '',
      'Total stock available',
      summary?.totalStockAvailable || 0
    ]);
    sheetData.push(['TOTAL STOCKS', summary?.totalStocks || 0]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set readable column widths
    ws['!cols'] = [
      { wch: 22 }, // DC/J.O NO
      { wch: 16 }, // RECEIVED DATE
      { wch: 16 }, // RECEIVED QTY
      { wch: 24 }, // OUR DESPATCHED DC NO
      { wch: 18 }, // DESPATCHED DATE
      { wch: 16 }, // DESPATCHED QTY
      { wch: 16 }, // PENDING QTY
      { wch: 22 }  // REMARKS
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Closing Stock');

    const cleanPart = (selectedPart || 'All_Parts').replace(/[/\\?%*:|"<>]/g, '_').trim();
    const cleanCustomer = customerName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const fileName = `Closing_Stock_${monthLabel}_${cleanCustomer}_${cleanPart}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const exportCurrentCSV = () => {
    if (activeTab === 'closing_stock') {
      exportClosingStockExcel();
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'daily' && dailyData) {
      csvContent += `Daily Report - ${dailyData.date}\r\n\r\n`;
      csvContent += `Metric,Value\r\n`;
      csvContent += `Total Inward Entries,${dailyData.summary.totalInwardEntries}\r\n`;
      csvContent += `Total Inward Quantity,${dailyData.summary.totalInwardQty}\r\n`;
      csvContent += `Total Inward Value,${dailyData.summary.totalInwardVal}\r\n`;
      csvContent += `Total Outward Challans,${dailyData.summary.totalOutwardChallans}\r\n`;
      csvContent += `Total Outward Quantity,${dailyData.summary.totalOutwardQty}\r\n`;
      csvContent += `Total Outward Value,${dailyData.summary.totalOutwardVal}\r\n\r\n`;
      csvContent += `Customer Breakdown:\r\nCustomer,Inward Qty,Outward Qty,Inward Val,Outward Val\r\n`;
      dailyData.customerBreakdown.forEach((c) => {
        csvContent += `"${c.company_name}",${c.inward_qty},${c.outward_qty},${c.inward_val},${c.outward_val}\r\n`;
      });
    } else if (activeTab === 'pending') {
      csvContent += 'Inward No,Date,Customer Name,Item Description,Inward Qty,Outward Qty,Pending Qty,UOM,Pending Value,Status\r\n';
      pendingTasks.forEach((t) => {
        csvContent += `"${t.inward_no}","${t.inward_date}","${t.customer_name}","${t.item_description}",${t.inward_qty},${t.outward_qty},${t.pending_qty},"${t.uom}",${t.pending_value},"${t.status}"\r\n`;
      });
    } else if (activeTab === 'customer' && customerReport) {
      csvContent += `Customer Report - ${customerReport.customer.company_name}\r\n`;
      csvContent += `Address: "${customerReport.customer.address}"\r\n`;
      csvContent += `GSTIN: "${customerReport.customer.gst_no}"\r\n\r\n`;
      csvContent += `Total Inward Qty,${customerReport.summary.totalInwardQty}\r\n`;
      csvContent += `Total Inward Value,${customerReport.summary.totalInwardVal}\r\n`;
      csvContent += `Total Outward Value,${customerReport.summary.totalOutwardVal}\r\n`;
      csvContent += `Total Pending Qty,${customerReport.summary.totalPendingQty}\r\n\r\n`;
      csvContent += `Pending Items:\r\nInward No,Item,Inward Qty,Outward Qty,Pending Qty,Pending Value\r\n`;
      customerReport.pendingItems.forEach((p) => {
        csvContent += `"${p.inward_no}","${p.item_description}",${p.original_qty},${p.outward_qty},${p.pending_qty},${p.pending_value}\r\n`;
      });
    } else if (activeTab === 'complete' && completeWork) {
      csvContent += 'Transaction ID,Date,Customer,Type,Inward No,Challan No,Item,Quantity,Value,Worker\r\n';
      completeWork.transactions.forEach((t) => {
        csvContent += `${t.id},"${t.transaction_date}","${t.company_name}","${t.transaction_type}","${t.inward_no || ''}","${t.challan_no || ''}","${t.item_description}",${t.quantity},${t.total_value},"${t.worker_name}"\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Analytics & Reports
          </h1>
          <p className="text-sm text-slate-500">
            Exportable business audits: Closing Stock & Despatch Statement, Daily, Weekly, Customer-wise, and Pending Task reports.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={printCurrentReport}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <button
            onClick={activeTab === 'closing_stock' ? exportClosingStockExcel : exportCurrentCSV}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Download formatted Excel (.xlsx) report"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-2 bg-white px-4 pt-3 rounded-xl shadow-xs print:hidden">
        {[
          { id: 'closing_stock', label: '1. Closing Stock & Despatch Statement' },
          { id: 'daily', label: '2. Daily Report' },
          { id: 'range', label: '3. Weekly / Date Range' },
          { id: 'customer', label: '4. Customer-wise Report' },
          { id: 'pending', label: '5. Pending Task Report' },
          { id: 'complete', label: '6. Complete Work Overview' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-3 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-900 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4 text-xs print:hidden">
        {activeTab === 'closing_stock' && (
          <>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
              />
            </div>

            <div className="flex-1 min-w-[200px] max-w-xs">
              <label className="block font-bold text-slate-700 mb-1">Customer *:</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[180px] max-w-xs">
              <label className="block font-bold text-slate-700 mb-1">Part No / Item:</label>
              <select
                value={selectedPartNo}
                onChange={(e) => setSelectedPartNo(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
              >
                <option value="ALL">All Parts (Consolidated)</option>
                {closingStockReport?.partsList?.map((p, idx) => (
                  <option key={idx} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-32">
              <label className="block font-bold text-slate-700 mb-1" title="Leave blank for auto-calculated prior balance">
                Opening Stock:
              </label>
              <input
                type="number"
                placeholder="Auto"
                value={openingStockInput}
                onChange={(e) => setOpeningStockInput(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="self-end pb-0.5">
              <button
                onClick={exportClosingStockExcel}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel (.xlsx)</span>
              </button>
            </div>
          </>
        )}

        {activeTab === 'daily' && (
          <div>
            <label className="block font-bold text-slate-700 mb-1">Select Report Date:</label>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
            />
          </div>
        )}

        {['range', 'customer', 'complete'].includes(activeTab) && (
          <>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </>
        )}

        {['customer', 'pending', 'complete'].includes(activeTab) && (
          <div className="flex-1 max-w-xs">
            <label className="block font-bold text-slate-700 mb-1">
              {activeTab === 'customer' ? 'Select Customer *:' : 'Filter Customer (Optional):'}
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
            >
              {activeTab !== 'customer' && <option value="">All Customers</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ================= REPORT TAB 0: CLOSING STOCK & DESPATCH STATEMENT ================= */}
      {activeTab === 'closing_stock' && (
        <div className="space-y-6">
          {/* Top Quick Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 bg-amber-100 text-amber-900 rounded-lg text-xs font-black">
                CLOSING STOCK STATEMENT
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {closingStockReport?.monthLabel || selectedMonth} •{' '}
                {closingStockReport?.customer?.company_name || 'All Customers'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={printCurrentReport}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Statement</span>
              </button>
              <button
                onClick={exportClosingStockExcel}
                className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Statement Paper Preview (Matching the User's Image Form) */}
          <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-300 shadow-xl max-w-5xl mx-auto text-black font-sans print:p-0 print:border-none print:shadow-none print:max-w-none">
            {/* Header: CLOSING STOCK AS ON & PART NO */}
            <div className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-xs sm:text-sm font-black tracking-wide uppercase text-black">
                    CLOSING STOCK AS ON
                  </span>
                  <div className="border-2 border-black px-3 py-0.5 rounded-md font-black text-xs sm:text-sm bg-white text-black min-w-[70px] text-center">
                    {closingStockReport?.monthLabel || selectedMonth}
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-700 print:text-black">
                  <span>Customer: </span>
                  <span className="font-black text-black">
                    {closingStockReport?.customer?.company_name || 'General Stock'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs sm:text-sm font-black uppercase text-black">
                  PART NO
                </span>
                <span className="text-xs sm:text-sm font-black text-black tracking-wide">
                  {closingStockReport?.selectedPart || selectedPartNo || 'ALL PARTS'}
                </span>
              </div>
            </div>

            {/* Main Ledger Table with Strict Dark Borders */}
            <div className="overflow-x-auto border-2 border-black">
              <table className="w-full text-[11px] leading-tight border-collapse bg-white">
                <thead>
                  <tr className="border-b-2 border-black bg-slate-100 text-black font-black uppercase text-center text-[10px] sm:text-[11px]">
                    <th className="border-r border-black p-2 font-black w-[16%]">
                      {closingStockReport?.customer?.company_name?.toLowerCase().includes('lgb') ||
                      closingStockReport?.customer?.company_name?.toLowerCase().includes('l.g.b')
                        ? 'LGB DC/J.O NO'
                        : 'CUSTOMER DC/J.O NO'}
                    </th>
                    <th className="border-r border-black p-2 font-black w-[12%]">
                      RECEIVED DATE
                    </th>
                    <th className="border-r border-black p-2 font-black w-[10%]">
                      RECEIVED QTY
                    </th>
                    <th className="border-r border-black p-2 font-black w-[17%]">
                      OUR DESPATCHED DC NO
                    </th>
                    <th className="border-r border-black p-2 font-black w-[12%]">
                      DESPATCHED DATE
                    </th>
                    <th className="border-r border-black p-2 font-black w-[10%]">
                      DESPATCHED QTY
                    </th>
                    <th className="border-r border-black p-2 font-black w-[10%]">
                      PENDING QTY
                    </th>
                    <th className="p-2 font-black w-[13%]">
                      REMARKS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/70">
                  {/* Data Rows */}
                  {(closingStockReport?.tableRows || []).map((row, idx) => (
                    <tr
                      key={idx}
                      className={`text-black font-semibold hover:bg-slate-50/50 ${
                        row.isOpening ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="border-r border-black px-2 py-1.5 font-bold whitespace-nowrap">
                        {row.cust_dc_no}
                      </td>
                      <td className="border-r border-black px-2 py-1.5 text-center whitespace-nowrap">
                        {row.received_date ? formatDotDate(row.received_date) : ''}
                      </td>
                      <td className="border-r border-black px-2 py-1.5 text-center font-bold font-mono">
                        {row.received_qty !== '' && row.received_qty !== undefined ? row.received_qty : ''}
                      </td>
                      <td className="border-r border-black px-2 py-1.5 font-bold font-mono whitespace-nowrap">
                        {row.despatch_dc_no}
                      </td>
                      <td className="border-r border-black px-2 py-1.5 text-center whitespace-nowrap">
                        {row.despatch_date ? formatDotDate(row.despatch_date) : ''}
                      </td>
                      <td className="border-r border-black px-2 py-1.5 text-center font-bold font-mono">
                        {row.despatch_qty !== '' && row.despatch_qty !== undefined ? row.despatch_qty : ''}
                      </td>
                      <td className="border-r border-black px-2 py-1.5 text-center font-bold font-mono">
                        {row.pending_qty !== '' && row.pending_qty !== undefined ? row.pending_qty : ''}
                      </td>
                      <td className="px-2 py-1.5 text-left text-[10px]">
                        {row.remarks || ''}
                      </td>
                    </tr>
                  ))}

                  {/* Empty Spacer Rows to Fill the Page (Like the Physical Template) */}
                  {Array.from({
                    length: Math.max(0, 10 - (closingStockReport?.tableRows?.length || 0))
                  }).map((_, emptyIdx) => (
                    <tr key={`empty-${emptyIdx}`} className="h-6">
                      <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                      <td className="border-r border-black px-2 py-1.5">&nbsp;</td>
                      <td className="px-2 py-1.5">&nbsp;</td>
                    </tr>
                  ))}

                  {/* Totals Row */}
                  <tr className="border-t-2 border-black font-black text-black bg-slate-50">
                    <td className="border-r border-black px-2 py-1.5 text-right font-black" colSpan={2}>
                      &nbsp;
                    </td>
                    <td className="border-r border-black px-2 py-1.5 text-center font-black font-mono text-xs">
                      {closingStockReport?.summary?.totalReceivedMonth || 0}
                    </td>
                    <td className="border-r border-black px-2 py-1.5 text-right font-black" colSpan={2}>
                      &nbsp;
                    </td>
                    <td className="border-r border-black px-2 py-1.5 text-center font-black font-mono text-xs">
                      {closingStockReport?.summary?.totalDespatchedMonth || 0}
                    </td>
                    <td className="border-r border-black px-2 py-1.5" colSpan={2}>
                      &nbsp;
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Reconciliation Summary Box (Exact Form as in Photo) */}
            <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-2">
              {/* Left Box: 3-Row Bordered Grid */}
              <div className="border-2 border-black w-full max-w-xs text-xs font-black">
                <div className="flex justify-between items-center border-b border-black px-3 py-1 bg-white">
                  <span className="uppercase text-black">OPENING STOCK</span>
                  <span className="font-mono text-black font-black">
                    {closingStockReport?.summary?.openingStock || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-black px-3 py-1 bg-white">
                  <span className="uppercase text-black">RECEIPT FOR THIS MONTH</span>
                  <span className="font-mono text-black font-black">
                    {closingStockReport?.summary?.totalReceivedMonth || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center px-3 py-1 bg-slate-100">
                  <span className="uppercase text-black">TOTAL STOCKS</span>
                  <span className="font-mono text-black font-black">
                    {closingStockReport?.summary?.totalStocks || 0}
                  </span>
                </div>
              </div>

              {/* Right Side: Total Stock Available */}
              <div className="flex items-center space-x-6 pr-6">
                <span className="text-sm sm:text-base font-black text-black uppercase tracking-wide">
                  Total stock available
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-black">
                  {closingStockReport?.summary?.totalStockAvailable || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= REPORT TAB 1: DAILY ================= */}
      {activeTab === 'daily' && dailyData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inward Entries</span>
              <div className="text-xl font-black text-slate-800 mt-1">
                {dailyData.summary.totalInwardEntries}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inward Quantity</span>
              <div className="text-xl font-black text-blue-700 mt-1">
                {dailyData.summary.totalInwardQty}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inward Value</span>
              <div className="text-xl font-black text-slate-800 mt-1 font-mono">
                ₹{dailyData.summary.totalInwardVal.toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Outward Challans</span>
              <div className="text-xl font-black text-slate-800 mt-1">
                {dailyData.summary.totalOutwardChallans}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Outward Quantity</span>
              <div className="text-xl font-black text-amber-700 mt-1">
                {dailyData.summary.totalOutwardQty}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Outward Value</span>
              <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
                ₹{dailyData.summary.totalOutwardVal.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Customer Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b font-bold text-slate-800 text-xs uppercase tracking-wider">
              Customer-Wise Breakdown for {dailyData.date}
            </div>
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100/60 text-slate-600 font-bold border-b">
                <tr>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3 text-right">Inward Qty</th>
                  <th className="p-3 text-right">Inward Value</th>
                  <th className="p-3 text-right">Outward Qty</th>
                  <th className="p-3 text-right">Outward Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyData.customerBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-slate-400">
                      No customer activity recorded on this date.
                    </td>
                  </tr>
                ) : (
                  dailyData.customerBreakdown.map((c, i) => (
                    <tr key={i}>
                      <td className="p-3 font-bold text-slate-800">{c.company_name}</td>
                      <td className="p-3 text-right font-semibold text-blue-700">{c.inward_qty}</td>
                      <td className="p-3 text-right font-mono">₹{c.inward_val.toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-amber-700">{c.outward_qty}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">₹{c.outward_val.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= REPORT TAB 2: DATE RANGE / WEEKLY ================= */}
      {activeTab === 'range' && rangeData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inward Entries</span>
              <div className="text-xl font-black text-slate-800 mt-1">{rangeData.summary.totalInwardEntries}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inward Quantity</span>
              <div className="text-xl font-black text-blue-700 mt-1">{rangeData.summary.totalInwardQty}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Inward Value</span>
              <div className="text-xl font-black text-slate-800 mt-1 font-mono">₹{rangeData.summary.totalInwardVal.toFixed(2)}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Outward Challans</span>
              <div className="text-xl font-black text-slate-800 mt-1">{rangeData.summary.totalOutwardChallans}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Outward Quantity</span>
              <div className="text-xl font-black text-amber-700 mt-1">{rangeData.summary.totalOutwardQty}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Outward Value</span>
              <div className="text-xl font-black text-emerald-700 mt-1 font-mono">₹{rangeData.summary.totalOutwardVal.toFixed(2)}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b font-bold text-slate-800 text-xs uppercase tracking-wider">
              Customer Activity Between {rangeData.startDate} and {rangeData.endDate}
            </div>
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100/60 text-slate-600 font-bold border-b">
                <tr>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3 text-right">Inward Qty</th>
                  <th className="p-3 text-right">Inward Value</th>
                  <th className="p-3 text-right">Outward Qty</th>
                  <th className="p-3 text-right">Outward Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rangeData.customerBreakdown.map((c, i) => (
                  <tr key={i}>
                    <td className="p-3 font-bold text-slate-800">{c.company_name}</td>
                    <td className="p-3 text-right font-semibold text-blue-700">{c.inward_qty}</td>
                    <td className="p-3 text-right font-mono">₹{c.inward_val.toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold text-amber-700">{c.outward_qty}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">₹{c.outward_val.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= REPORT TAB 3: CUSTOMER-WISE REPORT ================= */}
      {activeTab === 'customer' && customerReport && (
        <div className="space-y-6">
          {/* Customer Profile Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase font-mono">
                {customerReport.customer.customer_code || 'CUST'}
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {customerReport.customer.company_name}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {customerReport.customer.address}
              </p>
              <div className="text-xs font-mono font-bold text-blue-800 mt-1">
                GSTIN: {customerReport.customer.gst_no}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 block uppercase">Total Inward Qty</span>
                <span className="text-lg font-black text-blue-900">{customerReport.summary.totalInwardQty}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Inward Value</span>
                <span className="text-lg font-black text-slate-900 font-mono">₹{customerReport.summary.totalInwardVal.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 block uppercase">Outward Value</span>
                <span className="text-lg font-black text-amber-900 font-mono">₹{customerReport.summary.totalOutwardVal.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <span className="text-[10px] font-bold text-purple-700 block uppercase">Pending Qty</span>
                <span className="text-lg font-black text-purple-900">{customerReport.summary.totalPendingQty}</span>
              </div>
            </div>
          </div>

          {/* Pending Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-amber-50 border-b border-amber-200 font-bold text-amber-950 text-xs uppercase tracking-wider flex items-center justify-between">
              <span>Unfinished / Pending Consignments In Factory</span>
              <span className="text-xs font-mono">{customerReport.pendingItems.length} items pending</span>
            </div>
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 font-bold text-slate-700 border-b">
                <tr>
                  <th className="p-3">Inward #</th>
                  <th className="p-3">Inward Date</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3 text-center">Inward Qty</th>
                  <th className="p-3 text-center">Outward Qty</th>
                  <th className="p-3 text-center">Pending Qty</th>
                  <th className="p-3 text-right">Unit Rate</th>
                  <th className="p-3 text-right">Pending Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerReport.pendingItems.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-6 text-center text-slate-400">
                      No pending items for this customer.
                    </td>
                  </tr>
                ) : (
                  customerReport.pendingItems.map((p, i) => (
                    <tr key={i}>
                      <td className="p-3 font-mono font-bold text-blue-700">{p.inward_no}</td>
                      <td className="p-3 text-slate-600">{new Date(p.inward_date).toLocaleDateString('en-IN')}</td>
                      <td className="p-3 font-bold text-slate-800">{p.item_description}</td>
                      <td className="p-3 text-center">{p.original_qty} {p.uom}</td>
                      <td className="p-3 text-center text-slate-500">{p.outward_qty} {p.uom}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-black rounded text-xs">
                          {p.pending_qty} {p.uom}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">₹{p.unit_value}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">₹{p.pending_value.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= REPORT TAB 4: PENDING TASK REPORT ================= */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-amber-500 text-slate-950 font-black text-sm flex items-center justify-between">
            <span>FACTORY PENDING TASK REPORT</span>
            <span className="text-xs bg-black/10 px-2.5 py-1 rounded-md font-mono">
              {pendingTasks.filter((t) => t.status === 'PENDING').length} ACTIVE PENDING TASKS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-3.5">Inward #</th>
                  <th className="p-3.5">Customer Name</th>
                  <th className="p-3.5">Item Description</th>
                  <th className="p-3.5 text-center">Inward Qty</th>
                  <th className="p-3.5 text-center">Outward Qty</th>
                  <th className="p-3.5 text-center">Pending Qty</th>
                  <th className="p-3.5 text-right">Pending Value (₹)</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingTasks.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-400">
                      No pending tasks found. All material cleared!
                    </td>
                  </tr>
                ) : (
                  pendingTasks.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-mono font-bold text-blue-700">{t.inward_no}</td>
                      <td className="p-3.5 font-bold text-slate-900">{t.customer_name}</td>
                      <td className="p-3.5 font-bold text-slate-800">{t.item_description}</td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {t.inward_qty} {t.uom}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-slate-500">
                        {t.outward_qty} {t.uom}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                          {t.pending_qty} {t.uom}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                        ₹{parseFloat(t.pending_value).toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black ${
                            t.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {t.status}
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

      {/* ================= REPORT TAB 5: COMPLETE WORK OVERVIEW ================= */}
      {activeTab === 'complete' && completeWork && (
        <div className="space-y-6">
          {/* Worker activity cards */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              Worker Performance & Accountability Log
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {completeWork.workerActivity.map((w, i) => (
                <div key={i} className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{w.worker_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase font-bold">
                      {w.role}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <div>Inward Entries: <strong>{w.inward_entries}</strong></div>
                    <div>Outward Challans: <strong>{w.outward_entries}</strong></div>
                    <div>Total Units Handled: <strong>{w.total_units_handled}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
