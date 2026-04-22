import React, { useState, useEffect } from 'react';
import ComplianceScorecard from './ComplianceScorecard';
import TDSManager from './TDSManager';
import ComplianceChecklist from './ComplianceChecklist';
import {
  generateComplianceScorecard,
  getTDSSummary,
  getGSTSummary,
  getComplianceChecklist,
} from '../utils/api';

export default function ComplianceHub({ companyData }) {
  const [activeTab, setActiveTab] = useState('scorecard');
  const [selectedFY, setSelectedFY] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const [scorecard, setScorecard] = useState(null);
  const [tdsSummary, setTdsSummary] = useState(null);
  const [gstSummary, setGstSummary] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [error, setError] = useState(null);

  const currentYear = new Date().getFullYear();
  const fiscalYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  // Default company ID if not provided
  const companyId = companyData?.id || 'default-company';

  // Fetch compliance data when FY or tab changes
  useEffect(() => {
    const fetchComplianceData = async () => {
      if (!companyId) return;
      
      try {
        setIsLoading(true);
        setError(null);

        // Fetch scorecard
        const scorecardData = await generateComplianceScorecard(companyId, selectedFY);
        setScorecard(scorecardData);

        // Fetch TDS summary
        const tdsData = await getTDSSummary(companyId, selectedFY);
        setTdsSummary(tdsData);

        // Fetch GST summary
        const gstData = await getGSTSummary(companyId, selectedFY);
        setGstSummary(gstData);

        // Fetch checklist
        const checklistData = await getComplianceChecklist(companyId, selectedFY);
        setChecklist(checklistData);
      } catch (err) {
        console.error('Error fetching compliance data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComplianceData();
  }, [selectedFY, companyId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/50">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-lg bg-white/80 border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-3xl">📋</span>
                Compliance Hub
              </h1>
              <p className="text-gray-600 mt-1">{companyData?.companyName || 'Your Company'} • Compliance Management Suite</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Fiscal Year:</label>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(parseInt(e.target.value))}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                {fiscalYears.map((year) => (
                  <option key={year} value={year}>
                    FY {year}-{year + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto">
            <TabButton
              label="📊 Scorecard"
              value="scorecard"
              active={activeTab === 'scorecard'}
              onClick={() => setActiveTab('scorecard')}
            />
            <TabButton
              label="🏦 TDS Manager"
              value="tds"
              active={activeTab === 'tds'}
              onClick={() => setActiveTab('tds')}
            />
            <TabButton
              label="✅ Compliance Checklist"
              value="checklist"
              active={activeTab === 'checklist'}
              onClick={() => setActiveTab('checklist')}
            />
            <TabButton
              label="📚 Resources"
              value="resources"
              active={activeTab === 'resources'}
              onClick={() => setActiveTab('resources')}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin mb-4">⟳</div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            {activeTab === 'scorecard' && (
              <div className="animate-fadeIn">
                <ComplianceScorecard 
                  companyData={companyData} 
                  scorecard={scorecard}
                  tdsSummary={tdsSummary}
                  gstSummary={gstSummary}
                />
              </div>
            )}

            {activeTab === 'tds' && (
              <div className="animate-fadeIn">
                <TDSManager 
                  year={selectedFY}
                  companyId={companyId}
                  tdsSummary={tdsSummary}
                />
              </div>
            )}

            {activeTab === 'checklist' && (
              <div className="animate-fadeIn">
                <ComplianceChecklist
                  companyData={companyData}
                  checklist={checklist}
                  companyId={companyId}
                  fiscalYear={selectedFY}
                  onUpdate={(category, taskId) => {
                    console.log(`Updated: ${category} - ${taskId}`);
                  }}
                />
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="animate-fadeIn space-y-6">
                <ComplianceResources />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ label, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

function ComplianceResources() {
  const resources = [
    {
      category: 'GST',
      icon: '📊',
      items: [
        {
          title: 'GSTR-1 Filing Guide',
          description: 'Complete guide for filing outward supplies GSTR-1',
          link: 'https://www.gst.gov.in',
        },
        {
          title: 'GSTR-2B Reconciliation',
          description: 'How to reconcile ITC with GSTR-2B data',
          link: 'https://www.gst.gov.in',
        },
        {
          title: 'Input Tax Credit Rules',
          description: 'Understanding ITC eligibility and restrictions',
          link: 'https://www.gst.gov.in',
        },
      ],
    },
    {
      category: 'Income Tax',
      icon: '💰',
      items: [
        {
          title: 'ITR Filing Deadlines',
          description: 'Key dates and deadlines for ITR filing',
          link: 'https://www.incometaxindia.gov.in',
        },
        {
          title: 'Schedule-wise Filing',
          description: 'What schedules are applicable to your business',
          link: 'https://www.incometaxindia.gov.in',
        },
        {
          title: 'Audit Requirements',
          description: 'When is audit required and documentation needed',
          link: 'https://www.incometaxindia.gov.in',
        },
      ],
    },
    {
      category: 'TDS',
      icon: '🏦',
      items: [
        {
          title: 'TDS Deduction Rates',
          description: 'Current TDS rates under different sections',
          link: 'https://www.incometaxindia.gov.in',
        },
        {
          title: 'Certificate Management',
          description: 'Issuing Form 16A and maintaining records',
          link: 'https://www.incometaxindia.gov.in',
        },
        {
          title: 'Quarterly Returns (24Q)',
          description: 'Filing TDS deduction returns',
          link: 'https://www.incometaxindia.gov.in',
        },
      ],
    },
    {
      category: 'Payroll & Statutory',
      icon: '👥',
      items: [
        {
          title: 'ESI Compliance',
          description: 'Employee Social Insurance scheme requirements',
          link: '#',
        },
        {
          title: 'PF Compliance',
          description: 'Provident Fund contribution and filing',
          link: '#',
        },
        {
          title: 'Professional Tax',
          description: 'State-wise professional tax requirements',
          link: '#',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">📚 Compliance Resources</h2>
        <p className="text-gray-600">Essential guides and links for Indian tax and compliance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {resources.map((category) => (
          <div key={category.category} className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">{category.icon}</span>
              {category.category}
            </h3>
            <div className="space-y-3">
              {category.items.map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-colors group"
                >
                  <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                    {item.title}
                  </h4>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Help */}
      <div className="glass-card p-6 rounded-2xl bg-green-50 border border-green-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">❓ Quick Help</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="p-4 rounded-xl bg-white">
            <h4 className="font-medium text-gray-900 mb-2">When is GST due?</h4>
            <p className="text-sm text-gray-600">GST returns (GSTR-1, GSTR-3B) are due on the 20th of the following month</p>
          </div>
          <div className="p-4 rounded-xl bg-white">
            <h4 className="font-medium text-gray-900 mb-2">When is ITR due?</h4>
            <p className="text-sm text-gray-600">Income Tax Returns must be filed by July 31 for the previous financial year</p>
          </div>
          <div className="p-4 rounded-xl bg-white">
            <h4 className="font-medium text-gray-900 mb-2">TDS Return Deadlines</h4>
            <p className="text-sm text-gray-600">Quarterly TDS returns (Form 24Q) are due on the 7th of the following quarter month</p>
          </div>
        </div>
      </div>
    </div>
  );
}
