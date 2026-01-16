import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PackagePlus, 
  History, 
  FileUp, 
  LogOut,
  Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';

const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const navItems = [
    { to: "/", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { to: "/issue", icon: <PackagePlus size={20} />, label: "Purchase/Issue" },
    { to: "/history", icon: <History size={20} />, label: "Audit Trail" },
    { to: "/upload", icon: <FileUp size={20} />, label: "Bulk Upload" },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
            <Package size={24} color="white" />
          </div>
          <h2 style={{ 
            margin: 0, 
            fontSize: '1.5rem', 
            background: 'linear-gradient(to right, #fff, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 800
          }}>InvPro</h2>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
          INDUSTRIAL INVENTORY V1.0
        </div>
      </div>

      <nav style={{ flexGrow: 1, padding: '1.5rem 0' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ 
        padding: '1.5rem', 
        borderTop: '1px solid var(--glass-border)',
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ 
          marginBottom: '1.25rem', 
          fontSize: '0.85rem', 
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
          <span>Logged in as: <strong style={{ color: 'var(--text-white)' }}>{user}</strong></span>
        </div>
        <button 
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
