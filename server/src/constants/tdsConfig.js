// TDS Section Configuration as per Indian Tax Code
const tdsConfigs = {
  // Section 194J - Payment to contractors, consultants, etc.
  "194J": {
    name: "Income from Contractors, Consultants",
    tdsRate: 10,
    applicableFor: ["Professional Fees", "Consultancy Charges", "Legal Charges"],
    thresholdLimit: 50000, // Threshold limit in Rs
    applicableTo: ["Individuals", "Partnership Firms"],
  },

  // Section 194C - Payment to contractors for work
  "194C": {
    name: "Payment for Work Undertaken",
    tdsRate: 5,
    applicableFor: ["Freight & Cartage", "Repairs & Maintenance", "Packing Charges"],
    thresholdLimit: 50000,
    applicableTo: ["Individuals", "Partnership Firms"],
  },

  // Section 194D - Insurance Commission
  "194D": {
    name: "Insurance Commission",
    tdsRate: 5,
    applicableFor: ["Insurance", "Commission Paid"],
    thresholdLimit: 15000,
    applicableTo: ["All"],
  },

  // Section 194H - Commission on Life Insurance
  "194H": {
    name: "Commission on Life Insurance Policies",
    tdsRate: 5,
    applicableFor: ["Insurance Commission"],
    thresholdLimit: 15000,
    applicableTo: ["All"],
  },

  // Section 194I - Rent on Property
  "194I": {
    name: "Rent on Property",
    tdsRate: 10,
    applicableFor: ["Rent"],
    thresholdLimit: 100000,
    applicableTo: ["Individuals"],
  },

  // Section 194IA - Real Estate/Property Transactions
  "194IA": {
    name: "Rent on Structure",
    tdsRate: 5,
    applicableFor: ["Rent"],
    thresholdLimit: 100000,
    applicableTo: ["All"],
  },

  // Section 194K - Brokerage Commission
  "194K": {
    name: "Brokerage Commission",
    tdsRate: 10,
    applicableFor: ["Commission Paid"],
    thresholdLimit: 50000,
    applicableTo: ["All"],
  },

  // Salary TDS  
  "SALARY": {
    name: "Salary Income",
    tdsRate: 5, // Variable based on slab
    applicableFor: ["Salary", "Wages"],
    thresholdLimit: 0,
    applicableTo: ["Individuals"],
  },

  // Section 194O - Commission on Sale of Goods
  "194O": {
    name: "Commission on Sale of Goods",
    tdsRate: 5,
    applicableFor: ["Commission Paid", "Sales Discount"],
    thresholdLimit: 50000,
    applicableTo: ["All"],
  },
};

// TDS Deductee Types
const tdDeducteeTypes = {
  INDIVIDUAL: "Individuals",
  HUF: "Hindu Undivided Family",
  COMPANY: "Company",
  PARTNERSHIP: "Partnership Firm",
  AOP: "Association of Persons",
  BOI: "Body of Individuals",
  TRUST: "Trust",
  GOVT: "Government",
  FOREIGNER: "Foreigner",
};

// PAN/aadhar requirement rules
const panRequirementRules = {
  // Turnover based threshold
  GST_BUSINESS: {
    turnoverThreshold: 4000000, // 40 lakh Rs
    mandatoryPan: true,
    applicableFromYear: 2023,
  },
  // Salary
  SALARY: {
    turnoverThreshold: 500000, // 5 lakh Rs
    mandatoryPan: true,
    applicableFromYear: 2023,
  },
  // Professional fees
  PROF_FEES: {
    turnoverThreshold: 200000, // 2 lakh Rs
    mandatoryPan: true,
    applicableFromYear: 2023,
  },
};

// Financial Year wrapper
const getFinancialYear = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  if (month >= 4) {
    return {
      startYear: year,
      endYear: year + 1,
      startDate: new Date(year, 3, 1), // April 1
      endDate: new Date(year + 1, 2, 31), // March 31
      label: `FY${year}-${(year + 1).toString().slice(2)}`,
      asOnDate: new Date(year + 1, 2, 31), // As on March 31
    };
  } else {
    return {
      startYear: year - 1,
      endYear: year,
      startDate: new Date(year - 1, 3, 1), // April 1 previous
      endDate: new Date(year, 2, 31), // March 31
      label: `FY${year - 1}-${year.toString().slice(2)}`,
      asOnDate: new Date(year, 2, 31), // As on March 31
    };
  }
};

// AY (Assessment Year) from FY
const getAssessmentYear = (fyStartYear) => {
  return fyStartYear + 1; // FY 2023-24 => AY 2024-25
};

module.exports = {
  tdsConfigs,
  tdDeducteeTypes,
  panRequirementRules,
  getFinancialYear,
  getAssessmentYear,
};
