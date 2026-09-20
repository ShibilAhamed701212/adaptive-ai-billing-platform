import React, { useState, useEffect } from 'react';
import { Play, Square, DollarSign, Clock, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../api/client';

export const ShiftsPage: React.FC = () => {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [openingCash, setOpeningCash] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  
  const [actualCash, setActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  
  const [error, setError] = useState('');

  const fetchCurrentShift = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/shifts/current');
      setCurrentShift(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch current shift');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentShift();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await apiRequest('/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingCash: Number(openingCash), notes: openNotes })
      });
      setOpeningCash('');
      setOpenNotes('');
      fetchCurrentShift();
    } catch (err: any) {
      setError(err.message || 'Failed to open shift');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await apiRequest('/shifts/close', {
        method: 'POST',
        body: JSON.stringify({ actualCash: Number(actualCash), notes: closeNotes })
      });
      setActualCash('');
      setCloseNotes('');
      fetchCurrentShift();
    } catch (err: any) {
      setError(err.message || 'Failed to close shift');
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center"><RefreshCw className="animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-indigo-600" />
          Shift Management
        </h1>
        <button onClick={fetchCurrentShift} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {!currentShift ? (
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-green-500" />
            Open New Shift
          </h2>
          <form onSubmit={handleOpenShift} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Cash</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={openingCash}
                  onChange={e => setOpeningCash(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 pt-2 pointer-events-none">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <textarea
                  value={openNotes}
                  onChange={e => setOpenNotes(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Any opening notes..."
                  rows={3}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Start Shift
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Current Shift Metrics</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Started At</span>
                <span className="font-medium">{new Date(currentShift.startTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Opening Float</span>
                <span className="font-medium font-mono">₹{currentShift.openingCash?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Cash Sales</span>
                <span className="font-medium font-mono text-green-600">+₹{(currentShift.liveMetrics?.cashSales || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Other Sales (UPI/Card)</span>
                <span className="font-medium font-mono">₹{((currentShift.liveMetrics?.cardSales || 0) + (currentShift.liveMetrics?.upiSales || 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Cash Expenses</span>
                <span className="font-medium font-mono text-red-600">-₹{(currentShift.liveMetrics?.expenses || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-indigo-200 bg-indigo-50/50 px-2 rounded">
                <span className="font-semibold text-gray-900">Expected Cash in Drawer</span>
                <span className="font-bold font-mono text-indigo-700 text-lg">
                  ₹{(currentShift.liveMetrics?.expectedCash ?? currentShift.openingCash)?.toLocaleString()}
                </span>
              </div>
              {currentShift.notes && (
                <div className="py-2">
                  <span className="block text-gray-600 mb-1 text-xs">Opening Notes</span>
                  <p className="text-gray-900 text-sm bg-gray-50 p-2 rounded">{currentShift.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel p-6 border-t-4 border-red-500">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Square className="w-5 h-5 text-red-500" />
              Close Shift
            </h2>
            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Counted Cash in Drawer *</label>
                  <span className="text-xs text-gray-500">
                    Expected: ₹{(currentShift.liveMetrics?.expectedCash ?? currentShift.openingCash)?.toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={actualCash}
                    onChange={e => setActualCash(e.target.value)}
                    className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {actualCash !== '' && (
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '6px',
                  background: Number(actualCash) === (currentShift.liveMetrics?.expectedCash ?? currentShift.openingCash) ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${Number(actualCash) === (currentShift.liveMetrics?.expectedCash ?? currentShift.openingCash) ? '#86efac' : '#fde047'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>Discrepancy / Variance:</span>
                    <span style={{
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: Number(actualCash) - (currentShift.liveMetrics?.expectedCash ?? currentShift.openingCash) === 0 ? '#16a34a' : '#d97706'
                    }}>
                      {Number(actualCash) - (currentShift.liveMetrics?.expectedCash ?? currentShift.openingCash) >= 0 ? '+' : ''}
                      ₹{(Number(actualCash) - (currentShift.liveMetrics?.expectedCash ?? currentShift.openingCash)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closing Notes (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 pt-2 pointer-events-none">
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>
                  <textarea
                    value={closeNotes}
                    onChange={e => setCloseNotes(e.target.value)}
                    className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Any closing notes or discrepancies..."
                    rows={3}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                End Shift
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
