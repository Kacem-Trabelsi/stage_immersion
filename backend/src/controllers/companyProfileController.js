const { CompanyProfile, ActivityDomain, ActivitySubDomain, ProjectProgress, StaffRange, RequestStatus, CompanyStage, LabelType, SupportNeeded } = require('../models/CompanyProfile');
const { User } = require('../models/User');
const PDFDocument = require('pdfkit');

// Get company profile by user ID
const getCompanyProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Security check: ensure authenticated user can only access their own profile
    if (req.user.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const profile = await CompanyProfile.findOne({ userId }).populate('userId', 'username email firstName lastName');
    
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Company profile not found' });
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error getting company profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Create or update company profile
const createOrUpdateCompanyProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const profileData = req.body;
    // Security check: ensure authenticated user can only update their own profile
    if (req.user.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    // Validate required fields (add new indicators)
    const requiredFields = [
      'consentGiven', 'companyName', 'founderName', 'email', 'companyCreationDate',
      'activityDomain', 'projectProgress', 'staffRange',
      'gender', 'projectStage'
    ];
    for (const field of requiredFields) {
      if (!profileData[field]) {
        return res.status(400).json({ success: false, message: `${field} is required` });
      }
    }
    // Validate enums for new indicators
    if (!['MALE', 'FEMALE', 'OTHER'].includes(profileData.gender)) {
      return res.status(400).json({ success: false, message: 'Invalid gender' });
    }
    if (!['IDEA', 'PROTOTYPE', 'PILOT', 'MARKET_ENTRY', 'SCALING'].includes(profileData.projectStage)) {
      return res.status(400).json({ success: false, message: 'Invalid project stage' });
    }
    // Check if user exists and has STARTUP role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role !== 'STARTUP') {
      return res.status(403).json({ success: false, message: 'Only STARTUP users can create company profiles' });
    }
    // Create or update profile
    const profile = await CompanyProfile.findOneAndUpdate(
      { userId },
      { 
        ...profileData, 
        userId,
        updatedAt: new Date(),
        responseDate: profileData.responseDate || new Date()
      },
      { new: true, upsert: true }
    );
    // Compute statistics for this company (stub, to be implemented)
    // profile.statistics = computeCompanyStatistics(profile);
    await profile.save();
    res.json({ success: true, data: profile, message: 'Company profile saved successfully' });
  } catch (error) {
    console.error('Error creating/updating company profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- NEW: Get statistics for all companies (for dashboard) ---
const getCompanyStatistics = async (req, res) => {
  try {
    // Aggregate statistics for all companies
    const profiles = await CompanyProfile.find();
    // Compute statistics (stub, to be implemented)
    // const stats = computeGlobalStatistics(profiles);
    const stats = {};
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting company statistics:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- NEW: Generate PDF report for a company (French, S2T indicators) ---
const generateCompanyReportPDF = async (req, res) => {
  try {
    const { companyId } = req.params;
    const profile = await CompanyProfile.findById(companyId);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profil d\'entreprise non trouvé' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rapport-entreprise-${companyId}.pdf`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // Titre principal
    doc.fontSize(20).text("Rapport d'Analyse des Indicateurs S2T", { align: 'center' });
    doc.moveDown();

    // Informations de base
    doc.fontSize(14).text('Informations de l\'Entreprise', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12)
      .text(`Nom de l'entreprise : ${profile.companyName || ''}`)
      .text(`Fondateur : ${profile.founderName || ''}`)
      .text(`Email : ${profile.email || ''}`)
      .text(`Date de création : ${profile.companyCreationDate ? new Date(profile.companyCreationDate).toLocaleDateString('fr-FR') : ''}`)
      .text(`Domaine d'activité : ${profile.activityDomain || ''}`)
      .text(`Sous-domaine : ${profile.activitySubDomain || ''}`)
      .text(`Statut du projet : ${profile.projectProgress || ''}`)
      .text(`Taille d'équipe : ${profile.staffRange || ''}`)
      .text(`Adresse : ${profile.address || ''}`)
      .moveDown();

    // Indicateurs S2T
    doc.fontSize(14).text('Indicateurs de Performance', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12)
      .text(`Genre du fondateur : ${profile.gender === 'MALE' ? 'Homme' : profile.gender === 'FEMALE' ? 'Femme' : 'Autre'}`)
      .text(`Étape du projet : ${profile.projectStage || ''}`)
      .text(`Effectif (nombre d'employés) : ${profile.workforce}`)
      .text(`Certification qualité : ${profile.qualityCertification ? 'Oui' : 'Non'}`)
      .text(`Détails de la certification : ${profile.certificationDetails || 'Aucun'}`)
      .text(`Secteurs d'activité : ${(profile.sectors && profile.sectors.length > 0) ? profile.sectors.join(', ') : 'Non spécifié'}`)
      .text(`Facteurs de blocage : ${(profile.blockingFactors && profile.blockingFactors.length > 0) ? profile.blockingFactors.join(', ') : 'Aucun'}`)
      .text(`Interventions requises : ${(profile.interventionsNeeded && profile.interventionsNeeded.length > 0) ? profile.interventionsNeeded.join(', ') : 'Aucune'}`)
      .moveDown();

    // Notes et observations
    if (profile.projectNotes) {
      doc.fontSize(14).text('Notes et Observations', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(profile.projectNotes);
      doc.moveDown();
    }

    // Analyse et recommandations (exemple statique)
    doc.fontSize(14).text('Analyse et Recommandations', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12)
      .text("Cette analyse met en évidence les points forts et les axes d'amélioration du projet incubé. Il est recommandé de :")
      .list([
        "Renforcer la diversité de genre si déséquilibre constaté.",
        "Développer des programmes de soutien adaptés aux besoins identifiés.",
        "Accompagner l'entreprise dans l'obtention de certifications qualité si nécessaire.",
        "Proposer des formations ou du mentorat pour lever les facteurs de blocage.",
        "Faciliter l'accès au financement et au marché selon les besoins exprimés."
      ]);
    doc.moveDown();

    // Footer
    doc.fontSize(10).fillColor('gray').text('Rapport généré automatiquement par S2T Incubator', 40, doc.page.height - 50, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Erreur lors de la génération du rapport PDF:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

// Check if user has completed company profile - FIXED VERSION
const checkProfileCompletion = async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('=== DEBUG checkProfileCompletion ===');
    console.log('1. Received userId:', userId);
    console.log('2. req.user:', req.user);
    console.log('3. Headers:', req.headers);
    
    // Enhanced validation for userId
    if (!userId) {
      console.log('ERROR: UserId is missing');
      return res.status(400).json({ success: false, message: 'UserId is required' });
    }
    
    if (typeof userId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      console.log('ERROR: Invalid userId format:', userId);
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }
    
    // Check if req.user exists
    if (!req.user) {
      console.log('ERROR: req.user is undefined - authentication middleware issue');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    if (!req.user.userId) {
      console.log('ERROR: req.user.userId is undefined:', req.user);
      return res.status(401).json({ success: false, message: 'Invalid authentication data' });
    }
    
    console.log('4. Comparing userIds:', req.user.userId.toString(), 'vs', userId);
    
    // Security check: ensure authenticated user can only access their own profile
    if (req.user.userId.toString() !== userId) {
      console.log('ERROR: Access denied - user trying to access different profile');
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    console.log('5. Security check passed, fetching user...');
    
    // Check if user exists first
    const user = await User.findById(userId);
    console.log('6. User found:', !!user);
    
    if (!user) {
      console.log('ERROR: User not found in database');
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const isStartup = user.role === 'STARTUP';
    console.log('7. User role:', user.role, 'isStartup:', isStartup);
    
    // Only check for profile if user is a STARTUP
    let profile = null;
    let hasProfile = false;
    let isProfileComplete = false;
    
    if (isStartup) {
      console.log('8. Fetching company profile...');
      profile = await CompanyProfile.findOne({ userId });
      console.log('9. Profile found:', !!profile);
      
      hasProfile = !!profile;
      
      // More comprehensive profile completion check
      if (hasProfile && profile) {
        isProfileComplete = !!(
          profile.consentGiven &&
          profile.companyName && 
          profile.founderName && 
          profile.email &&
          profile.companyCreationDate &&
          profile.activityDomain &&
          profile.projectProgress &&
          profile.staffRange
        );
        console.log('10. Profile completion check:', isProfileComplete);
      }
    }
    
    console.log('11. Sending response...');
    res.json({
      success: true,
      data: {
        isStartup,
        hasProfile,
        isProfileComplete,
        profile: hasProfile ? profile : null
      }
    });
    
  } catch (error) {
    console.error('=== ERROR in checkProfileCompletion ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get all company profiles (admin only)
const getAllCompanyProfiles = async (req, res) => {
  try {
    const profiles = await CompanyProfile.find().populate('userId', 'username email firstName lastName role');
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error('Error getting all company profiles:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update request status (admin only)
const updateRequestStatus = async (req, res) => {
  try {
    const { profileId } = req.params;
    const { requestStatus, responseDate } = req.body;
    
    if (!Object.values(RequestStatus).includes(requestStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid request status' });
    }
    
    const profile = await CompanyProfile.findByIdAndUpdate(
      profileId,
      { 
        requestStatus, 
        responseDate: responseDate || new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    
    res.json({ success: true, data: profile, message: 'Request status updated successfully' });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get enums for frontend
const getEnums = async (req, res) => {
  try {
    const enums = {
      ActivityDomain,
      ActivitySubDomain,
      ProjectProgress,
      StaffRange,
      RequestStatus,
      CompanyStage,
      LabelType,
      SupportNeeded
    };
    
    res.json({ success: true, data: enums });
  } catch (error) {
    console.error('Error getting enums:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getCompanyProfile,
  createOrUpdateCompanyProfile,
  checkProfileCompletion,
  getAllCompanyProfiles,
  updateRequestStatus,
  getEnums,
  getCompanyStatistics, // NEW
  generateCompanyReportPDF // NEW
};