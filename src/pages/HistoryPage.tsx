import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { RotateCcw, Search, Download, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';
import * as XLSX from 'xlsx';

interface LedgerEntry {
  ledger_id: number;
  stock_id: string;
  transaction_type: string;
  quantity_change: number;
  transaction_date: string;
  reference: string;
  optional_reason: string;
  created_by: string;
  is_already_reversed?: boolean;
  part_name?: string;
  description?: string;
}

interface HistoryResponse {
  items: LedgerEntry[];
  total_count: number;
}

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState<number | null>(null);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportStatus, setExportStatus] = useState("All");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await invoke<HistoryResponse>("get_history", { 
        page, 
        pageSize: 10,
        search: debouncedSearch || null
      });
      setHistory(response.items);
      setTotalPages(Math.ceil(response.total_count / 10));
      setTotalCount(response.total_count);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, debouncedSearch]);

  const handleReverse = async (ledgerId: number) => {
    if (!window.confirm("Are you sure you want to reverse this transaction? This will create a counter-entry.")) return;
    
    setReversing(ledgerId);
    try {
      await invoke("reverse_transaction", { ledgerId, user });
      toast.success("Transaction reversed successfully!");
      fetchHistory();
    } catch (err) {
      toast.error("" + err);
    } finally {
      setReversing(null);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
     e.preventDefault();
     setExporting(true);
     try {
       const data = await invoke<LedgerEntry[]>("get_export_history", {
         dateFrom: dateFrom || null,
         dateTo: dateTo || null,
         status: exportStatus
       });

       if (data.length === 0) {
         toast.error("No records found for the selected criteria");
         setExporting(false);
         return;
       }

       // Format for Excel
       const excelData = data.map(item => ({
         "Transaction Date": new Date(item.transaction_date).toLocaleString(),
         "Part Name": item.part_name || "N/A",
         "Description": item.description || "N/A",
         "Type": item.transaction_type,
         "Quantity Change": item.quantity_change,
         "Reference": item.reference,
         "Reason": item.optional_reason || "",
         "User": item.created_by,
         "Reversed": item.is_already_reversed ? "Yes" : "No"
       }));

       const ws = XLSX.utils.json_to_sheet(excelData);
       const wb = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(wb, ws, "Audit Trail");
       
       const filename = `Audit_Trail_${new Date().toISOString().split('T')[0]}.xlsx`;
       XLSX.writeFile(wb, filename);
       
       toast.success("Export downloaded successfully!");
       setShowExportModal(false);
     } catch (err) {
       console.error(err);
       toast.error("Export failed");
     } finally {
       setExporting(false);
     }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0 }}>Audit Trail (Transaction History)</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search history..." 
                style={{ paddingLeft: '40px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setShowExportModal(true)}
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Part Details</th>
              <th>Type</th>
              <th>Qty Change</th>
              <th>Reference</th>
              <th>User</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                   <div className="spinner"></div>
                   Loading history...
                </div>
              </td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>No transaction history found</td></tr>
            ) : (
              history.map((entry) => (
                <tr key={entry.ledger_id} style={{ opacity: entry.is_already_reversed ? 0.6 : 1 }}>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(entry.transaction_date).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{entry.part_name || 'Unknown Part'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.description || '-'}</div>
                  </td>
                  <td>
                    <span style={{ 
                      background: entry.transaction_type === 'IN' ? 'rgba(16, 185, 129, 0.1)' : entry.transaction_type === 'OUT' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: entry.transaction_type === 'IN' ? 'var(--success)' : entry.transaction_type === 'OUT' ? 'var(--danger)' : 'var(--warning)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: `1px solid ${entry.transaction_type === 'IN' ? 'rgba(16, 185, 129, 0.2)' : entry.transaction_type === 'OUT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                    }}>
                      {entry.transaction_type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: entry.quantity_change > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {entry.quantity_change > 0 ? `+${entry.quantity_change}` : entry.quantity_change}
                  </td>
                  <td>
                    <div style={{ color: 'var(--text-white)', fontWeight: 500 }}>{entry.reference}</div>
                    {entry.optional_reason && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{entry.optional_reason}</div>}
                    {entry.is_already_reversed && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase' }}>
                        (Vioded / Reversed)
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                        {(entry.created_by || "?").charAt(0).toUpperCase()}
                      </div>
                      {entry.created_by || "Unknown"}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {entry.transaction_type !== 'REVERSAL' && (
                       <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', opacity: entry.is_already_reversed ? 0.5 : 1 }}
                        onClick={() => handleReverse(entry.ledger_id)}
                        disabled={reversing === entry.ledger_id || entry.is_already_reversed}
                      >
                        <RotateCcw size={14} /> {reversing === entry.ledger_id ? 'Processing...' : entry.is_already_reversed ? 'Reversed' : 'Reverse'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '1.25rem 1.5rem',
          background: 'rgba(30, 41, 59, 0.4)',
          borderTop: '1px solid var(--glass-border)'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Showing page <span style={{ color: 'var(--text-white)' }}>{page}</span> of {totalPages || 1} ({totalCount} entries)
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px' }}
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px' }}
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      
      {/* Export Modal */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '16px',
            width: '450px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={24} color="var(--success)" /> Export Audit Trail
              </h2>
              <button 
                onClick={() => setShowExportModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleExport}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Date Range (Optional)</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>to</span>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Transaction Type</label>
                <select 
                  className="form-control" 
                  value={exportStatus}
                  onChange={(e) => setExportStatus(e.target.value)}
                >
                  <option value="All" style={{ background: '#1e293b', color: '#fff' }}>All Transactions</option>
                  <option value="IN" style={{ background: '#1e293b', color: '#fff' }}>IN (Received)</option>
                  <option value="OUT" style={{ background: '#1e293b', color: '#fff' }}>OUT (Issued)</option>
                  <option value="REVERSAL" style={{ background: '#1e293b', color: '#fff' }}>REVERSAL</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={exporting}
                >
                  {exporting ? 'Generating...' : <><Download size={18} /> Download Excel</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
