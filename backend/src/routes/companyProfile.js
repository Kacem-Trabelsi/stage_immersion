const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  getCompanyProfile,
  createOrUpdateCompanyProfile,
  checkProfileCompletion,
  getAllCompanyProfiles,
  updateRequestStatus,
  getEnums
} = require('../controllers/companyProfileController');
const { CompanyProfile } = require('../models/CompanyProfile'); // Fixed import

// Public routes
router.get('/enums', getEnums);

// Analytics endpoint: returns all company profiles with only analytics fields
router.get('/analytics', authenticateToken, authorizeRoles('S2T', 'ADMIN'), async (req, res) => {
  console.log('🔍 ANALYTICS ENDPOINT REACHED');
  console.log('🔍 User:', req.user);
  try {
    // No authentication or role check
    const profiles = await CompanyProfile.find({}, {
      activityDomain: 1,
      activitySubDomain: 1,
      projectProgress: 1,
      staffRange: 1,
      supportNeeded: 1,
      requestStatus: 1,
      companyCreationDate: 1,
      address: 1,
      approval: 1
    });
    console.log('🔍 Found profiles:', profiles.length);
    res.json({ success: true, data: profiles });
  } catch (err) {
    console.log('🔍 Error in analytics:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Search endpoint: search companies by name or activity domain
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q: searchTerm, activityDomain, projectProgress, staffRange, requestStatus } = req.query;
    
    // Build search query
    let query = {};
    
    if (searchTerm) {
      query.$or = [
        { companyName: { $regex: searchTerm, $options: 'i' } },
        { founderName: { $regex: searchTerm, $options: 'i' } },
        { activityDomain: { $regex: searchTerm, $options: 'i' } },
        { activitySubDomain: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Add filters
    if (activityDomain) query.activityDomain = activityDomain;
    if (projectProgress) query.projectProgress = projectProgress;
    if (staffRange) query.staffRange = staffRange;
    if (requestStatus) query.requestStatus = requestStatus;
    
    const profiles = await CompanyProfile.find(query, {
      companyName: 1,
      founderName: 1,
      email: 1,
      activityDomain: 1,
      activitySubDomain: 1,
      projectProgress: 1,
      staffRange: 1,
      requestStatus: 1,
      companyCreationDate: 1,
      address: 1
    }).limit(20); // Limit results for performance
    
    res.json({ 
      success: true, 
      data: profiles,
      total: profiles.length,
      searchTerm: searchTerm || ''
    });
  } catch (err) {
    console.log('🔍 Error in search:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- NEW: Statistics dashboard endpoint ---
router.get('/statistics', authenticateToken, authorizeRoles('S2T', 'ADMIN'), require('../controllers/companyProfileController').getCompanyStatistics);

// Get company profile by ID (for detail dashboard)
router.get('/detail/:companyId', authenticateToken, authorizeRoles('S2T', 'ADMIN', 'EXPERT'), async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log('🔍 FETCHING COMPANY PROFILE BY ID:', companyId);
    
    const profile = await CompanyProfile.findById(companyId);
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Company profile not found' 
      });
    }
    
    console.log('🔍 FOUND PROFILE:', profile.companyName);
    res.json({ 
      success: true, 
      data: profile 
    });
  } catch (err) {
    console.log('🔍 Error fetching company profile:', err.message);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// Admin routes
router.get('/admin/all', authenticateToken, getAllCompanyProfiles);
router.put('/admin/:profileId/status', authenticateToken, updateRequestStatus);

// Protected routes (these must come after specific routes)
router.get('/check/:userId', authenticateToken, checkProfileCompletion);
router.get('/:userId', authenticateToken, getCompanyProfile);
router.post('/:userId', authenticateToken, createOrUpdateCompanyProfile);

// --- NEW: PDF report download endpoint ---
router.get('/:companyId/report', authenticateToken, authorizeRoles('S2T', 'ADMIN', 'EXPERT'), require('../controllers/companyProfileController').generateCompanyReportPDF);

module.exports = router; 