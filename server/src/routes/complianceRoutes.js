const express = require('express');
const router = express.Router();
const complianceService = require('../services/complianceService');
const auth = require('../middleware/auth');

// Apply authentication to all routes
router.use(auth);

/**
 * GET /api/compliance/scorecard
 * Get compliance scorecard for a company
 */
router.post('/scorecard', async (req, res, next) => {
  try {
    const { companyId, fiscalYear } = req.body;
    const scorecard = await complianceService.generateScorecard(companyId, fiscalYear);
    res.json(scorecard);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/tds-summary
 * Get TDS deduction summary
 */
router.get('/tds-summary/:companyId/:fy', async (req, res, next) => {
  try {
    const { companyId, fy } = req.params;
    const summary = await complianceService.getTDSSummary(companyId, parseInt(fy));
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/tds-details
 * Get detailed TDS records
 */
router.get('/tds-details/:companyId/:fy', async (req, res, next) => {
  try {
    const { companyId, fy } = req.params;
    const details = await complianceService.getTDSDetails(companyId, parseInt(fy));
    res.json(details);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compliance/tds-entry
 * Add TDS deduction entry
 */
router.post('/tds-entry', async (req, res, next) => {
  try {
    const { companyId, entry } = req.body;
    const result = await complianceService.addTDSEntry(companyId, entry);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/gst-summary
 * Get GST filing summary
 */
router.get('/gst-summary/:companyId/:fy', async (req, res, next) => {
  try {
    const { companyId, fy } = req.params;
    const summary = await complianceService.getGSTSummary(companyId, parseInt(fy));
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/checklist
 * Get compliance checklist
 */
router.get('/checklist/:companyId/:fy', async (req, res, next) => {
  try {
    const { companyId, fy } = req.params;
    const checklist = await complianceService.getChecklist(companyId, parseInt(fy));
    res.json(checklist);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/compliance/checklist/:taskId
 * Update checklist task status
 */
router.put('/checklist/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { completed } = req.body;
    const result = await complianceService.updateChecklistTask(taskId, { completed });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/due-dates
 * Get upcoming compliance due dates
 */
router.get('/due-dates/:companyId/:month', async (req, res, next) => {
  try {
    const { companyId, month } = req.params;
    const dueDates = await complianceService.getUpcomingDueDates(companyId, parseInt(month));
    res.json(dueDates);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/alerts
 * Get compliance alerts and warnings
 */
router.get('/alerts/:companyId', async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const alerts = await complianceService.getComplianceAlerts(companyId);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compliance/gst-reconciliation
 * GST reconciliation and analysis
 */
router.post('/gst-reconciliation', async (req, res, next) => {
  try {
    const { companyId, fy } = req.body;
    const reconciliation = await complianceService.performGSTReconciliation(companyId, fy);
    res.json(reconciliation);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compliance/tds-certificate
 * Generate TDS certificate (Form 16A)
 */
router.post('/tds-certificate', async (req, res, next) => {
  try {
    const { companyId, payeeId, fy } = req.body;
    const certificate = await complianceService.generateTDSCertificate(companyId, payeeId, fy);
    res.json(certificate);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/audit-trail
 * Get compliance audit trail
 */
router.get('/audit-trail/:companyId/:fy', async (req, res, next) => {
  try {
    const { companyId, fy } = req.params;
    const trail = await complianceService.getAuditTrail(companyId, parseInt(fy));
    res.json(trail);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
