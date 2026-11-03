import React, { useRef, useState } from 'react';
import { Printer, Download, ArrowLeft, Edit3, Copy, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import logoSb from '../../assets/logo_sb.png';
import logoTuv from '../../assets/logo_tuv_iso9001.png';

// Date formatter in dd-mm-yyyy
export function formatDateDDMMYYYY(val) {
  if (!val || val === '-' || val === 'null' || val === 'undefined') return '-';
  const str = String(val).trim();
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, d, m, y] = ddmmyyyyMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }
  const yyyymmddMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyymmddMatch) {
    const [, y, m, d] = yyyymmddMatch;
    return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return str;
}

export default function ChallanPrintPreview({ challan, items, company, onBack, onEdit }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'original', 'duplicate', 'extra'
  const [isDownloading, setIsDownloading] = useState(false);
  const printContainerRef = useRef(null);
  const originalCopyRef = useRef(null);

  // Trigger browser print dialog for 3 copies (A5 sheet)
  const handlePrint = () => {
    window.print();
  };

  // Generate and download single-page A5 PDF for "(ORIGINAL FOR RECIPIENT)" alone in low storage
  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      // Find the "ORIGINAL FOR RECIPIENT" page element specifically
      let targetElement = originalCopyRef.current;
      if (!targetElement && printContainerRef.current) {
        targetElement = printContainerRef.current.querySelector('[data-copy-id="original"]');
      }
      if (!targetElement && printContainerRef.current) {
        targetElement = printContainerRef.current.querySelector('.challan-copy-container');
      }
      if (!targetElement) {
        throw new Error('Original Challan copy element not found');
      }

      // If original copy is currently hidden by active tab, make it temporarily visible for capture
      const wasHidden = targetElement.classList.contains('hidden');
      if (wasHidden) {
        targetElement.classList.remove('hidden');
        targetElement.style.display = 'block';
      }

      // Wait for any images (logos) to be fully loaded
      const images = targetElement.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 300);
          });
        })
      );

      // Render canvas with html2canvas-pro (native support for Tailwind CSS v4)
      const canvas = await html2canvas(targetElement, {
        scale: 2, // High clarity for sharp text
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Restore hidden class if it was modified
      if (wasHidden) {
        targetElement.classList.add('hidden');
        targetElement.style.display = '';
      }

      // Compress canvas to high-efficiency JPEG (0.78 quality) for very low storage (~90 KB - 140 KB)
      const imgData = canvas.toDataURL('image/jpeg', 0.78);

      // Create single page A5 PDF (148mm x 210mm)
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a5',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 148 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 210 mm

      const marginX = 5;
      const contentWidth = pdfWidth - marginX * 2; // 138 mm
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      const marginY = Math.max(4, Math.min(8, (pdfHeight - contentHeight) / 2));

      pdf.addImage(imgData, 'JPEG', marginX, marginY, contentWidth, contentHeight, undefined, 'FAST');

      // Filename formatted as: date , challan number , company name
      const cleanFileNamePart = (str) =>
        String(str || '')
          .trim()
          .replace(/[/\\?%*:|"<>]/g, '-')
          .replace(/\s+/g, ' ');

      const dateStr = cleanFileNamePart(formatDateDDMMYYYY(challan.challan_date));
      const challanStr = cleanFileNamePart(challan.challan_no || 'DC');
      const companyStr = cleanFileNamePart(challan.customer_name || companyName);

      const fileName = `${dateStr} , ${challanStr} , ${companyStr}.pdf`;

      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert(`Could not generate PDF directly (${err.message || 'Error'}). Please click "Print" and select "Save as PDF".`);
    } finally {
      setIsDownloading(false);
    }
  };

  const companyName = company?.company_name || 'Shri.Bharathi & Co.,';
  const companyGst = company?.gst_no || '33AATPY9887A1ZU';
  const companyPhone = company?.phone || '95433 49900';
  const companyAddress = company?.address || 'Site No : 9, S.F No : 208/1B , Anjugam Nagar, Ambigai Nagar Road,\nChinnavedampatti (PO), Coimbatore - 641 049';
  const companyEmail = company?.email || 'a.yuvarajan@gmail.com';

  // Minimum rows for clean A5 vertical fit without overflowing
  const minRows = 4;
  const emptyRowsCount = Math.max(0, minRows - (items?.length || 0));

  // The 3 official copies required: Original, Duplicate, Extra
  const COPIES = [
    { id: 'original', label: '(ORIGINAL FOR RECIPIENT)', title: 'Original for Recipient' },
    { id: 'duplicate', label: '(DUPLICATE FOR TRANSPORTER)', title: 'Duplicate for Transporter' },
    { id: 'extra', label: '(EXTRA COPY)', title: 'Extra Copy' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Challan List</span>
          </button>

          {onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit This Challan</span>
            </button>
          )}
        </div>

        {/* Copy Selector Tabs for on-screen inspection */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All 3 Copies (Print View)
          </button>
          {COPIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === c.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.id.charAt(0).toUpperCase() + c.id.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
            title="Download Original Copy as low-size A5 PDF"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isDownloading ? 'Generating PDF...' : 'Download PDF (Original)'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Challan (3 Copies - A5)</span>
          </button>
        </div>
      </div>

      {/* A5 PRINT CONTAINER - 3 COPIES, EXACT 1-PAGE FIT EACH */}
      <div
        ref={printContainerRef}
        className="flex flex-col items-center bg-slate-200/60 p-2 sm:p-6 print:p-0 print:bg-transparent space-y-6 print:space-y-0"
      >
        {COPIES.map((copy, copyIdx) => {
          const isVisibleOnScreen = activeTab === 'all' || activeTab === copy.id;

          return (
            <div
              key={copy.id}
              ref={copy.id === 'original' ? originalCopyRef : null}
              data-copy-id={copy.id}
              className={`challan-a5-page challan-copy-container bg-white text-black w-full max-w-[138mm] p-3 shadow-xl border border-slate-300 print:border-none print:shadow-none print:p-0 print:max-w-[138mm] text-[10px] leading-tight font-sans ${
                isVisibleOnScreen ? 'block' : 'hidden print:block'
              }`}
              style={{ boxSizing: 'border-box' }}
            >
              {/* ============================================================== */}
              {/* TOP RIGHT CORNER COPY IDENTIFIER (ORIGINAL / DUPLICATE / EXTRA) */}
              {/* ============================================================== */}
              <div className="flex justify-end items-center pr-1 pb-1">
                <span className="text-[10px] sm:text-[11px] font-black tracking-wide text-black uppercase">
                  {copy.label}
                </span>
              </div>

              {/* ============================================================== */}
              {/* MAIN CHALLAN BOX                                               */}
              {/* ============================================================== */}
              <div className="border-2 border-black bg-white">
                {/* ------------------------------------------------------------ */}
                {/* 1. HEADER: BRIGHT YELLOW CONTAINER WITH TWO LOGOS             */}
                {/* ------------------------------------------------------------ */}
                <div className="bg-[#ffeb3b] border-b-2 border-black p-2 text-center relative">
                  {/* Top line: GST on left, Phone on right */}
                  <div className="flex justify-between items-center text-[9.5px] font-black tracking-tight mb-0.5 px-0.5">
                    <span>GST : {companyGst}</span>
                    <span>{companyPhone}</span>
                  </div>

                  {/* Left Brand Logo */}
                  <div className="absolute left-2 top-6 flex items-center justify-center">
                    <img
                      src={logoSb}
                      alt="SB Logo"
                      className="h-10 sm:h-11 w-auto object-contain drop-shadow-xs"
                    />
                  </div>

                  {/* Right ISO Certification Badge */}
                  <div className="absolute right-2 top-6 flex items-center justify-center">
                    <img
                      src={logoTuv}
                      alt="TÜV SÜD ISO 9001"
                      className="h-10 sm:h-11 w-auto object-contain drop-shadow-xs"
                    />
                  </div>

                  {/* Center Content */}
                  <div className="px-12 sm:px-14">
                    <h1 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-black">
                      DELIVERY&nbsp;&nbsp;CHALLAN Cum Packing Note
                    </h1>
                    <h2 className="text-sm sm:text-base font-black text-black mt-0.5 tracking-tight font-serif leading-none">
                      {companyName}
                    </h2>
                    <p className="text-[8.5px] font-bold text-black whitespace-pre-line mt-0.5 max-w-sm mx-auto leading-tight">
                      {companyAddress}
                    </p>
                    <p className="text-[8.5px] font-bold text-black mt-0.5">
                      Email: {companyEmail}
                    </p>
                  </div>
                </div>

                {/* ------------------------------------------------------------ */}
                {/* 2. TWO-COLUMN PARTY DETAILS & DC METADATA BOX (WHITE BG)     */}
                {/* ------------------------------------------------------------ */}
                <div className="grid grid-cols-12 border-b-2 border-black text-[9.5px] bg-white">
                  {/* Left Column: Customer "To" Box (White BG, No Yellow) */}
                  <div className="col-span-7 border-r-2 border-black p-1.5 flex flex-col justify-between bg-white min-h-[95px]">
                    <div>
                      <div className="inline-block bg-white px-2 py-0.5 font-black border border-black text-[8.5px] mb-1 uppercase tracking-wider">
                        To
                      </div>
                      <div className="font-black text-[11px] text-black leading-tight">
                        {challan.customer_name}
                      </div>
                      <div className="font-medium text-black whitespace-pre-line mt-0.5 text-[9px] leading-tight">
                        {challan.customer_address}
                      </div>
                    </div>
                    <div className="mt-1 pt-1 border-t border-black/30 font-bold text-[9px]">
                      GSTIN: <span className="font-mono font-black">{challan.customer_gst}</span>
                    </div>
                  </div>

                  {/* Right Column: DC & Reference Details (White BG, No Yellow) */}
                  <div className="col-span-5 p-0 text-[9.5px] bg-white">
                    <table className="w-full h-full border-collapse bg-white">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="py-0.5 px-1.5 font-black bg-white w-24 border-r border-black">
                            DC No
                          </td>
                          <td className="py-0.5 px-1 text-center font-bold w-2 border-r border-black">:</td>
                          <td className="py-0.5 px-1.5 font-mono font-black text-black">
                            {challan.challan_no}
                          </td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-0.5 px-1.5 font-bold bg-white border-r border-black">
                            Date
                          </td>
                          <td className="py-0.5 px-1 text-center font-bold border-r border-black">:</td>
                          <td className="py-0.5 px-1.5 font-semibold">
                            {formatDateDDMMYYYY(challan.challan_date)}
                          </td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-0.5 px-1.5 font-bold bg-white border-r border-black">
                            P.O. No
                          </td>
                          <td className="py-0.5 px-1 text-center font-bold border-r border-black">:</td>
                          <td className="py-0.5 px-1.5 font-semibold">
                            {challan.po_no || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-0.5 px-1.5 font-bold bg-white border-r border-black">
                            P.O. Date
                          </td>
                          <td className="py-0.5 px-1 text-center font-bold border-r border-black">:</td>
                          <td className="py-0.5 px-1.5 font-semibold">
                            {formatDateDDMMYYYY(challan.po_date)}
                          </td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-0.5 px-1.5 font-bold bg-white border-r border-black">
                            Cust DC No
                          </td>
                          <td className="py-0.5 px-1 text-center font-bold border-r border-black">:</td>
                          <td className="py-0.5 px-1.5 font-semibold">
                            {challan.cust_dc_no || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-0.5 px-1.5 font-bold bg-white border-r border-black">
                            Cust DC Date
                          </td>
                          <td className="py-0.5 px-1 text-center font-bold border-r border-black">:</td>
                          <td className="py-0.5 px-1.5 font-semibold">
                            {formatDateDDMMYYYY(challan.cust_dc_date)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-0.5 px-1.5 font-bold bg-white border-r border-black">
                            Vehicle No
                          </td>
                          <td className="py-0.5 px-1 text-center font-bold border-r border-black">:</td>
                          <td className="py-0.5 px-1.5 font-mono font-black uppercase">
                            {challan.vehicle_no || '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ------------------------------------------------------------ */}
                {/* 3. ITEMS TABLE (7 COLUMNS WITH YELLOW HEADER, NO ROW LINES)   */}
                {/* ------------------------------------------------------------ */}
                <div className="border-b-2 border-black bg-white">
                  <table className="w-full border-collapse text-[9.5px]">
                    <thead>
                      <tr className="bg-[#ffeb3b] text-black font-black border-b-2 border-black text-center">
                        <th className="py-1 px-1 w-8 border-r-2 border-black">Sl.No</th>
                        <th className="py-1 px-1 w-20 border-r-2 border-black">Your Ref. No</th>
                        <th className="py-1 px-2 text-left border-r-2 border-black">
                          DESCRIPTION OF GOODS
                        </th>
                        <th className="py-1 px-1 w-14 border-r-2 border-black">Quantity</th>
                        <th className="py-1 px-1 w-12 border-r-2 border-black">UOM</th>
                        <th className="py-1 px-1 w-18 border-r-2 border-black">Kind of Package</th>
                        <th className="py-1 px-2 w-20 text-right pr-2">Value of Goods</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {items && items.map((item, idx) => {
                        const itemTotal = parseFloat(
                          item.total_value != null && !isNaN(item.total_value) && Number(item.total_value) > 0
                            ? item.total_value
                            : (parseFloat(item.quantity || 0) * parseFloat(item.unit_value || 0)) || 0
                        );

                        return (
                          /* NO horizontal lines between items as requested */
                          <tr key={item.id || idx} className="bg-white">
                            <td className="py-1 px-1 text-center font-bold border-r-2 border-black">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-1 px-1 text-center font-mono border-r-2 border-black">
                              {item.your_ref_no || '-'}
                            </td>
                            <td className="py-1 px-2 font-bold uppercase border-r-2 border-black">
                              {item.item_description}
                            </td>
                            <td className="py-1 px-1 text-center font-black text-[11px] border-r-2 border-black">
                              {item.quantity}
                            </td>
                            <td className="py-1 px-1 text-center font-bold border-r-2 border-black">
                              {item.uom}
                            </td>
                            <td className="py-1 px-1 text-center font-semibold border-r-2 border-black">
                              {item.package_type || 'Loose'}
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-bold pr-2">
                              ₹{itemTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Empty rows to maintain table height, NO horizontal divider lines */}
                      {Array.from({ length: emptyRowsCount }).map((_, i) => (
                        <tr key={`empty-${i}`} className="bg-white h-5">
                          <td className="border-r-2 border-black"></td>
                          <td className="border-r-2 border-black"></td>
                          <td className="border-r-2 border-black"></td>
                          <td className="border-r-2 border-black"></td>
                          <td className="border-r-2 border-black"></td>
                          <td className="border-r-2 border-black"></td>
                          <td></td>
                        </tr>
                      ))}

                      {/* Note Row (White Background) */}
                      {challan.note && (
                        <tr className="border-t-2 border-black bg-white">
                          <td colSpan="2" className="border-r-2 border-black bg-white font-bold py-1 px-1 text-center text-[9px]">
                            Note
                          </td>
                          <td colSpan="5" className="py-1 px-2 font-semibold italic text-black bg-white text-[9px]">
                            {challan.note}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ------------------------------------------------------------ */}
                {/* 4. REMARKS ROW (WHITE BACKGROUND, NO YELLOW)                 */}
                {/* ------------------------------------------------------------ */}
                <div className="border-b-2 border-black flex text-[9.5px] bg-white">
                  <div className="bg-white px-2 py-1 font-black border-r-2 border-black w-24 flex-shrink-0 flex items-center">
                    Remarks :
                  </div>
                  <div className="p-1 flex-1 font-semibold text-black bg-white">
                    {challan.remarks || 'None'}
                  </div>
                </div>

                {/* ------------------------------------------------------------ */}
                {/* 5. FOOTER & DUAL SIGNATURE BOX (WHITE BACKGROUND, NO YELLOW) */}
                {/* ------------------------------------------------------------ */}
                <div className="grid grid-cols-12 text-[9.5px] min-h-[75px] bg-white">
                  {/* Left Box: Receiving Authority (White BG) */}
                  <div className="col-span-6 border-r-2 border-black p-2 flex flex-col justify-between bg-white">
                    <div>
                      <p className="font-bold">Received the above goods in good condition</p>
                      <p className="font-semibold text-slate-700 text-[8.5px] mt-0.5">
                        Return the duplicate copy for our records
                      </p>
                    </div>
                    <div className="pt-5 border-t border-dashed border-black/40 font-bold text-center text-[9px]">
                      Signature of Receiving Authority
                    </div>
                  </div>

                  {/* Right Box: Company Authorized Signatory (White BG, No Yellow) */}
                  <div className="col-span-6 bg-white p-2 flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-black">For </span>
                      <span className="font-black text-black font-serif text-[10.5px]">{companyName}</span>
                    </div>

                    <div className="pt-5 font-black text-black text-center text-[9.5px]">
                      Authorised Signatory
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference notice footer (hidden in print) */}
              <div className="mt-1.5 text-[8.5px] text-slate-400 text-center print:hidden">
                A5 Print Optimized ({copy.title}) • Challan #{challan.challan_no}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
