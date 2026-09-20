import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Plus, Activity, RefreshCw, Hash, FileText, DollarSign, TrendingUp, Archive } from 'lucide-react';
import { apiRequest } from '../../api/client';

export const InventoryPage: React.FC = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [valuation, setValuation] = useState<{ totalProducts: number; totalUnits: number; totalCostValuation: number; totalRetailValuation: number; estimatedMargin: number } | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [productId, setProductId] = useState('');
  const [type, setType] = useState('ADJUSTMENT');
  const [quantityChange, setQuantityChange] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [movementsRes, lowStockRes, valuationRes, productsRes] = await Promise.all([
        apiRequest('/inventory/movements'),
        apiRequest('/inventory/low-stock'),
        apiRequest('/inventory/valuation'),
        apiRequest('/products?limit=150'),
      ]);
      setMovements(movementsRes.data || []);
      setLowStock(lowStockRes.data || []);
      if (valuationRes.success && valuationRes.data) setValuation(valuationRes.data);
      if (productsRes.success && productsRes.data) setProducts(productsRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await apiRequest('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          type,
          quantityChange: Number(quantityChange),
          notes
        })
      });
      setProductId('');
      setQuantityChange('');
      setNotes('');
      setType('ADJUSTMENT');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-600" />
          Inventory Management
        </h1>
        <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Stock Valuation KPI Metrics */}
      {valuation && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Stock Units</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>{valuation.totalUnits.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{valuation.totalProducts} catalog products</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cost Valuation</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-primary)' }}>₹{valuation.totalCostValuation.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invested inventory capital</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Retail Potential Value</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--color-success)' }}>₹{valuation.totalRetailValuation.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gross revenue potential</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estimated Margin</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>₹{valuation.estimatedMargin.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Projected gross profit</div>
          </div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="glass-panel p-6 border-l-4 border-amber-500 bg-amber-50/30">
          <h2 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Low Stock Alerts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStock.map((item: any) => (
              <div key={item._id} className="bg-white p-4 rounded-lg shadow-sm border border-amber-100 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                  <p className="text-xs text-gray-400 mt-1">ID: {item._id}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">{item.stockQuantity}</p>
                  <p className="text-xs text-gray-500">Threshold: {item.lowStockThreshold}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            Adjust Stock
          </h2>
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Product *</label>
              <select
                required
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className="w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
              >
                <option value="">-- Choose product to adjust --</option>
                {products.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.sku}) — Current Stock: {p.stockQuantity ?? 0}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="ADJUSTMENT">General Adjustment</option>
                <option value="DAMAGE">Damage</option>
                <option value="EXPIRY">Expiry</option>
                <option value="CORRECTION">Correction</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Change (+ or -)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Activity className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  required
                  step="1"
                  value={quantityChange}
                  onChange={e => setQuantityChange(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. -5 or 10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 pt-2 pointer-events-none">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Reason for adjustment..."
                  rows={3}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Update Stock
            </button>
          </form>
        </div>

        <div className="glass-panel p-0 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Movements</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Product</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium text-right">Change</th>
                  <th className="p-4 font-medium text-right">New Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading movements...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No recent inventory movements
                    </td>
                  </tr>
                ) : (
                  movements.map((movement: any) => (
                    <tr key={movement._id} className="hover:bg-gray-50">
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(movement.createdAt).toLocaleDateString()}<br/>
                        <span className="text-xs">{new Date(movement.createdAt).toLocaleTimeString()}</span>
                      </td>
                      <td className="p-4 text-sm text-gray-900">
                        {movement.productId?.name || 'Unknown'}<br/>
                        <span className="text-xs text-gray-500">{movement.productId?.sku || ''}</span>
                      </td>
                      <td className="p-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          movement.type === 'SALE' ? 'bg-blue-100 text-blue-700' :
                          movement.type === 'RESTOCK' ? 'bg-green-100 text-green-700' :
                          movement.type === 'DAMAGE' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {movement.type}
                        </span>
                      </td>
                      <td className={`p-4 text-sm font-bold text-right ${movement.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-900 text-right">
                        {movement.newStock}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
