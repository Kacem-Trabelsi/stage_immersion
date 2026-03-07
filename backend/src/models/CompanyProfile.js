const mongoose = require('mongoose');

// Enums based on your data
const ActivityDomain = Object.freeze({
  IT_DIGITALIZATION:     'IT_DIGITALIZATION',
  AGRITECH:              'AGRITECH',
  HEALTH_TECH:           'HEALTH_TECH',
  FINTECH:               'FINTECH',
  INDUSTRY:              'INDUSTRY',
  IA:                    'IA',                  // Artificial Intelligence
  CYBER_SECURITY:        'CYBER_SECURITY',
  E_LEARNING:            'E_LEARNING',
  MOBILITY_SMART_CITY:   'MOBILITY_SMART_CITY',
  MECATRONICH:           'MECATRONICH',
  OTHER:                 'OTHER'
});

const ActivitySubDomain = Object.freeze({
  SOFTWARE_DEVELOPMENT:  'SOFTWARE_DEVELOPMENT',
  MOBILE_APPS:           'MOBILE_APPS',
  WEB_DEVELOPMENT:       'WEB_DEVELOPMENT',
  CLOUD_COMPUTING:       'CLOUD_COMPUTING',
  BLOCKCHAIN:            'BLOCKCHAIN',
  IOT:                   'IOT',
  ROBOTICS:              'ROBOTICS',
  BIOTECH:               'BIOTECH',
  GREEN_TECH:            'GREEN_TECH',
  EDUTECH:               'EDUTECH',
  OTHER:                 'OTHER'
});

const ProjectProgress = Object.freeze({
  IDEA_STAGE:            'IDEA_STAGE',
  PROTOTYPE:             'PROTOTYPE',
  MVP:                   'MVP',
  PRE_SEED:              'PRE_SEED',
  SEED:                  'SEED',
  PRE_SERIES_A:          'PRE_SERIES_A',
  SERIES_A:              'SERIES_A',
  SERIES_B:              'SERIES_B',
  GROWTH:                'GROWTH',
  SCALE:                 'SCALE'
});

const StaffRange = Object.freeze({
  SOLO_FOUNDER:          'SOLO_FOUNDER',
  LESS_THAN_5:           'LESS_THAN_5',
  BETWEEN_5_10:          'BETWEEN_5_10',
  BETWEEN_10_25:         'BETWEEN_10_25',
  BETWEEN_25_50:         'BETWEEN_25_50',
  MORE_THAN_50:          'MORE_THAN_50'
});

const RequestStatus = Object.freeze({
  PENDING:               'PENDING',
  APPROVED:              'APPROVED',
  REJECTED:              'REJECTED',
  IN_PROGRESS:           'IN_PROGRESS',
  UNDER_REVIEW:          'UNDER_REVIEW'
});

const CompanyStage = Object.freeze({
  STARTUP:               'STARTUP',
  DEVELOPMENT:           'DEVELOPMENT',
  GROWTH:                'GROWTH',
  MATURE:                'MATURE',
  SCALE_UP:              'SCALE_UP'
});

const LabelType = Object.freeze({
  STARTUP_LABEL:         'STARTUP_LABEL',
  INNOVATION_LABEL:      'INNOVATION_LABEL',
  TECH_LABEL:            'TECH_LABEL',
  GREEN_LABEL:           'GREEN_LABEL',
  SOCIAL_LABEL:          'SOCIAL_LABEL',
  OTHER:                 'OTHER'
});

const SupportNeeded = Object.freeze({
  FUNDING:               'FUNDING',
  MENTORSHIP:            'MENTORSHIP',
  NETWORKING:            'NETWORKING',
  TECHNICAL_SUPPORT:     'TECHNICAL_SUPPORT',
  MARKETING:             'MARKETING',
  LEGAL_ADVICE:          'LEGAL_ADVICE',
  HR_SUPPORT:            'HR_SUPPORT',
  INFRASTRUCTURE:        'INFRASTRUCTURE',
  OTHER:                 'OTHER'
});

