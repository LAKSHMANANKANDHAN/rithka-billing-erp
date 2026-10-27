import React, { useRef } from 'react';
import { Printer, Download, ArrowLeft } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import logoSb from '../../assets/logo_sb.png';
import logoTuv from '../../assets/logo_tuv_iso9001.png';

export default function ChallanPrintPreview({ challan, items, company, onBack }) {
  const printRef = useRef(null);

  // Trigger browser print dialog
  const handlePrint = () => {
    window.print();
  };

  // Generate and download PDF
  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DC_${String(challan.challan_no || 'Challan').replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Could not generate PDF directly. Please click "Print" and select "Save as PDF".');
    }
  };

  const companyName = company?.company_name || 'Shri.Bharathi & Co.,';
  const companyGst = company?.gst_no || '33AATPY9887A1ZU';
  const companyPhone = company?.phone || '95433 49900';
  const companyAddress = company?.address || 'Site No : 9, S.F No : 208/1B , Anjugam Nagar, Ambigai Nagar Road,\nChinnavedampatti (PO), Coimbatore - 641 049';
  const companyEmail = company?.email || 'a.yuvarajan@gmail.com';

  const taxRate = parseFloat(challan.tax_rate ?? 9.0);
  const subtotal = parseFloat(challan.subtotal || 0);
  const taxAmount = parseFloat(challan.tax_amount || 0);
  const grandTotal = parseFloat(challan.grand_total || 0);

  // Minimum rows to visually replicate the Excel sheet grid height
  const minRows = 8;
  const emptyRowsCount = Math.max(0, minRows - (items?.length || 0));

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Challan List</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Challan (A4)</span>
          </button>
        </div>
      </div>

      {/* A4 PRINT CONTAINER - EXACT EXCEL REPRODUCTION */}
      <div className="flex justify-center bg-slate-200/60 p-2 sm:p-6 print:p-0 print:bg-transparent">
        <div
          ref={printRef}
          className="challan-print-sheet bg-white text-black w-full max-w-[210mm] min-h-[297mm] p-6 shadow-xl border border-slate-300 print:border-none print:shadow-none print:p-0 print:max-w-none text-xs leading-tight font-sans"
          style={{ boxSizing: 'border-box' }}
        >
          {/* ============================================================== */}
          {/* HEADER: BRIGHT YELLOW CONTAINER WITH TWO CORNER LOGOS          */}
          {/* ============================================================== */}
          <div className="border-2 border-black bg-[#ffeb3b] p-3 text-center relative mb-0">
            {/* Top row: GST on left, Phone on right */}
            <div className="flex justify-between items-center text-[11px] font-black tracking-tight mb-1">
              <span>GST : {companyGst}</span>
              <span>{companyPhone}</span>
            </div>

            {/* Left Brand Logo (SB Logo from Excel) */}
            <div className="absolute left-3 top-8 flex items-center justify-center">
              <img
                src={logoSb}
                alt="SB Logo"
                className="h-14 w-auto object-contain drop-shadow-xs"
              />
            </div>

            {/* Right ISO Certification Badge (TÜV SÜD ISO 9001 from Excel) */}
            <div className="absolute right-3 top-8 flex items-center justify-center">
              <img
                src={logoTuv}
                alt="TÜV SÜD ISO 9001"
                className="h-14 w-auto object-contain drop-shadow-xs"
              />
            </div>

            {/* Center Content */}
            <div className="px-16">
              <h1 className="text-sm sm:text-base font-black uppercase tracking-wider text-black">
                DELIVERY&nbsp;&nbsp;CHALLAN Cum Packing Note
              </h1>
              <h2 className="text-lg sm:text-xl font-black text-black mt-1 tracking-tight font-serif">
                {companyName}
              </h2>
              <p className="text-[10px] font-bold text-black whitespace-pre-line mt-1 max-w-lg mx-auto leading-snug">
                {companyAddress}
              </p>
              <p className="text-[10px] font-bold text-black mt-0.5">
                Email: {companyEmail}
              </p>
            </div>
          </div>

          {/* ============================================================== */}
          {/* TWO-COLUMN PARTY DETAILS & DC METADATA BOX                    */}
          {/* ============================================================== */}
          <div className="grid grid-cols-12 border-x-2 border-b-2 border-black text-[11px]">
            {/* Left Column: Customer "To" Box (Cols 1 to 7) */}
            <div className="col-span-7 border-r-2 border-black p-2 flex flex-col justify-between min-h-[145px]">
              <div>
                <div className="inline-block bg-[#ffeb3b] px-3 py-0.5 font-black border border-black text-[10px] mb-1.5 uppercase">
                  To
                </div>
                <div className="font-black text-sm text-black mt-0.5">
                  {challan.customer_name}
                </div>
                <div className="font-semibold text-black whitespace-pre-line mt-1 text-[11px] leading-snug">
                  {challan.customer_address}
                </div>
              </div>
              <div className="mt-2 pt-1 border-t border-black/30 font-bold text-[11px]">
                GSTIN: <span className="font-mono font-black">{challan.customer_gst}</span>
              </div>
            </div>

            {/* Right Column: DC & Reference Details (Cols 8 to 12) */}
            <div className="col-span-5 p-0 text-[11px]">
              <table className="w-full h-full border-collapse">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-1 font-black bg-[#ffeb3b]/50 w-28 border-r border-black">
                      DC No
                    </td>
                    <td className="p-1 text-center font-bold w-3 border-r border-black">:</td>
                    <td className="p-1 font-mono font-black text-black">
                      {challan.challan_no}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/30 border-r border-black">
                      Date
                    </td>
                    <td className="p-1 text-center font-bold border-r border-black">:</td>
                    <td className="p-1 font-semibold">
                      {challan.challan_date}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/30 border-r border-black">
                      P.O. No
                    </td>
                    <td className="p-1 text-center font-bold border-r border-black">:</td>
                    <td className="p-1 font-semibold">
                      {challan.po_no || '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/30 border-r border-black">
                      P.O. Date
                    </td>
                    <td className="p-1 text-center font-bold border-r border-black">:</td>
                    <td className="p-1 font-semibold">
                      {challan.po_date || '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/30 border-r border-black">
                      Cust DC No
                    </td>
                    <td className="p-1 text-center font-bold border-r border-black">:</td>
                    <td className="p-1 font-semibold">
                      {challan.cust_dc_no || '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/30 border-r border-black">
                      Cust DC Date
                    </td>
                    <td className="p-1 text-center font-bold border-r border-black">:</td>
                    <td className="p-1 font-semibold">
                      {challan.cust_dc_date || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 font-bold bg-[#ffeb3b]/30 border-r border-black">
                      Vehicle No
                    </td>
                    <td className="p-1 text-center font-bold border-r border-black">:</td>
                    <td className="p-1 font-mono font-black uppercase">
                      {challan.vehicle_no || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ============================================================== */}
          {/* ITEMS TABLE (EXACT 6 EXCEL COLUMNS & BRIGHT YELLOW HEADER)    */}
          {/* ============================================================== */}
          <div className="border-x-2 border-b-2 border-black">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#ffeb3b] text-black font-black border-b-2 border-black text-center">
                  <th className="p-1.5 w-10 border-r-2 border-black">Sl.No</th>
                  <th className="p-1.5 w-24 border-r-2 border-black">Your Ref. No</th>
                  <th className="p-1.5 text-left border-r-2 border-black px-3">
                    DESCRIPTION OF GOODS
                  </th>
                  <th className="p-1.5 w-20 border-r-2 border-black">Quantity</th>
                  <th className="p-1.5 w-16 border-r-2 border-black">UOM</th>
                  <th className="p-1.5 w-28">Kind of Package</th>
                </tr>
              </thead>
              <tbody>
                {items && items.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-black/30">
                    <td className="p-2 text-center font-bold border-r-2 border-black">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="p-2 text-center font-mono border-r-2 border-black">
                      {item.your_ref_no || '-'}
                    </td>
                    <td className="p-2 font-bold uppercase border-r-2 border-black px-3">
                      {item.item_description}
                      {item.unit_value > 0 && (
                        <span className="font-normal font-mono text-[10px] text-slate-600 ml-2">
                          (@ ₹{parseFloat(item.unit_value).toFixed(2)} = ₹{parseFloat(item.total_value).toFixed(2)})
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center font-black text-sm border-r-2 border-black">
                      {item.quantity}
                    </td>
                    <td className="p-2 text-center font-bold border-r-2 border-black">
                      {item.uom}
                    </td>
                    <td className="p-2 text-center font-semibold">
                      {item.package_type || 'Loose'}
                    </td>
                  </tr>
                ))}

                {/* Empty rows to replicate Excel height and clean page proportions */}
                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-black/15 h-7">
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td></td>
                  </tr>
                ))}

                {/* ========================================================== */}
                {/* VALUE OF GOODS, TAX & GRAND TOTAL (Excel Row 30 & 31)      */}
                {/* ========================================================== */}
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan="2" className="border-r-2 border-black bg-slate-50/50"></td>
                  <td className="p-2 border-r-2 border-black text-right pr-4 font-black">
                    Value of Goods
                  </td>
                  <td colSpan="3" className="p-2 text-right font-mono font-black text-xs pr-4">
                    ₹{subtotal.toFixed(2)}
                  </td>
                </tr>

                <tr className="border-t border-black font-bold">
                  <td colSpan="2" className="border-r-2 border-black bg-slate-50/50"></td>
                  <td className="p-2 border-r-2 border-black text-right pr-4">
                    Tax @ {taxRate}% (GST)
                  </td>
                  <td colSpan="3" className="p-2 text-right font-mono font-bold text-xs pr-4">
                    ₹{taxAmount.toFixed(2)}
                  </td>
                </tr>

                <tr className="border-t-2 border-black font-black bg-[#ffeb3b]/40">
                  <td colSpan="2" className="border-r-2 border-black bg-slate-50/50"></td>
                  <td className="p-2.5 border-r-2 border-black text-right pr-4 text-sm font-black uppercase">
                    Grand Total
                  </td>
                  <td colSpan="3" className="p-2.5 text-right font-mono font-black text-sm pr-4 text-black">
                    ₹{grandTotal.toFixed(2)}
                  </td>
                </tr>

                {/* Note Row (Excel Row 34 & 35) */}
                {challan.note && (
                  <tr className="border-t border-black">
                    <td colSpan="2" className="border-r-2 border-black bg-[#ffeb3b]/40 font-bold p-1 text-center">
                      Note
                    </td>
                    <td colSpan="4" className="p-2 font-semibold italic text-black">
                      {challan.note}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ============================================================== */}
          {/* REMARKS ROW (Excel Row 37 & 38)                               */}
          {/* ============================================================== */}
          <div className="border-x-2 border-b-2 border-black flex text-[11px]">
            <div className="bg-[#ffeb3b] px-3 py-1.5 font-black border-r-2 border-black w-28 flex-shrink-0 flex items-center">
              Remarks :
            </div>
            <div className="p-1.5 flex-1 font-semibold text-black">
              {challan.remarks || 'None'}
            </div>
          </div>

          {/* ============================================================== */}
          {/* FOOTER & DUAL SIGNATURE BOX (Excel Row 40-44)                  */}
          {/* ============================================================== */}
          <div className="border-x-2 border-b-2 border-black grid grid-cols-12 text-[11px] min-h-[110px]">
            {/* Left Box: Receiving Authority (Cols A-E in Excel) */}
            <div className="col-span-6 border-r-2 border-black p-3 flex flex-col justify-between">
              <div>
                <p className="font-bold">Received the above goods in good condition</p>
                <p className="font-semibold text-slate-700 text-[10px] mt-0.5">
                  Return the duplicate copy for our records
                </p>
              </div>
              <div className="pt-8 border-t border-dashed border-black/40 font-bold text-center">
                Signature of Receiving Authority
              </div>
            </div>

            {/* Right Box: Company Authorized Signatory (Bright Yellow in Excel) */}
            <div className="col-span-6 bg-[#ffeb3b] p-3 flex flex-col justify-between">
              <div>
                <span className="font-bold text-black">For </span>
                <span className="font-black text-black font-serif text-xs">{companyName}</span>
              </div>

              <div className="pt-8 font-black text-black text-center">
                Authorised Signatory
              </div>
            </div>
          </div>

          {/* Reference notice footer (hidden in print) */}
          <div className="mt-2 text-[9px] text-slate-400 text-center print:hidden">
            A4 Print Optimized • Linked to Inward Consignment {challan.inward_no} • Generated on {new Date().toLocaleDateString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
}
