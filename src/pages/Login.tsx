import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = await login(username, password);
    if (success) {
      toast.success(`Welcome back, ${username}!`);
      navigate('/');
    } else {
      toast.error('Invalid username or password');
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      width: '100vw',
      background: 'radial-gradient(circle at top right, #4338ca, #1e1b4b, #0f172a)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative blurry circles */}
      <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '40%', height: '40%', background: 'rgba(99, 102, 241, 0.15)', filter: 'blur(100px)', borderRadius: '50%' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '30%', height: '30%', background: 'rgba(236, 72, 153, 0.1)', filter: 'blur(80px)', borderRadius: '50%' }}></div>

      <div className="card" style={{ 
        width: '420px', 
        padding: '3rem', 
        zIndex: 10, 
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ 
            display: 'inline-flex',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            padding: '12px',
            borderRadius: '16px',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
          }}>
            <Package size={36} color="white" />
          </div>
          <h1 style={{ 
            marginBottom: '0.25rem', 
            fontSize: '2.5rem',
            background: 'linear-gradient(to right, #fff, #94a3b8)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 800
          }}>InvPro</h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.025em' }}>Industrial Inventory Management</p>
        </div>


        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control" 
                style={{ paddingLeft: '40px', background: 'rgba(255, 255, 255, 0.03)' }}
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2.5rem' }}>
            <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                className="form-control" 
                style={{ paddingLeft: '40px', background: 'rgba(255, 255, 255, 0.03)' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', fontSize: '1rem', borderRadius: '12px' }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Authenticating...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          &copy; 2026 Industrial Inventory Systems. All rights reserved.
        </div>
      </div>
    </div>

  );
};

export default Login;
