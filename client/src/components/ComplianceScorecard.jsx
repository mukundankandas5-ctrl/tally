import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';

export default function ComplianceScorecard({ companyData, refreshInterval = 3600000 }) {
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    loadScorecard();
    const interval = setInterval(loadScorecard, refreshInterval);
    return () => clearInterval(interval);
  }, [companyData]);

  const loadScorecard = async () => {
    setLoading(true);
    try {
      // In production, call API endpoint
      // const response = await fetch('/api/compliance/scorecard', {
      //   method: 'POST',
      //   body: JSON.stringify(companyData)
      // });
      // const data = await response.json();
      // setScorecard(data);

      // For now, mock the response
      setScorecard({
        companyName: companyData?.companyName || 'Your Company',
        overallScore: 78,
        fy: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        sections: {
          gst: {
            status: 'FULLY_COMPLIANT',
            lastUpdate: new Date().toLocaleDateString(),
            nextDue: 'No pending items',
          },
          incomeTax: {
            status: 'REQUIRES_ACTION',
            lastUpdate: 'June 30, 2024',
            nextDue: 'July 31, 2024',
          },
          tds: {
            status: 'FULLY_COMPLIANT',
            lastUpdate: new Date().toLocaleDateString(),
            nextDue: 'December 2024',
          },
        },
        recommendations: [
          'GST compliance on track',
          'Action required: File ITR by July 31',
          'TDS certificates filed successfully',
        ],
      });
    } catch (error) {
      console.error('Failed to load scorecard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'from-green-500 to-emerald-600';
    if (score >= 75) return 'from-blue-500 to-cyan-600';
    if (score >= 50) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getStatusBadge = (status) => {
    const badgeClasses = {
      FULLY_COMPLIANT: 'bg-green-100 text-green-800',
      REQUIRES_ACTION: 'bg-yellow-100 text-yellow-800',
      NON_COMPLIANT: 'bg-red-100 text-red-800',
      PARTIALLY_COMPLIANT: 'bg-blue-100 text-blue-800',
    };
    return badgeClasses[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading || !scorecard) {
    return (
      <div className="p-8 rounded-3xl bg-gradient-to-br from-white/75 to-white/50 backdrop-blur-lg shadow-lg">
        <p className="text-center text-gray-600">Loading compliance scorecard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <div className={`glass-card p-8 rounded-3xl bg-gradient-to-br ${getScoreColor(scorecard.overallScore)}`}>
        <div className="text-white">
          <h2 className="text-2xl font-bold mb-2">Compliance Scorecard</h2>
          <p className="text-white/80 text-sm">FY {scorecard.fy}</p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{scorecard.overallScore}</div>
              <div className="text-white/90 text-sm">Overall Score</div>
            </div>
            <div className="text-center border-l border-white/30">
              <div className="text-3xl font-bold mb-2">3/3</div>
              <div className="text-white/90 text-sm">Sections Tracked</div>
            </div>
            <div className="text-center border-l border-white/30">
              <div className="text-3xl font-bold mb-2">✓</div>
              <div className="text-white/90 text-sm">On Track</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* GST Compliance */}
        <div
          className="glass-card p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg"
          onClick={() => setExpandedSection(expandedSection === 'gst' ? null : 'gst')}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">GST Compliance</h3>
              <p className="text-xs text-gray-500">Goods & Services Tax</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(scorecard.sections.gst.status)}`}>
              ✓ Compliant
            </span>
          </div>
          <div className="space-y-2 text-sm text-gray-700">
            <div>📅 Last Update: {scorecard.sections.gst.lastUpdate}</div>
            <div>⏰ Next Due: {scorecard.sections.gst.nextDue}</div>
          </div>
          {expandedSection === 'gst' && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
              <p>✓ GSTR-2B reconciliation completed</p>
              <p>✓ All invoices properly classified</p>
              <p>✓ Input tax credit eligible</p>
            </div>
          )}
        </div>

        {/* Income Tax Compliance */}
        <div
          className="glass-card p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg"
          onClick={() => setExpandedSection(expandedSection === 'it' ? null : 'it')}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Income Tax</h3>
              <p className="text-xs text-gray-500">Annual Return Filing</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(scorecard.sections.incomeTax.status)}`}>
              ⚠️ Action Needed
            </span>
          </div>
          <div className="space-y-2 text-sm text-gray-700">
            <div>📅 Last Update: {scorecard.sections.incomeTax.lastUpdate}</div>
            <div>⏰ Due: {scorecard.sections.incomeTax.nextDue}</div>
          </div>
          {expandedSection === 'it' && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-sm">
              <p className="text-orange-600 font-medium">⚠️ ITR filing required by July 31</p>
              <button className="mt-2 text-blue-600 hover:text-blue-800 font-medium">
                Start Filing →
              </button>
            </div>
          )}
        </div>

        {/* TDS Compliance */}
        <div
          className="glass-card p-6 rounded-2xl cursor-pointer transition-all hover:shadow-lg"
          onClick={() => setExpandedSection(expandedSection === 'tds' ? null : 'tds')}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">TDS Management</h3>
              <p className="text-xs text-gray-500">Tax Deducted at Source</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(scorecard.sections.tds.status)}`}>
              ✓ On Track
            </span>
          </div>
          <div className="space-y-2 text-sm text-gray-700">
            <div>📅 Last Update: {scorecard.sections.tds.lastUpdate}</div>
            <div>⏰ Next Due: {scorecard.sections.tds.nextDue}</div>
          </div>
          {expandedSection === 'tds' && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
              <p>✓ TDS certificates filed</p>
              <p>✓ Form 26AS reconciled</p>
              <p>✓ No outstanding TDS</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="glass-card p-6 rounded-2xl bg-blue-50/50 border border-blue-100">
        <h3 className="font-semibold text-gray-900 mb-4">📋 Recommendations</h3>
        <ul className="space-y-2">
          {scorecard.recommendations.map((rec, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="text-blue-600 mt-1">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <button className="glass-card p-4 rounded-2xl text-left hover:bg-blue-50 transition-colors">
          <h4 className="font-semibold text-gray-900 mb-1">📊 View Detailed Report</h4>
          <p className="text-xs text-gray-600">Complete compliance analysis with historical data</p>
        </button>
        <button className="glass-card p-4 rounded-2xl text-left hover:bg-green-50 transition-colors">
          <h4 className="font-semibold text-gray-900 mb-1">🔄 Refresh Now</h4>
          <p className="text-xs text-gray-600">Update scorecard with latest data</p>
        </button>
      </div>
    </div>
  );
}
