// backend/src/controllers/obstacleController.js
const { 
  Obstacle, 
  ObstacleStatus, 
  ObstaclePriority, 
  ObstacleCategory, 
  ObstacleImpact 
} = require('../models/Obstacle');
const { User } = require('../models/User');

// 📊 Logging Helper Functions
const logInfo = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ℹ️  OBSTACLE INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const logError = (message, error = null, req = null) => {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    message,
    error: error?.message || error,
    stack: error?.stack,
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('User-Agent'),
    timestamp
  };
  console.error(`[${timestamp}] ❌ OBSTACLE ERROR: ${message}`, JSON.stringify(errorDetails, null, 2));
};

const logSuccess = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ✅ OBSTACLE SUCCESS: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// 🔒 Error Response Helper
const sendErrorResponse = (res, statusCode, message, code = null, details = null) => {
  const response = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  return res.status(statusCode).json(response);
};

// ✅ Success Response Helper
const sendSuccessResponse = (res, statusCode, message, data = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
};

// 📝 Créer un nouvel obstacle
const createObstacle = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      impact,
      contactEmail,
      contactPhone,
      proposedSolution,
      tags
    } = req.body;

    logInfo('Tentative de création d\'obstacle', { 
      title, 
      category, 
      priority, 
      impact,
      reportedBy: req.user?.username || 'Anonymous'
    });

    // Validation des champs requis
    if (!title || !description || !category || !priority || !impact || !contactEmail) {
      logError('Création d\'obstacle échouée - champs manquants', null, req);
      return sendErrorResponse(res, 400, 'Les champs titre, description, catégorie, priorité, impact et email de contact sont requis', 'MISSING_FIELDS');
    }

    // Validation des énumérations
    if (!Object.values(ObstacleCategory).includes(category)) {
      logError('Création d\'obstacle échouée - catégorie invalide', { category }, req);
      return sendErrorResponse(res, 400, 'Catégorie invalide', 'INVALID_CATEGORY');
    }

    if (!Object.values(ObstaclePriority).includes(priority)) {
      logError('Création d\'obstacle échouée - priorité invalide', { priority }, req);
      return sendErrorResponse(res, 400, 'Priorité invalide', 'INVALID_PRIORITY');
    }

    if (!Object.values(ObstacleImpact).includes(impact)) {
      logError('Création d\'obstacle échouée - impact invalide', { impact }, req);
      return sendErrorResponse(res, 400, 'Impact invalide', 'INVALID_IMPACT');
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      logError('Création d\'obstacle échouée - email invalide', { contactEmail }, req);
      return sendErrorResponse(res, 400, 'Format d\'email invalide', 'INVALID_EMAIL');
    }

    // Création de l'obstacle
    const obstacleData = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      impact,
      contactEmail: contactEmail.toLowerCase().trim(),
      contactPhone: contactPhone ? contactPhone.trim() : '',
      proposedSolution: proposedSolution ? proposedSolution.trim() : '',
      tags: tags ? tags.map(tag => tag.toLowerCase().trim()) : [],
      reportedBy: req.user ? req.user._id : null
    };

    const newObstacle = new Obstacle(obstacleData);
    await newObstacle.save();

    // Populate les références utilisateur
    await newObstacle.populate('reportedBy', 'username email firstName lastName');

    logSuccess('Obstacle créé avec succès', { 
      obstacleId: newObstacle._id, 
      title: newObstacle.title,
      reportedBy: req.user?.username || 'Anonymous'
    });

    sendSuccessResponse(res, 201, 'Obstacle signalé avec succès', {
      obstacle: newObstacle
    });

  } catch (err) {
    logError('Erreur lors de la création d\'obstacle', err, req);
    
    if (err.name === 'ValidationError') {
      const errors = Object.keys(err.errors).map(key => ({
        field: key,
        message: err.errors[key].message
      }));
      return sendErrorResponse(res, 400, 'Erreur de validation', 'VALIDATION_ERROR', { errors });
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de la création de l\'obstacle', 'CREATE_OBSTACLE_ERROR', { error: err.message });
  }
};

