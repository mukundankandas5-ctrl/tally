import React, { useState, useEffect } from 'react';

export default function ComplianceChecklist({ companyData, onUpdate }) {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState('gst');

  useEffect(() => {
    loadChecklist();
  }, [companyData]);

  const loadChecklist = async () => {
    setLoading(true);
    try {
      // Mock API call
      setChecklist({
        updated: new Date().toLocaleDateString(),
        categories: {
          gst: {
            title: 'GST Compliance',
            icon: '📊',
            duedate: 'Monthly by 20th',
            tasks: [
              {
                id: 'gst-1',
                name: 'Generate GSTR-1 (supplies data)',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-11-20',
                description: 'File details of outward supplies for the month',
              },
              {
                id: 'gst-2',
                name: 'Verify GSTR-2B (inward supplies)',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-11-28',
                description: 'Review and match supplier invoices',
              },
              {
                id: 'gst-3',
                name: 'Reconcile input credit',
                completed: false,
                priority: 'MEDIUM',
                dueDate: '2024-12-05',
                description: 'Match available credit with filed amount',
              },
              {
                id: 'gst-4',
                name: 'File GSTR-3B (tax payment)',
                completed: false,
                priority: 'HIGH',
                dueDate: '2024-12-20',
                description: 'Calculate and file tax liability',
              },
              {
                id: 'gst-5',
                name: 'Review outstanding discrepancies',
                completed: false,
                priority: 'LOW',
                dueDate: '2024-12-31',
                description: 'Address any pending differences',
              },
            ],
          },
          incomeTax: {
            title: 'Income Tax & Statutory',
            icon: '💰',
            duedate: 'Annual by July 31',
            tasks: [
              {
                id: 'it-1',
                name: 'Close books and finalize P&L',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-06-30',
                description: 'Final accounts ready for audit',
              },
              {
                id: 'it-2',
                name: 'Prepare audit documentation',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-07-15',
                description: 'Gather supporting documents',
              },
              {
                id: 'it-3',
                name: 'File audited financial statements',
                completed: false,
                priority: 'HIGH',
                dueDate: '2024-07-31',
                description: 'File with Registrar of Companies',
              },
              {
                id: 'it-4',
                name: 'File ITR (Income Tax Return)',
                completed: false,
                priority: 'CRITICAL',
                dueDate: '2024-07-31',
                description: 'Submit annual income tax return',
              },
              {
                id: 'it-5',
                name: 'Form 10-B filing for advance tax',
                completed: false,
                priority: 'MEDIUM',
                dueDate: '2024-12-31',
                description: 'If applicable based on income',
              },
            ],
          },
          tds: {
            title: 'TDS & Withholding',
            icon: '🏦',
            duedate: 'Quarterly + annual',
            tasks: [
              {
                id: 'tds-1',
                name: 'Deduct TDS on contractor payments',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-11-30',
                description: 'Section 194C - contractors/professionals',
              },
              {
                id: 'tds-2',
                name: 'File TDS returns (Form 24Q)',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-12-07',
                description: 'Quarterly TDS payment and return',
              },
              {
                id: 'tds-3',
                name: 'Issue TDS certificates (Form 16A)',
                completed: false,
                priority: 'HIGH',
                dueDate: '2024-12-31',
                description: 'Provide certificates to payees',
              },
              {
                id: 'tds-4',
                name: 'Reconcile with Form 26AS',
                completed: false,
                priority: 'MEDIUM',
                dueDate: '2025-01-31',
                description: 'Match TDS shown on taxpayer profile',
              },
              {
                id: 'tds-5',
                name: 'File annual TDS statement (Form 27D)',
                completed: false,
                priority: 'HIGH',
                dueDate: '2025-02-28',
                description: 'Annual TDS deduction statement',
              },
            ],
          },
          payroll: {
            title: 'Payroll & DSC',
            icon: '👥',
            duedate: 'Monthly + biennial',
            tasks: [
              {
                id: 'payroll-1',
                name: 'Calculate salary and deductions',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-11-30',
                description: 'Monthly salary processing',
              },
              {
                id: 'payroll-2',
                name: 'File payroll register with DSC',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-12-07',
                description: 'Monthly ePayroll submission',
              },
              {
                id: 'payroll-3',
                name: 'Annual CTC and salary certification',
                completed: false,
                priority: 'MEDIUM',
                dueDate: '2025-01-31',
                description: 'Provide annual salary details',
              },
              {
                id: 'payroll-4',
                name: 'File Form 12BA (investment statements)',
                completed: false,
                priority: 'MEDIUM',
                dueDate: '2024-12-31',
                description: 'Employees tax saving investments',
              },
            ],
          },
          filings: {
            title: 'Statutory Filings & ROC',
            icon: '📋',
            duedate: 'Annual + periodic',
            tasks: [
              {
                id: 'filing-1',
                name: 'AGM & Board resolutions',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-09-30',
                description: 'Annual General Meeting held',
              },
              {
                id: 'filing-2',
                name: 'Directors declaration under Section 149',
                completed: true,
                priority: 'HIGH',
                dueDate: '2024-10-15',
                description: 'Directors declaration compliance',
              },
              {
                id: 'filing-3',
                name: 'File annual return (Form MGT-7)',
                completed: false,
                priority: 'HIGH',
                dueDate: '2024-12-31',
                description: 'Annual information return to ROC',
              },
              {
                id: 'filing-4',
                name: 'File consolidated financial statements',
                completed: false,
                priority: 'MEDIUM',
                dueDate: '2024-12-31',
                description: 'If applicable for group companies',
              },
              {
                id: 'filing-5',
                name: 'CSR report filing (if applicable)',
                completed: false,
                priority: 'MEDIUM',
                dueDate: '2024-12-31',
                description: 'Corporate Social Responsibility',
              },
            ],
          },
        },
      });
    } catch (error) {
      console.error('Failed to load checklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (categoryKey, taskId) => {
    setChecklist((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryKey]: {
          ...prev.categories[categoryKey],
          tasks: prev.categories[categoryKey].tasks.map((task) =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        },
      },
    }));
    onUpdate?.(categoryKey, taskId);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 border-red-300',
      HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      LOW: 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[priority] || colors.LOW;
  };

  const getProgressStats = (tasks) => {
    const completed = tasks.filter((t) => t.completed).length;
    const percentage = Math.round((completed / tasks.length) * 100);
    return { completed, total: tasks.length, percentage };
  };

  if (loading || !checklist) {
    return (
      <div className="p-8 rounded-3xl bg-gradient-to-br from-white/75 to-white/50 backdrop-blur-lg shadow-lg">
        <p className="text-center text-gray-600">Loading compliance checklist...</p>
      </div>
    );
  }

  const categories = Object.entries(checklist.categories);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Compliance Checklist</h2>
            <p className="text-sm text-gray-600">Last updated: {checklist.updated}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-2">Overall Progress</p>
            <div className="w-32 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <div className="w-28 h-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {categories.reduce((sum, [_, cat]) => sum + getProgressStats(cat.tasks).completed, 0)} /{' '}
                  {categories.reduce((sum, [_, cat]) => sum + cat.tasks.length, 0)} tasks
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist Categories */}
      <div className="space-y-4">
        {categories.map(([categoryKey, category]) => {
          const stats = getProgressStats(category.tasks);
          const isExpanded = expandedCategory === categoryKey;

          return (
            <div key={categoryKey} className="glass-card rounded-2xl overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
                className="w-full p-6 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                      <p className="text-xs text-gray-500">Due: {category.duedate}</p>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-semibold text-gray-900">{stats.percentage}%</p>
                  <p className="text-xs text-gray-600">
                    {stats.completed}/{stats.total} done
                  </p>
                </div>
              </button>

              {/* Category Tasks */}
              {isExpanded && (
                <div className="border-t border-gray-200 divide-y divide-gray-200">
                  {category.tasks.map((task) => (
                    <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(categoryKey, task.id)}
                          className="w-5 h-5 rounded-full mt-1 cursor-pointer accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4
                              className={`font-medium ${
                                task.completed ? 'line-through text-gray-500' : 'text-gray-900'
                              }`}
                            >
                              {task.name}
                            </h4>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>📅 Due: {new Date(task.dueDate).toLocaleDateString('en-IN')}</span>
                            {task.completed && <span className="text-green-600 font-semibold">✓ Completed</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Key Dates Summary */}
      <div className="glass-card p-6 rounded-2xl bg-amber-50 border border-amber-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Key Compliance Dates</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-gray-900">GST Returns</p>
              <p className="text-sm text-gray-600">20th of every month</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xl">💰</span>
            <div>
              <p className="font-medium text-gray-900">ITR Filing</p>
              <p className="text-sm text-gray-600">July 31 (FY-end)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xl">🏦</span>
            <div>
              <p className="font-medium text-gray-900">TDS Returns</p>
              <p className="text-sm text-gray-600">7th of next quarter month</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-xl">📋</span>
            <div>
              <p className="font-medium text-gray-900">ROC Filings</p>
              <p className="text-sm text-gray-600">December 31 (FY-end)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Download & Export */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📥 Export Checklist</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <button className="px-4 py-3 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 font-medium text-blue-700 transition-colors">
            📄 Download PDF
          </button>
          <button className="px-4 py-3 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 font-medium text-green-700 transition-colors">
            📊 Export to Excel
          </button>
          <button className="px-4 py-3 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 font-medium text-purple-700 transition-colors">
            📧 Email Checklist
          </button>
        </div>
      </div>
    </div>
  );
}
