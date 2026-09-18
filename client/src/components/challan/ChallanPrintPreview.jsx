import React, { useRef } from 'react';
import { Printer, Download, ArrowLeft, Building2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
      pdf.save(`Challan_${challan.challan_no.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Could not generate PDF. You can also click "Print" and choose "Save as PDF".');
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

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden during printing) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Challan List</span>
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition"
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
          {/* HEADER SECTION (Yellow Header background matching reference image) */}
          <div className="border-2 border-black bg-[#ffeb3b] p-3 text-center relative mb-0">
            {/* Top Row: GST on left, Phone on right */}
            <div className="flex justify-between items-start text-[11px] font-bold">
              <span>GST : {companyGst}</span>
              <span>{companyPhone}</span>
            </div>

            {/* Left Certification Logo Badge Simulation */}
            <div className="absolute left-3 top-7 w-9 h-10 border border-black/40 bg-white flex flex-col items-center justify-center p-0.5 shadow-2xs">
              <span className="text-[7px] font-black text-blue-800">ISO</span>
              <span className="text-[6px] font-bold text-slate-700">9001</span>
            </div>

            {/* Right TUV Badge Simulation */}
            <div className="absolute right-3 top-7 w-9 h-10 border border-blue-900 bg-blue-700 text-white flex flex-col items-center justify-center p-0.5 shadow-2xs rounded-sm">
              <span className="text-[7px] font-black tracking-tighter">TUV</span>
              <span className="text-[5px] font-bold">SUD</span>
            </div>

            {/* Main Title & Company Name */}
            <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-black mt-0.5">
              DELIVERY CHALLAN Cum Packing Note
            </h1>
            <h2 className="text-lg sm:text-xl font-black text-black mt-0.5 tracking-tight font-serif">
              {companyName}
            </h2>

            {/* Address & Email */}
            <p className="text-[10px] font-bold text-black whitespace-pre-line mt-0.5 max-w-lg mx-auto">
              {companyAddress}
            </p>
            <p className="text-[10px] font-bold text-black mt-0.5">
              Email: {companyEmail}
            </p>
          </div>

          {/* TWO-COLUMN PARTY & CHALLAN METADATA SECTION */}
          <div className="grid grid-cols-12 border-x-2 border-b-2 border-black text-[11px]">
            {/* LEFT COLUMN: Customer "To" Box (Cols 1 to 7) */}
            <div className="col-span-7 border-r-2 border-black p-2 flex flex-col justify-between min-h-[140px]">
              <div>
                <div className="inline-block bg-[#ffeb3b] px-2 py-0.5 font-black border border-black text-[10px] mb-1">
                  To
                </div>
                <div className="font-black text-sm text-black mt-0.5">
                  {challan.customer_name}
                </div>
                <div className="font-semibold text-black whitespace-pre-line mt-1 text-[11px]">
                  {challan.customer_address}
                </div>
              </div>
              <div className="mt-2 pt-1 border-t border-black/20 font-bold">
                GSTIN: <span className="font-mono font-black">{challan.customer_gst}</span>
              </div>
            </div>

            {/* RIGHT COLUMN: DC & Reference Details (Cols 8 to 12) */}
            <div className="col-span-5 p-0 text-[11px]">
              <table className="w-full h-full border-collapse">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="p-1 font-black bg-[#ffeb3b]/60 w-28 border-r border-black">
                      DC No
                    </td>
                    <td className="p-1 font-mono font-black text-black">
                      : {challan.challan_no}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/40 border-r border-black">
                      Date
                    </td>
                    <td className="p-1 font-semibold">
                      : {challan.challan_date}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/40 border-r border-black">
                      P.O. No
                    </td>
                    <td className="p-1 font-semibold">
                      : {challan.po_no || '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/40 border-r border-black">
                      P.O. Date
                    </td>
                    <td className="p-1 font-semibold">
                      : {challan.po_date || '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/40 border-r border-black">
                      Cust DC No
                    </td>
                    <td className="p-1 font-semibold">
                      : {challan.cust_dc_no || '-'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="p-1 font-bold bg-[#ffeb3b]/40 border-r border-black">
                      Cust DC Date
                    </td>
                    <td className="p-1 font-semibold">
                      : {challan.cust_dc_date || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 font-bold bg-[#ffeb3b]/40 border-r border-black">
                      Vehicle No
                    </td>
                    <td className="p-1 font-mono font-black uppercase">
                      : {challan.vehicle_no || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ITEM TABLE (Yellow Header with distinct borders matching reference) */}
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
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-black/30">
                    <td className="p-2 text-center font-bold border-r-2 border-black">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="p-2 text-center font-mono border-r-2 border-black">
                      {item.your_ref_no || '-'}
                    </td>
                    <td className="p-2 font-bold uppercase border-r-2 border-black px-3">
                      {item.item_description}
                      <span className="font-normal font-mono text-[10px] text-slate-600 ml-2">
                        (@ ₹{parseFloat(item.unit_value).toFixed(2)} = ₹{parseFloat(item.total_value).toFixed(2)})
                      </span>
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

                {/* Empty rows filler to match reference sheet height */}
                {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-black/10 h-7">
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td className="border-r-2 border-black"></td>
                    <td></td>
                  </tr>
                ))}

                {/* VALUE OF GOODS, TAX & GRAND TOTAL ROWS INSIDE TABLE GRID */}
                <tr className="border-t-2 border-black font-bold">
                  <td colSpan="2" className="border-r-2 border-black bg-slate-50"></td>
                  <td className="p-2 border-r-2 border-black text-right pr-4 font-black">
                    Value of Goods
                  </td>
                  <td colSpan="3" className="p-2 text-right font-mono font-black text-xs pr-4">
                    ₹{subtotal.toFixed(2)}
                  </td>
                </tr>

                <tr className="border-t border-black font-bold">
                  <td colSpan="2" className="border-r-2 border-black bg-slate-50"></td>
                  <td className="p-2 border-r-2 border-black text-right pr-4">
                    Tax @ {taxRate}% (GST)
                  </td>
                  <td colSpan="3" className="p-2 text-right font-mono font-bold text-xs pr-4">
                    ₹{taxAmount.toFixed(2)}
                  </td>
                </tr>

                <tr className="border-t-2 border-black font-black bg-[#ffeb3b]/40">
                  <td colSpan="2" className="border-r-2 border-black bg-slate-50"></td>
                  <td className="p-2.5 border-r-2 border-black text-right pr-4 text-sm font-black uppercase">
                    Grand Total
                  </td>
                  <td colSpan="3" className="p-2.5 text-right font-mono font-black text-sm pr-4 text-black">
                    ₹{grandTotal.toFixed(2)}
                  </td>
                </tr>

                {/* Note Row inside goods table matching reference */}
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

          {/* REMARKS ROW (Yellow header label on left, text on right) */}
          <div className="border-x-2 border-b-2 border-black flex text-[11px]">
            <div className="bg-[#ffeb3b] px-3 py-1.5 font-black border-r-2 border-black w-28 flex-shrink-0 flex items-center">
              Remarks :
            </div>
            <div className="p-1.5 flex-1 font-semibold text-black">
              {challan.remarks || 'None'}
            </div>
          </div>

          {/* FOOTER & SIGNATURE SECTION (Exact matching of reference image) */}
          <div className="border-x-2 border-b-2 border-black grid grid-cols-12 text-[11px] min-h-[110px]">
            {/* Left box: Receiving Authority */}
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

            {/* Right box: Company Signature (Bright Yellow background matching reference!) */}
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

          {/* Reference notice footer */}
          <div className="mt-2 text-[9px] text-slate-400 text-center print:hidden">
            A4 Print Optimized • Linked to Inward Consignment {challan.inward_no} • Generated on {new Date().toLocaleDateString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
}