// 📋 Récupérer tous les obstacles (avec pagination et filtres)
const getAllObstacles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      priority,
      impact,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    logInfo('Récupération des obstacles', { 
      page, 
      limit, 
      status, 
      category, 
      priority,
      requestedBy: req.user?.username 
    });

    // Construction du filtre
    const filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (impact) filter.impact = impact;
    
    // Recherche textuelle
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Configuration du tri
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calcul de la pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Exécution de la requête
    const obstacles = await Obstacle.find(filter)
      .populate('reportedBy', 'username email firstName lastName')
      .populate('assignedTo', 'username email firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Obstacle.countDocuments(filter);

    logSuccess('Obstacles récupérés', { 
      count: obstacles.length, 
      total, 
      page, 
      requestedBy: req.user?.username 
    });

    sendSuccessResponse(res, 200, 'Obstacles récupérés avec succès', {
      obstacles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (err) {
    logError('Erreur lors de la récupération des obstacles', err, req);
    sendErrorResponse(res, 500, 'Erreur lors de la récupération des obstacles', 'FETCH_OBSTACLES_ERROR', { error: err.message });
  }
};

// 🔍 Récupérer un obstacle par ID
const getObstacleById = async (req, res) => {
  try {
    const { id } = req.params;

    logInfo('Récupération d\'un obstacle', { 
      obstacleId: id, 
      requestedBy: req.user?.username 
    });

    const obstacle = await Obstacle.findById(id)
      .populate('reportedBy', 'username email firstName lastName')
      .populate('assignedTo', 'username email firstName lastName')
      .populate('comments.user', 'username email firstName lastName');

    if (!obstacle) {
      logError('Obstacle non trouvé', { obstacleId: id }, req);
      return sendErrorResponse(res, 404, 'Obstacle non trouvé', 'OBSTACLE_NOT_FOUND');
    }

    // Incrémenter le compteur de vues
    obstacle.viewCount += 1;
    await obstacle.save();

    logSuccess('Obstacle récupéré', { 
      obstacleId: id, 
      title: obstacle.title,
      requestedBy: req.user?.username 
    });

    sendSuccessResponse(res, 200, 'Obstacle récupéré avec succès', {
      obstacle
    });

  } catch (err) {
    logError('Erreur lors de la récupération de l\'obstacle', err, req);
    
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID d\'obstacle invalide', 'INVALID_OBSTACLE_ID');
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de la récupération de l\'obstacle', 'FETCH_OBSTACLE_ERROR', { error: err.message });
  }
};

