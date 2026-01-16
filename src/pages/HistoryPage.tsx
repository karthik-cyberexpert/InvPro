import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0 }}>Audit Trail (Transaction History)</h1>
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
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Qty Change</th>
              <th>Reference</th>
              <th>User</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                   <div className="spinner"></div>
                   Loading history...
                </div>
              </td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>No transaction history found</td></tr>
            ) : (
              history.map((entry) => (
                <tr key={entry.ledger_id} style={{ opacity: entry.is_already_reversed ? 0.6 : 1 }}>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(entry.transaction_date).toLocaleString()}</td>
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
                        {entry.created_by.charAt(0).toUpperCase()}
                      </div>
                      {entry.created_by}
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
    </div>
  );
};

export default HistoryPage;
