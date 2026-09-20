import React, { useState, useEffect } from 'react';
import { Receipt, Plus, DollarSign, Tag, FileText, Calendar, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../api/client';

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/expenses');
      setExpenses(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await apiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category,
          amount: Number(amount),
          description,
          date: date || undefined
        })
      });
      setCategory('');
      setAmount('');
      setDescription('');
      setDate('');
      fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Failed to create expense');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-indigo-600" />
          Expenses
        </h1>
        <button onClick={fetchExpenses} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            Add Expense
          </h2>
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <div className="relative">
                <select
                  required
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Select Category --</option>
                  <option value="Supplies & Inventory">Supplies & Inventory</option>
                  <option value="Refreshments & Tea">Refreshments & Tea</option>
                  <option value="Utilities & Electricity">Utilities & Electricity</option>
                  <option value="Rent & Premises">Rent & Premises</option>
                  <option value="Maintenance & Cleaning">Maintenance & Cleaning</option>
                  <option value="Logistics & Delivery">Logistics & Delivery</option>
                  <option value="Other">Other Miscellaneous</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 pt-2 pointer-events-none">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <textarea
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 border p-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Expense details..."
                  rows={3}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Save Expense
            </button>
          </form>
        </div>

        <div className="glass-panel p-0 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Expenses</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Description</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && expenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading expenses...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No expenses found
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense: any) => (
                    <tr key={expense._id} className="hover:bg-gray-50">
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(expense.date || expense.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-900">
                        {expense.category}
                      </td>
                      <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                        {expense.description}
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-900 text-right">
                        ${expense.amount.toFixed(2)}
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