// ✏️ Mettre à jour un obstacle
const updateObstacle = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logInfo('Mise à jour d\'un obstacle', { 
      obstacleId: id, 
      updates: Object.keys(updateData),
      updatedBy: req.user?.username 
    });

    // Vérifier que l'obstacle existe
    const existingObstacle = await Obstacle.findById(id);
    if (!existingObstacle) {
      logError('Mise à jour échouée - obstacle non trouvé', { obstacleId: id }, req);
      return sendErrorResponse(res, 404, 'Obstacle non trouvé', 'OBSTACLE_NOT_FOUND');
    }

    // Validation des énumérations si présentes
    if (updateData.category && !Object.values(ObstacleCategory).includes(updateData.category)) {
      logError('Mise à jour échouée - catégorie invalide', { category: updateData.category }, req);
      return sendErrorResponse(res, 400, 'Catégorie invalide', 'INVALID_CATEGORY');
    }

    if (updateData.priority && !Object.values(ObstaclePriority).includes(updateData.priority)) {
      logError('Mise à jour échouée - priorité invalide', { priority: updateData.priority }, req);
      return sendErrorResponse(res, 400, 'Priorité invalide', 'INVALID_PRIORITY');
    }

    if (updateData.impact && !Object.values(ObstacleImpact).includes(updateData.impact)) {
      logError('Mise à jour échouée - impact invalide', { impact: updateData.impact }, req);
      return sendErrorResponse(res, 400, 'Impact invalide', 'INVALID_IMPACT');
    }

    if (updateData.status && !Object.values(ObstacleStatus).includes(updateData.status)) {
      logError('Mise à jour échouée - statut invalide', { status: updateData.status }, req);
      return sendErrorResponse(res, 400, 'Statut invalide', 'INVALID_STATUS');
    }

    // Mise à jour de l'obstacle
    const updatedObstacle = await Obstacle.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('reportedBy assignedTo', 'username email firstName lastName');

    logSuccess('Obstacle mis à jour', { 
      obstacleId: id, 
      title: updatedObstacle.title,
      updatedBy: req.user?.username 
    });

    sendSuccessResponse(res, 200, 'Obstacle mis à jour avec succès', {
      obstacle: updatedObstacle
    });

  } catch (err) {
    logError('Erreur lors de la mise à jour de l\'obstacle', err, req);
    
    if (err.name === 'ValidationError') {
      const errors = Object.keys(err.errors).map(key => ({
        field: key,
        message: err.errors[key].message
      }));
      return sendErrorResponse(res, 400, 'Erreur de validation', 'VALIDATION_ERROR', { errors });
    }
    
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID d\'obstacle invalide', 'INVALID_OBSTACLE_ID');
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de la mise à jour de l\'obstacle', 'UPDATE_OBSTACLE_ERROR', { error: err.message });
  }
};

// 🗑️ Supprimer un obstacle
const deleteObstacle = async (req, res) => {
  try {
    const { id } = req.params;

    logInfo('Suppression d\'un obstacle', { 
      obstacleId: id, 
      deletedBy: req.user?.username 
    });

    const deletedObstacle = await Obstacle.findByIdAndDelete(id);

    if (!deletedObstacle) {
      logError('Suppression échouée - obstacle non trouvé', { obstacleId: id }, req);
      return sendErrorResponse(res, 404, 'Obstacle non trouvé', 'OBSTACLE_NOT_FOUND');
    }

    logSuccess('Obstacle supprimé', { 
      obstacleId: id, 
      title: deletedObstacle.title,
      deletedBy: req.user?.username 
    });

    sendSuccessResponse(res, 200, 'Obstacle supprimé avec succès', {
      deletedObstacle: {
        id: deletedObstacle._id,
        title: deletedObstacle.title
      }
    });

  } catch (err) {
    logError('Erreur lors de la suppression de l\'obstacle', err, req);
    
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID d\'obstacle invalide', 'INVALID_OBSTACLE_ID');
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de la suppression de l\'obstacle', 'DELETE_OBSTACLE_ERROR', { error: err.message });
  }
};

// 💬 Ajouter un commentaire à un obstacle
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    logInfo('Ajout de commentaire', { 
      obstacleId: id, 
      commentedBy: req.user?.username 
    });

    if (!comment || comment.trim().length === 0) {
      logError('Ajout de commentaire échoué - commentaire vide', null, req);
      return sendErrorResponse(res, 400, 'Le commentaire ne peut pas être vide', 'EMPTY_COMMENT');
    }

    const obstacle = await Obstacle.findById(id);
    if (!obstacle) {
      logError('Ajout de commentaire échoué - obstacle non trouvé', { obstacleId: id }, req);
      return sendErrorResponse(res, 404, 'Obstacle non trouvé', 'OBSTACLE_NOT_FOUND');
    }

    await obstacle.addComment(req.user._id, comment.trim());
    await obstacle.populate('comments.user', 'username email firstName lastName');

    logSuccess('Commentaire ajouté', { 
      obstacleId: id, 
      commentedBy: req.user?.username 
    });

    sendSuccessResponse(res, 200, 'Commentaire ajouté avec succès', {
      obstacle
    });

  } catch (err) {
    logError('Erreur lors de l\'ajout du commentaire', err, req);
    
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID d\'obstacle invalide', 'INVALID_OBSTACLE_ID');
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de l\'ajout du commentaire', 'ADD_COMMENT_ERROR', { error: err.message });
  }
};

