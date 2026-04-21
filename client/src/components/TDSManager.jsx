import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function TDSManager({ year }) {
  const [tdsData, setTdsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    payeeType: 'CONTRACTOR',
    amount: '',
    rate: '',
    reason: '',
  });

  useEffect(() => {
    loadTdsData();
  }, [year]);

  const loadTdsData = async () => {
    setLoading(true);
    try {
      // Mock API call
      setTdsData({
        fy: `${year}-${year + 1}`,
        totalDeducted: 125000,
        totalRemitted: 120000,
        outstanding: 5000,
        certCount: 8,
        sections: {
          '194A': { name: 'Interest Income', deducted: 35000, rate: 10 },
          '194B': { name: 'Dividend', deducted: 25000, rate: 10 },
          '194C': { name: 'Contractor/Professional', deducted: 45000, rate: 5 },
          '194E': { name: 'Insurance', deducted: 15000, rate: 20 },
          '194H': { name: 'Commission/Brokerage', deducted: 5000, rate: 5 },
        },
        monthlyData: [
          { month: 'Apr', deducted: 8000, remitted: 8000, outstanding: 0 },
          { month: 'May', deducted: 12000, remitted: 12000, outstanding: 0 },
          { month: 'Jun', deducted: 11000, remitted: 11000, outstanding: 0 },
          { month: 'Jul', deducted: 15000, remitted: 14000, outstanding: 1000 },
          { month: 'Aug', deducted: 13000, remitted: 13000, outstanding: 0 },
          { month: 'Sep', deducted: 10000, remitted: 10000, outstanding: 0 },
          { month: 'Oct', deducted: 18000, remitted: 18000, outstanding: 0 },
          { month: 'Nov', deducted: 16000, remitted: 14000, outstanding: 4000 },
          { month: 'Dec', deducted: 7000, remitted: 7000, outstanding: 0 },
        ],
        upcomingRemittances: [
          { month: 'Jan 2024', dueDate: '2024-02-07', amount: 8500, status: 'PENDING' },
          { month: 'Feb 2024', dueDate: '2024-03-07', amount: 9200, status: 'PENDING' },
        ],
      });
    } catch (error) {
      console.error('Failed to load TDS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'PAID') return 'text-green-600 bg-green-50';
    if (status === 'PENDING') return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading || !tdsData) {
    return (
      <div className="p-8 rounded-3xl bg-gradient-to-br from-white/75 to-white/50 backdrop-blur-lg shadow-lg">
        <p className="text-center text-gray-600">Loading TDS data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-sm text-gray-600 mb-2">Total Deducted</p>
          <p className="text-3xl font-bold text-gray-900">₹{(tdsData.totalDeducted).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">FY {tdsData.fy}</p>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-sm text-gray-600 mb-2">Total Remitted</p>
          <p className="text-3xl font-bold text-green-600">₹{(tdsData.totalRemitted).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">Payment Status</p>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-sm text-gray-600 mb-2">Outstanding</p>
          <p className="text-3xl font-bold text-orange-600">₹{(tdsData.outstanding).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">To be remitted</p>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-sm text-gray-600 mb-2">Certificates Filed</p>
          <p className="text-3xl font-bold text-blue-600">{tdsData.certCount}</p>
          <p className="text-xs text-gray-500 mt-2">TDS certificates</p>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly TDS Deduction Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={tdsData.monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
            <Legend />
            <Line type="monotone" dataKey="deducted" stroke="#3b82f6" strokeWidth={2} name="Deducted" />
            <Line type="monotone" dataKey="remitted" stroke="#10b981" strokeWidth={2} name="Remitted" />
            <Line type="monotone" dataKey="outstanding" stroke="#f59e0b" strokeWidth={2} name="Outstanding" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TDS Section Breakdown */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">TDS by Section</h3>
        <div className="space-y-3">
          {Object.entries(tdsData.sections).map(([section, data]) => (
            <div key={section} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-medium text-gray-900">{section}</p>
                <p className="text-sm text-gray-600">{data.name}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">₹{(data.deducted).toLocaleString('en-IN')}</p>
                <p className="text-sm text-gray-500">{data.rate}% rate</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Remittances */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Remittances</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            + Add Entry
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="grid gap-4 lg:grid-cols-4">
              <select
                value={newEntry.payeeType}
                onChange={(e) => setNewEntry({ ...newEntry, payeeType: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value="CONTRACTOR">Contractor</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="INTEREST">Interest</option>
                <option value="DIVIDEND">Dividend</option>
              </select>
              <input
                type="number"
                placeholder="Amount"
                value={newEntry.amount}
                onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <input
                type="number"
                placeholder="Rate %"
                value={newEntry.rate}
                onChange={(e) => setNewEntry({ ...newEntry, rate: e.target.value })}
                className="px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <button className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors">
                Add
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {tdsData.upcomingRemittances.map((rem, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">{rem.month}</p>
                <p className="text-sm text-gray-600">Due: {new Date(rem.dueDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">₹{rem.amount.toLocaleString('en-IN')}</p>
                <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full mt-1 ${getStatusColor(rem.status)}`}>
                  {rem.status === 'PAID' ? '✓ Paid' : '⏳ Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TDS Certificate Management */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">TDS Certificates (Form 16/16A)</h3>
        <div className="space-y-3">
          {[
            { contractor: 'ABC Contractors Ltd', amount: 45000, issued: true, date: '2024-06-15' },
            { contractor: 'XYZ Professional Services', amount: 25000, issued: true, date: '2024-06-20' },
            { contractor: 'Insurance Agency Inc', amount: 15000, issued: true, date: '2024-06-25' },
          ].map((cert, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-green-50 border border-green-200">
              <div>
                <p className="font-medium text-gray-900">{cert.contractor}</p>
                <p className="text-sm text-gray-600">₹{cert.amount.toLocaleString('en-IN')} deducted</p>
              </div>
              <div className="text-right">
                {cert.issued ? (
                  <div>
                    <p className="text-xs text-green-600 font-semibold">✓ Issued</p>
                    <p className="text-xs text-gray-500">{new Date(cert.date).toLocaleDateString('en-IN')}</p>
                  </div>
                ) : (
                  <p className="text-xs text-orange-600 font-semibold">⏳ Pending</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className="glass-card p-6 rounded-2xl bg-blue-50 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 TDS Compliance Checklist</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-green-600" />
            <span className="text-gray-700">TDS deducted and tracked monthly</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-green-600" />
            <span className="text-gray-700">TDS remitted on time</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-green-600" />
            <span className="text-gray-700">Quarterly TDS returns filed</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-green-600" />
            <span className="text-gray-700">Form 16/16A issued to all payees</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 rounded text-gray-400" />
            <span className="text-gray-700">Annual TDS statement filed</span>
          </label>
        </div>
      </div>
    </div>
  );
}
