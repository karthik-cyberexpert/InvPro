import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';

interface StockSummary {
  stock_id: string; // Added stock_id for selection
  project: string;
  supplier_name: string;
  invoice: string;
  po_no: string;
  part_name: string;
  description: string;
  uom: string;
  location: string;
  available_quantity: number;
  min_quantity: number;
}

interface Stats {
  total_unique_items: number;
  total_received: number;
  total_issued: number;
  low_stock_count: number;
}

interface InventoryResponse {
  items: StockSummary[];
  total_count: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [inventory, setInventory] = useState<StockSummary[]>([]);
  const [allStocks, setAllStocks] = useState<StockSummary[]>([]); // For dropdown
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  
  // Existing Stock Form State
  const [selectedStockId, setSelectedStockId] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [stockSearch, setStockSearch] = useState(""); // For filtering the dropdown/list

  // New Stock Form State
  const [newStock, setNewStock] = useState({
    project: "",
    supplier_name: "",
    invoice: "",
    po_no: "",
    part_name: "",
    description: "",
    uom: "",
    location: "",
    quantity: "",
    remarks: ""
  });

  // Derived state for existing stock selection
  const filteredStocks = allStocks.filter(item => 
    item.part_name.toLowerCase().includes(stockSearch.toLowerCase()) ||
    item.project.toLowerCase().includes(stockSearch.toLowerCase())
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchStats = async () => {
    try {
      const s = await invoke<Stats>("get_stats");
      setStats(s);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await invoke<InventoryResponse>("get_inventory", { 
        page, 
        pageSize: 10,
        search: debouncedSearch || null 
      });
      setInventory(response.items);
      setTotalPages(Math.ceil(response.total_count / 10));
      setTotalCount(response.total_count);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStocks = async () => {
    try {
      // Use max int to fetch all for dropdown
      const response = await invoke<InventoryResponse>("get_inventory", { 
        page: 1, 
        pageSize: 1000, 
        search: "" 
      });
      setAllStocks(response.items);
    } catch (err) {
      console.error("Failed to fetch all stocks for dropdown", err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchAllStocks();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [page, debouncedSearch]);

  const handleAddStock = async () => {
    try {
      if (modalMode === 'EXISTING') {
        if (!selectedStockId || !addQuantity) {
          toast.error("Please select a stock and enter quantity");
          return;
        }
        await invoke("add_stock_quantity", {
          stockId: selectedStockId,
          quantity: parseFloat(addQuantity),
          user: user || "admin"
        });
        toast.success("Stock quantity added successfully");
      } else {
        // Validate new stock
        if (!newStock.project || !newStock.part_name || !newStock.quantity) {
          toast.error("Please fill in all required fields (Project, Part Name, Quantity)");
          return;
        }
        await invoke("add_stock_entry", {
          row: {
            ...newStock,
            quantity: parseFloat(newStock.quantity),
            rec_date: new Date().toISOString()
          },
          user: user || "admin"
        });
        toast.success("New stock created successfully");
      }
      
      setIsModalOpen(false);
      fetchInventory();
      fetchAllStocks();
      fetchStats();
      // Reset forms
      setSelectedStockId("");
      setAddQuantity("");
      setNewStock({
        project: "",
        supplier_name: "",
        invoice: "",
        po_no: "",
        part_name: "",
        description: "",
        uom: "",
        location: "",
        quantity: "",
        remarks: ""
      });
    } catch (err: any) {
      toast.error("Failed to add stock: " + err.toString());
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ margin: 0 }}>Inventory Overview</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search inventory..." 
              style={{ paddingLeft: '40px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Add Stock
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Unique Items</div>
          <div className="stat-value">{stats?.total_unique_items || 0}</div>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '10px', borderRadius: '12px', marginTop: 'auto' }}>
            <Package size={24} color="var(--primary)" />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Received</div>
          <div className="stat-value" style={{ background: 'linear-gradient(135deg, #fff, var(--success))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {stats?.total_received || 0}
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '12px', marginTop: 'auto' }}>
            <ArrowUpRight size={24} color="var(--success)" />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Issued</div>
          <div className="stat-value" style={{ background: 'linear-gradient(135deg, #fff, var(--danger))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {stats?.total_issued || 0}
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '12px', marginTop: 'auto' }}>
            <ArrowDownRight size={24} color="var(--danger)" />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Low Stock</div>
          <div className="stat-value" style={{ background: 'linear-gradient(135deg, #fff, var(--warning))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {stats?.low_stock_count || 0}
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '12px', marginTop: 'auto' }}>
            <AlertTriangle size={24} color="var(--warning)" />
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Description</th>
              <th>Project</th>
              <th>Supplier</th>
              <th>Invoice</th>
              <th>Qty</th>
              <th>UOM</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                   <div className="spinner"></div>
                   Loading inventory data...
                </div>
              </td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>No inventory items match your search</td></tr>
            ) : (
              inventory.map((item, idx) => {
                const isLow = item.available_quantity < item.min_quantity;
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: 'var(--text-white)' }}>{item.part_name}</td>
                    <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{item.description}</td>
                    <td>{item.project}</td>
                    <td>{item.supplier_name}</td>
                    <td>{item.invoice}</td>
                    <td style={{ fontWeight: 700, color: isLow ? 'var(--danger)' : 'var(--primary)' }}>{item.available_quantity}</td>
                    <td>{item.uom}</td>
                    <td>{item.location}</td>
                    <td>
                      {isLow ? (
                        <span style={{ 
                          background: 'rgba(239, 68, 68, 0.1)', 
                          color: 'var(--danger)', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: 700,
                          border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>LOW STOCK</span>
                      ) : (
                        <span style={{ 
                          background: 'rgba(16, 185, 129, 0.1)', 
                          color: 'var(--success)', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.7rem', 
                          fontWeight: 700,
                          border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}>NORMAL</span>
                      )}
                    </td>
                  </tr>
                );
              })
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
            Showing page <span style={{ color: 'var(--text-white)' }}>{page}</span> of {totalPages || 1} ({totalCount} items)
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px' }}
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={18} /> Previous
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px' }}
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Stock Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div className="card" style={{ 
            width: '650px', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            background: '#13111C',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Add Stock</h2>
                <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Manage inventory levels or create new items
                </p>
              </div>
              <button 
                onClick={closeModal}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              marginBottom: '2rem', 
              background: 'rgba(20, 20, 30, 0.5)', 
              padding: '0.5rem', 
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <button 
                className="btn"
                style={{ 
                  flex: 1, 
                  justifyContent: 'center',
                  background: modalMode === 'EXISTING' ? 'var(--primary)' : 'transparent',
                  color: modalMode === 'EXISTING' ? 'white' : 'var(--text-muted)',
                  border: 'none'
                }}
                onClick={() => setModalMode('EXISTING')}
              >
                Existing Stock
              </button>
              <button 
                className="btn"
                style={{ 
                  flex: 1, 
                  justifyContent: 'center',
                  background: modalMode === 'NEW' ? 'var(--primary)' : 'transparent',
                  color: modalMode === 'NEW' ? 'white' : 'var(--text-muted)',
                  border: 'none'
                }}
                onClick={() => setModalMode('NEW')}
              >
                New Stock
              </button>
            </div>

            {modalMode === 'EXISTING' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                 <div className="form-group">
                   <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                     Search & Select Stock
                   </label>
                   <div style={{ position: 'relative' }}>
                     <Search size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                     <input 
                       type="text" 
                       className="form-control" 
                       placeholder="Filter by Name, Project or Description..."
                       style={{ 
                         paddingLeft: '44px', 
                         marginBottom: '1rem',
                         background: 'rgba(0, 0, 0, 0.3)',
                         borderColor: 'rgba(255, 255, 255, 0.1)'
                       }}
                       value={stockSearch}
                       onChange={(e) => {
                         setStockSearch(e.target.value);
                         setSelectedStockId(""); // Clear selection on search
                       }}
                     />
                     <div style={{ 
                       border: '1px solid rgba(255, 255, 255, 0.1)', 
                       borderRadius: '12px', 
                       maxHeight: '250px', 
                       overflowY: 'auto',
                       background: 'rgba(0, 0, 0, 0.2)' 
                     }}>
                       {filteredStocks.length === 0 ? (
                         <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                           No matching stocks found
                         </div>
                       ) : (
                         filteredStocks
                           .filter(stock => selectedStockId ? stock.stock_id === selectedStockId : true)
                           .map(stock => (
                           <div 
                             key={stock.stock_id} 
                             onClick={() => setSelectedStockId(selectedStockId === stock.stock_id ? "" : stock.stock_id)}
                             style={{
                               padding: '12px 16px',
                               cursor: 'pointer',
                               background: selectedStockId === stock.stock_id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                               borderLeft: selectedStockId === stock.stock_id ? '3px solid var(--primary)' : '3px solid transparent',
                               borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                               transition: 'all 0.2s'
                             }}
                             className="stock-item-hover"
                           >
                             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                               <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{stock.part_name}</span>
                               <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{stock.available_quantity} {stock.uom}</span>
                             </div>
                             <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                               <span>{stock.project}</span>
                               <span style={{ fontStyle: 'italic', opacity: 0.7 }}>{stock.description}</span>
                             </div>
                           </div>
                         ))
                       )}
                     </div>
                   </div>
                 </div>
                 <div className="form-group">
                   <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                     Quantity to Add
                   </label>
                   <input 
                     type="number" 
                     className="form-control"
                     value={addQuantity}
                     onChange={(e) => setAddQuantity(e.target.value)}
                     placeholder="0.00"
                     style={{ background: 'rgba(0, 0, 0, 0.3)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
                   />
                 </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                 {[
                   { label: 'Project', key: 'project' },
                   { label: 'Supplier Name', key: 'supplier_name' },
                   { label: 'Invoice', key: 'invoice' },
                   { label: 'PO Number', key: 'po_no' },
                   { label: 'Part Name', key: 'part_name' },
                   { label: 'Description', key: 'description' },
                   { label: 'UOM', key: 'uom' },
                   { label: 'Location', key: 'location' },
                   { label: 'Quantity', key: 'quantity', type: 'number' },
                   { label: 'Remarks', key: 'remarks' }
                 ].map((field) => (
                   <div className="form-group" key={field.key}>
                     <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
                       {field.label}
                     </label>
                     <input 
                       type={field.type || 'text'}
                       className="form-control" 
                       value={(newStock as any)[field.key]} 
                       onChange={e => setNewStock({...newStock, [field.key]: e.target.value})}
                       style={{ background: 'rgba(0, 0, 0, 0.3)', borderColor: 'rgba(255, 255, 255, 0.1)', fontSize: '0.9rem' }}
                     />
                   </div>
                 ))}
              </div>
            )}

            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <button 
                className="btn" 
                onClick={closeModal}
                style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAddStock}
                style={{ padding: '0.6rem 2rem', fontWeight: 600 }}
              >
                {modalMode === 'EXISTING' ? 'Update Stock' : 'Create Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