// 📊 Récupérer les statistiques des obstacles
const getObstacleStatistics = async (req, res) => {
  try {
    logInfo('Récupération des statistiques des obstacles', { 
      requestedBy: req.user?.username 
    });

    const stats = await Obstacle.getStatistics();

    // Statistiques par catégorie
    const categoryStats = await Obstacle.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Statistiques par priorité
    const priorityStats = await Obstacle.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Temps de résolution moyen
    const resolutionStats = await Obstacle.aggregate([
      {
        $match: {
          status: ObstacleStatus.RESOLVED,
          resolvedAt: { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          minResolutionTime: { $min: '$resolutionTime' },
          maxResolutionTime: { $max: '$resolutionTime' }
        }
      }
    ]);

    logSuccess('Statistiques récupérées', { 
      requestedBy: req.user?.username 
    });

    sendSuccessResponse(res, 200, 'Statistiques récupérées avec succès', {
      general: stats,
      byCategory: categoryStats,
      byPriority: priorityStats,
      resolution: resolutionStats[0] || {
        avgResolutionTime: 0,
        minResolutionTime: 0,
        maxResolutionTime: 0
      }
    });

  } catch (err) {
    logError('Erreur lors de la récupération des statistiques', err, req);
    sendErrorResponse(res, 500, 'Erreur lors de la récupération des statistiques', 'FETCH_STATISTICS_ERROR', { error: err.message });
  }
};

// 🎯 Assigner un obstacle à un utilisateur
const assignObstacle = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    logInfo('Assignation d\'obstacle', { 
      obstacleId: id, 
      assignedTo, 
      assignedBy: req.user?.username 
    });

    if (!assignedTo) {
      logError('Assignation échouée - utilisateur non spécifié', null, req);
      return sendErrorResponse(res, 400, 'L\'utilisateur à assigner est requis', 'MISSING_ASSIGNEE');
    }

    // Vérifier que l'utilisateur assigné existe
    const assignee = await User.findById(assignedTo);
    if (!assignee) {
      logError('Assignation échouée - utilisateur assigné non trouvé', { assignedTo }, req);
      return sendErrorResponse(res, 404, 'Utilisateur assigné non trouvé', 'ASSIGNEE_NOT_FOUND');
    }

    const obstacle = await Obstacle.findById(id);
    if (!obstacle) {
      logError('Assignation échouée - obstacle non trouvé', { obstacleId: id }, req);
      return sendErrorResponse(res, 404, 'Obstacle non trouvé', 'OBSTACLE_NOT_FOUND');
    }

    await obstacle.assignTo(assignedTo);
    await obstacle.populate('reportedBy assignedTo', 'username email firstName lastName');

    logSuccess('Obstacle assigné', { 
      obstacleId: id, 
      assignedTo: assignee.username,
      assignedBy: req.user?.username 
    });

    sendSuccessResponse(res, 200, 'Obstacle assigné avec succès', {
      obstacle
    });

  } catch (err) {
    logError('Erreur lors de l\'assignation de l\'obstacle', err, req);
    
    if (err.name === 'CastError') {
      return sendErrorResponse(res, 400, 'ID invalide', 'INVALID_ID');
    }
    
    sendErrorResponse(res, 500, 'Erreur lors de l\'assignation de l\'obstacle', 'ASSIGN_OBSTACLE_ERROR', { error: err.message });
  }
};

module.exports = {
  createObstacle,
  getAllObstacles,
  getObstacleById,
  updateObstacle,
  deleteObstacle,
  addComment,
  getObstacleStatistics,
  assignObstacle
};