const companyProfileSchema = new mongoose.Schema({
  // Link to user
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Basic Information
  consentGiven: { type: Boolean, required: true, default: false },
  companyName: { type: String, required: true },
  founderName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  companyCreationDate: { type: Date, required: true },
  
  // Activity & Domain
  activityDomain: { type: String, enum: Object.values(ActivityDomain), required: true },
  activitySubDomain: { type: String, enum: [...Object.values(ActivitySubDomain), ''], default: '' },
  
  // Project & Progress
  projectProgress: { type: String, enum: Object.values(ProjectProgress), required: true },
  stage: { type: String, enum: Object.values(CompanyStage), default: CompanyStage.STARTUP },
  
  // Staff & Organization
  staffRange: { type: String, enum: Object.values(StaffRange), required: true },
  staffPositions: { type: String, default: '' }, // Free text for positions
  
  // Approval & Status
  approval: { type: Boolean, default: false }, // Information whether the user approved the data
  requestStatus: { type: String, enum: Object.values(RequestStatus), default: RequestStatus.PENDING },
  responseDate: { type: Date, default: null },
  
  // Labeling & Classification
  isLabeled: { type: Boolean, default: false },
  labelType: { type: String, enum: [...Object.values(LabelType), ''], default: '' },
  
  // Challenges & Barriers
  barriers: { type: String, default: '' }, // The company's challenges
  otherBarriers: { type: String, default: '' }, // Other barriers
  
  // Support & Recommendations
  supportNeeded: { type: String, default: '' }, // Types of support the company deserves
  supportNeededOther: { type: String, default: '' }, // Other types of support
  recommendations: { type: String, default: '' }, // Advice
  
  // Company Identity
  slogan: { type: String, default: '' }, // An image of the company's logo
  logo: { type: String, default: '' }, // Logo file path
  
  // Business Information
  businessPlanSummary: { type: String, default: '' }, // A summary of the business plan
  marketAnalysis: { type: String, default: '' }, // Market analysis
  targetMarket: { type: String, default: '' }, // Target market
  competitors: { type: String, default: '' }, // Competitors
  competitiveAdvantage: { type: String, default: '' }, // Competitive advantage
  riskFactors: { type: String, default: '' }, // Risk factors
  
  // Recognition & Values
  awards: { type: String, default: '' }, // Awards the company has received
  values: { type: String, default: '' }, // Company values
  
  // Additional Information
  longDescription: { type: String, default: '' }, // A long description of the company
  website: { type: String, default: '' },
  address: { type: String, default: '' },
  
  // --- INDICATORS (RAW DATA) ---
  gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], required: true }, // Gender of founder or team lead
  sectors: [{ type: String }], // List of business sectors (e.g., ['TECHNOLOGY', 'AGRICULTURE'])
  qualityCertification: { type: Boolean, default: false }, // Has quality certification?
  certificationDetails: { type: String, default: '' }, // Details if certified
  projectStage: { type: String, enum: ['IDEA', 'PROTOTYPE', 'PILOT', 'MARKET_ENTRY', 'SCALING'], required: true },
  workforce: { type: Number, default: 0 }, // Number of employees
  blockingFactors: [{ type: String }], // List of blocking factors
  interventionsNeeded: [{ type: String }], // List of required interventions
  projectNotes: { type: String, default: '' }, // Notes/observations (SWOT, etc.)

  // --- INDICATORS (COMPUTED STATISTICS) ---
  statistics: {
    genderDistribution: { male: Number, female: Number, other: Number, total: Number },
    sectorDistribution: { type: Map, of: Number },
    certificationRate: { labeled: Number, unlabeled: Number, total: Number },
    projectStageDistribution: { idea: Number, prototype: Number, pilot: Number, marketEntry: Number, scaling: Number, total: Number },
    workforceDistribution: { '0_5': Number, '5_10': Number, '10_20': Number, '20_plus': Number, total: Number },
    blockingFactorsCount: { type: Map, of: Number },
    interventionsCount: { type: Map, of: Number }
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
companyProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = {
  CompanyProfile: mongoose.model('CompanyProfile', companyProfileSchema),
  ActivityDomain,
  ActivitySubDomain,
  ProjectProgress,
  StaffRange,
  RequestStatus,
  CompanyStage,
  LabelType,
  SupportNeeded
}; 