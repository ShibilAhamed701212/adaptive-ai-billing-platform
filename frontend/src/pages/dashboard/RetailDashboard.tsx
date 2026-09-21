import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Package, TrendingUp, Users, PauseCircle, ShoppingCart } from 'lucide-react';

interface RetailDashboardProps {
  onNavigate: (path: string) => void;
}

export const RetailDashboard: React.FC<RetailDashboardProps> = ({ onNavigate }) => {
  const { organization, user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{organization?.name || 'Retail Dashboard'}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Welcome back, {user?.name}. Here is your live point-of-sale and inventory overview.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Today's Sales</span>
            <TrendingUp size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">₹12,450</div>
          <p className="kpi-desc">Total cash & card transactions today</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Transactions</span>
            <ShoppingCart size={18} color="var(--color-success)" />
          </div>
          <div className="kpi-value">45</div>
          <p className="kpi-desc">Completed cart checkouts today</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Low Stock Alerts</span>
            <Package size={18} color="var(--color-danger)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>3</div>
          <p className="kpi-desc">Products below minimum threshold</p>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Customers</span>
            <Users size={18} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">12</div>
          <p className="kpi-desc">Registered loyalty members</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Top Selling Products</h3>
        <p className="section-lead">High-velocity items in your store</p>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Units Sold</th>
                <th>Revenue</th>
                <th>Current Stock</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basmati Rice 5kg</td>
                <td className="num-mono">RICE-01</td>
                <td>12</td>
                <td>₹5,400</td>
                <td><span className="badge badge-paid">45</span></td>
              </tr>
              <tr>
                <td>Filter Coffee 500g</td>
                <td className="num-mono">COF-01</td>
                <td>8</td>
                <td>₹2,000</td>
                <td><span className="badge badge-paid">60</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
