import React, { useState } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { FileUp, Download, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useAuth } from '../AuthContext';

interface ImportRow {
  project: string;
  supplier_name: string;
  invoice: string;
  po_no: string;
  part_name: string;
  description: string;
  quantity: number;
  uom: string;
  location: string;
  remarks?: string;
  rec_date?: string;
}

interface ImportPreview {
  row: ImportRow;
  status: string;
  diff_reason?: string;
  existing_stock_id?: string;
}

const UploadPage: React.FC = () => {
  const { user } = useAuth();
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const downloadTemplate = () => {
    const headers = [
      ["S.No", "Rec Date", "Project", "Supplier Name", "Invoice", "PO No", "Part Name", "Description", "Qty", "UOM", "Location", "Remarks"]
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    
    // Add some styling or formatting if possible via XLSX basics
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Inventory_Import_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstream = evt.target?.result;
        const wb = XLSX.read(bstream, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Map Excel headers to our ImportRow format
        const rows: ImportRow[] = data.map(r => ({
          project: String(r["Project"] || ""),
          supplier_name: String(r["Supplier Name"] || ""),
          invoice: String(r["Invoice"] || ""),
          po_no: String(r["PO No"] || ""),
          part_name: String(r["Part Name"] || ""),
          description: String(r["Description"] || ""),
          quantity: Number(r["Qty"] || 0),
          uom: String(r["UOM"] || ""),
          location: String(r["Location"] || ""),
          remarks: r["Remarks"] ? String(r["Remarks"]) : undefined,
          rec_date: r["Rec Date"] ? String(r["Rec Date"]) : undefined
        })).filter(r => r.part_name && r.quantity > 0);

        // Get preview from backend
        const previewData = await invoke<ImportPreview[]>("bulk_upload_preview", { rows });
        setPreview(previewData);
        toast.success(`Excel parsed: ${rows.length} valid rows found`);
      } catch (err) {
        console.error("Bulk upload preview error:", err);
        toast.error("Error during preview: " + (err as string));
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      await invoke("confirm_bulk_upload", { previews: preview, user });
      toast.success(`Successfully imported ${preview.length} items.`);
      setPreview([]);
    } catch (err) {
      toast.error("Import failed: " + err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0 }}>Bulk Excel Upload</h1>
        <button className="btn btn-secondary" onClick={downloadTemplate} style={{ border: '1px solid var(--glass-border)' }}>
          <Download size={18} /> Download Template
        </button>
      </div>

      {!preview.length && (
        <div className="card" style={{ 
          padding: '5rem 2rem', 
          textAlign: 'center', 
          border: '2px dashed var(--glass-border)', 
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <div style={{ 
            background: 'rgba(99, 102, 241, 0.1)', 
            padding: '24px', 
            borderRadius: '50%',
            marginBottom: '1rem' 
          }}>
            <FileUp size={48} color="var(--primary)" />
          </div>
          <h2 style={{ margin: 0 }}>Select Excel File</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '400px' }}>
            Upload your industrial inventory stock list for automated bulk processing and data validation
          </p>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            id="file-upload" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload}
          />
          <label htmlFor="file-upload" className="btn btn-primary" style={{ display: 'inline-flex', cursor: 'pointer', padding: '14px 40px', borderRadius: '12px' }}>
            {loading ? 'Processing Data...' : 'Browse My Computer'}
          </label>
        </div>
      )}


      {preview.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ 
            padding: '1.5rem 2rem', 
            borderBottom: '1px solid var(--glass-border)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <h3 style={{ margin: 0 }}>Import Preview ({preview.length} rows)</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setPreview([])}>Discard</button>
              <button className="btn btn-primary" onClick={handleConfirmImport} disabled={importing}>
                {importing ? 'Importing...' : 'Confirm & Process Bulk Import'}
              </button>
            </div>
          </div>
          
          <div className="data-table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Part Name</th>
                  <th>Project</th>
                  <th>Invoice</th>
                  <th>Qty</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i}>
                    <td>
                      {p.status === 'MERGED' ? (
                        <span style={{ 
                          background: 'rgba(16, 185, 129, 0.1)', 
                          color: 'var(--success)', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}>
                          <Info size={12} /> MERGE
                        </span>
                      ) : (
                        <span style={{ 
                          background: 'rgba(14, 165, 233, 0.1)', 
                          color: 'var(--accent)', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: '1px solid rgba(14, 165, 233, 0.2)'
                        }}>
                          <Plus size={12} /> NEW ITEM
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-white)' }}>{p.row.part_name}</td>
                    <td>{p.row.project}</td>
                    <td>{p.row.invoice}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.row.quantity}</td>
                    <td>{p.row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>


  );
};

// Helper for the Plus icon which was missing in imports
const Plus = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

export default UploadPage;
