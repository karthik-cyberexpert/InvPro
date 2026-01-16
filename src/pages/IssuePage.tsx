import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { Search, PackageSearch } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';
import { jsPDF } from "jspdf";

interface StockSummary {
  stock_id: string;
  part_name: string;
  project: string;
  supplier_name: string;
  available_quantity: number;
  uom: string;
  description: string;
  location: string;
}

interface InventoryResponse {
  items: StockSummary[];
  total_count: number;
}

const IssuePage: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StockSummary[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockSummary | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedSearch.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await invoke<InventoryResponse>("get_inventory", { 
          page: 1, 
          pageSize: 50, // Fetch more results for search
          search: debouncedSearch 
        });
        setSearchResults(response.items);
      } catch (err) {
        console.error(err);
      }
    };
    fetchResults();
  }, [debouncedSearch]);


  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;
    if (quantity <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }
    if (quantity > selectedStock.available_quantity) {
      toast.error("Insufficient stock available");
      return;
    }

    setLoading(true);

    try {
      await invoke("issue_stock", {
        stockId: selectedStock.stock_id,
        quantity,
        reference,
        reason,
        user
      });
      toast.success("Stock issued successfully!");
      generateIssueSlip();
      
      // Reset form
      setSelectedStock(null);
      setQuantity(0);
      setReference("");
      setReason("");
      setSearch("");
      setSearchResults([]);
    } catch (err) {
      toast.error(err as string);
    } finally {
      setLoading(false);
    }
  };

  const generateIssueSlip = () => {
    if (!selectedStock) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("STOCK ISSUE SLIP", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, 35);
    doc.text(`Reference: ${reference}`, 20, 42);
    
    doc.line(20, 48, 190, 48);
    
    doc.setFontSize(12);
    doc.text("Part Details:", 20, 60);
    doc.setFontSize(10);
    doc.text(`Part Name: ${selectedStock.part_name}`, 30, 70);
    doc.text(`Description: ${selectedStock.description}`, 30, 77);
    doc.text(`Project: ${selectedStock.project}`, 30, 84);
    doc.text(`Location: ${selectedStock.location}`, 30, 91);
    doc.text(`Quantity Issued: ${quantity} ${selectedStock.uom}`, 30, 98);
    doc.text(`Reason: ${reason || 'N/A'}`, 30, 105);
    
    doc.line(20, 115, 190, 115);
    
    doc.text("Signatures:", 20, 135);
    doc.text("____________________", 20, 155);
    doc.text("Issued By", 20, 160);
    
    doc.text("____________________", 130, 155);
    doc.text("Received By", 130, 160);
    
    doc.save(`Issue_Slip_${reference || Date.now()}.pdf`);
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1>Issue Stock</h1>
      
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '8px' }}>
             <Search size={20} color="var(--primary)" />
           </div>
           1. Find Stock
        </h3>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
          <div style={{ flexGrow: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search by part name, project or description..." 
              style={{ paddingLeft: '40px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // No need for onKeyDown, search is automatic (debounced)
            />
          </div>
        </div>

        {searchResults.length > 0 && !selectedStock && (
          <div style={{ 
            marginTop: '1.5rem',
            maxHeight: '350px', 
            overflowY: 'auto', 
            border: '1px solid var(--glass-border)', 
            borderRadius: '12px', 
            background: 'rgba(15, 23, 42, 0.3)' 
          }}>
            {searchResults.map((item) => (
              <div 
                key={item.stock_id} 
                onClick={() => setSelectedStock(item)}
                style={{ 
                  padding: '1rem 1.5rem', 
                  cursor: 'pointer', 
                  borderBottom: '1px solid var(--glass-border)',
                  transition: 'var(--transition)',
                  color: 'var(--text-muted)'
                }}
                className="hover-row"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--text-white)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--text-white)', fontSize: '1.05rem' }}>{item.part_name}</strong>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.available_quantity} {item.uom}</span>
                </div>
                <div style={{ fontSize: '0.9rem', marginBottom: '2px', fontStyle: 'italic', opacity: 0.8 }}>
                    {item.description}
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', gap: '15px' }}>
                    <span>Project: <span style={{ color: 'var(--text-white)' }}>{item.project}</span></span>
                    <span>Location: <span style={{ color: 'var(--text-white)' }}>{item.location}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedStock && (
          <div style={{ 
            backgroundColor: 'rgba(99, 102, 241, 0.1)', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            marginTop: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>SELECTED ITEM</div>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-white)' }}>{selectedStock.part_name}</strong>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {selectedStock.description}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Project: <span style={{ color: 'var(--text-white)' }}>{selectedStock.project}</span> | 
                Location: <span style={{ color: 'var(--text-white)' }}>{selectedStock.location}</span> |
                Available: <span style={{ color: 'var(--success)' }}>{selectedStock.available_quantity} {selectedStock.uom}</span>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setSelectedStock(null)}>Change</button>
          </div>
        )}
      </div>

      {selectedStock && (
        <div className="card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '8px', borderRadius: '8px' }}>
              <PackageSearch size={20} color="var(--secondary)" />
            </div>
            2. Issue Details
          </h3>
          <form onSubmit={handleIssue}>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Quantity to Issue</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder={`Max ${selectedStock.available_quantity}`}
                  value={quantity || ''} 
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required 
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Reference (Job No / Request ID)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. JOB-2024-001"
                  value={reference} 
                  onChange={(e) => setReference(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label>Remarks / Purpose</label>
              <textarea 
                className="form-control" 
                rows={3} 
                placeholder="Enter any additional details..."
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
              disabled={loading}
            >
              {loading ? 'Processing...' : (
                <>
                  <PackageSearch size={20} /> Complete Issue & Download Slip
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>

  );
};

export default IssuePage;
