const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { CompanyProfile } = require('../models/CompanyProfile');

// Helper: attach company profile logos to ticket users and comments
const attachCommentAuthorLogos = async (ticketDoc) => {
  try {
    if (!ticketDoc) return ticketDoc;
    const ticket = typeof ticketDoc.toObject === 'function' ? ticketDoc.toObject() : ticketDoc;
    const comments = Array.isArray(ticket.comments) ? ticket.comments : [];

    // Collect all userIds from ticket owner/assignee + comment authors
    const startupUserIds = new Set();

    if (ticket.reportedBy && ticket.reportedBy._id) {
      startupUserIds.add(ticket.reportedBy._id.toString());
    }
    if (ticket.assignedTo && ticket.assignedTo._id) {
      startupUserIds.add(ticket.assignedTo._id.toString());
    }
    comments.forEach((c) => {
      const author = c && c.authorId;
      if (author && author._id) {
        startupUserIds.add(author._id.toString());
      }
    });

    if (startupUserIds.size === 0) {
      return ticket;
    }

    // Fetch company profiles to get logos
    const profiles = await CompanyProfile.find(
      { userId: { $in: Array.from(startupUserIds) } },
      'userId logo'
    ).lean();

    const userIdToLogo = new Map(
      profiles.map((p) => [p.userId.toString(), p.logo || ''])
    );

    // Override ticket owner/assignee images when company profile logo exists
    if (ticket.reportedBy && ticket.reportedBy._id) {
      const logo = userIdToLogo.get(ticket.reportedBy._id.toString());
      if (logo && typeof logo === 'string' && logo.trim()) {
        ticket.reportedBy.profilePhoto = logo;
        ticket.reportedBy.avatar = logo;
      }
    }
    if (ticket.assignedTo && ticket.assignedTo._id) {
      const logo = userIdToLogo.get(ticket.assignedTo._id.toString());
      if (logo && typeof logo === 'string' && logo.trim()) {
        ticket.assignedTo.profilePhoto = logo;
        ticket.assignedTo.avatar = logo;
      }
    }

    // Override comment author images when company profile logo exists
    ticket.comments = comments.map((c) => {
      if (c && c.authorId && c.authorId._id) {
        const logo = userIdToLogo.get(c.authorId._id.toString());
        if (logo && typeof logo === 'string' && logo.trim()) {
          // Keep backward compatibility with frontend expecting profilePhoto/avatar
          c.authorId.profilePhoto = logo;
          c.authorId.avatar = logo;
          c.authorCompanyLogo = logo;
        }
      }
      return c;
    });

    return ticket;
  } catch (e) {
    // In case of any failure, return original doc to avoid breaking responses
    return typeof ticketDoc.toObject === 'function' ? ticketDoc.toObject() : ticketDoc;
  }
};

// Créer un nouveau ticket
const createTicket = async (req, res) => {
  try {
    // Role policy: only STARTUP can create tickets
    if (!req.user || req.user.role !== 'STARTUP') {
      return res.status(403).json({
        success: false,
        message: 'Seule la session STARTUP peut créer un ticket'
      });
    }

    const {
      title,
      description,
      category,
      priority,
      impact,
      contactEmail,
      contactPhone,
      companyName,
      proposedSolution,
      dueDate,
      tags,
      isUrgent,
      isPublic
    } = req.body;
    let normalizedContactEmail = contactEmail;

    // Validation des champs requis
    if (!title || !description || !category || !priority || !impact || !contactEmail || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis'
      });
    }

    // Si l'utilisateur est connecté, s'assurer que l'email correspond à son email
    if (req.user) {
      const userEmail = req.user.email;
      if (normalizedContactEmail !== userEmail) {
        console.log('Email mismatch - User email:', userEmail, 'Contact email:', contactEmail);
        // Forcer l'email de l'utilisateur connecté
        normalizedContactEmail = userEmail;
      }
    }

    // Créer le ticket
    const ticket = new Ticket({
      title,
      description,
      category,
      priority,
      impact,
      contactEmail: normalizedContactEmail,
      contactPhone: contactPhone || '',
      companyName,
      proposedSolution: proposedSolution || '',
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: tags || [],
      isUrgent: isUrgent || false,
      isPublic: isPublic || false,
      reportedBy: req.user ? (req.user.userId || req.user._id) : null
    });

    // Log pour debug
    console.log('Création du ticket:', {
      title: ticket.title,
      reportedBy: ticket.reportedBy,
      userFromToken: req.user ? (req.user.userId || req.user._id) : 'No user',
      contactEmail: ticket.contactEmail,
      companyName: ticket.companyName
    });

    await ticket.save();

    const createdTicket = await Ticket.findById(ticket._id)
      .populate('reportedBy', 'firstName lastName email role avatar profilePhoto')
      .populate('assignedTo', 'firstName lastName email role avatar profilePhoto')
      .populate('comments.authorId', 'firstName lastName email role avatar profilePhoto');
    const createdTicketWithLogos = await attachCommentAuthorLogos(createdTicket);

    res.status(201).json({
      success: true,
      message: 'Ticket créé avec succès',
      data: createdTicketWithLogos
    });
  } catch (error) {
    console.error('Erreur lors de la création du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du ticket',
      error: error.message
    });
  }
};

// Récupérer tous les tickets avec pagination et filtres
const getAllTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      priority,
      assignedTo,
      reportedBy,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Construction du filtre
    const filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (reportedBy) filter.reportedBy = reportedBy;
    // Role policy: EXPERT can only view public tickets
    if (req.user && req.user.role === 'EXPERT') {
      filter.isPublic = true;
    }
    
    // Recherche textuelle
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    // Options de tri
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await Ticket.find(filter)
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const totalTickets = await Ticket.countDocuments(filter);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTickets / parseInt(limit)),
        totalTickets,
        hasNext: skip + tickets.length < totalTickets,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tickets',
      error: error.message
    });
  }
};

// Récupérer un ticket par ID
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findById(id)
      .populate('reportedBy', 'firstName lastName email role avatar profilePhoto')
      .populate('assignedTo', 'firstName lastName email role avatar profilePhoto')
      .populate('comments.authorId', 'firstName lastName email role avatar profilePhoto');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    // Role policy: EXPERT cannot access private tickets
    if (req.user && req.user.role === 'EXPERT' && ticket.isPublic !== true) {
      return res.status(403).json({
        success: false,
        message: 'Ce ticket est privé'
      });
    }

    const ticketWithLogos = await attachCommentAuthorLogos(ticket);

    res.json({
      success: true,
      data: ticketWithLogos
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du ticket',
      error: error.message
    });
  }
};

// Mettre à jour un ticket
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user ? (req.user.userId || req.user._id) : null;

    // EXPERT can only reply (comments), not update ticket fields
    if (!req.user || req.user.role !== 'STARTUP') {
      return res.status(403).json({
        success: false,
        message: 'Seule la session STARTUP peut modifier ce ticket'
      });
    }

    // Vérifier que le ticket existe
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    // STARTUP can only modify its own ticket
    if (!ticket.reportedBy || ticket.reportedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce ticket'
      });
    }

    // Mettre à jour le ticket
    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('reportedBy', 'firstName lastName email')
     .populate('assignedTo', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Ticket mis à jour avec succès',
      data: updatedTicket
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du ticket',
      error: error.message
    });
  }
};

// Supprimer un ticket
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Ticket supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du ticket',
      error: error.message
    });
  }
};

// Ajouter un commentaire à un ticket
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Le contenu du commentaire est requis'
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    const authorId = req.user ? req.user.userId || req.user._id : null;
    if (!authorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise pour ajouter un commentaire'
      });
    }

    await ticket.addComment(content, authorId, isInternal);

    const updatedTicket = await Ticket.findById(id)
      .populate('comments.authorId', 'firstName lastName email role avatar profilePhoto');

    const ticketWithLogos = await attachCommentAuthorLogos(updatedTicket);

    res.json({
      success: true,
      message: 'Commentaire ajouté avec succès',
      data: ticketWithLogos
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du commentaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du commentaire',
      error: error.message
    });
  }
};

// Assigner un ticket à un utilisateur
const assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'L\'utilisateur assigné est requis'
      });
    }

    // Vérifier que l'utilisateur assigné existe
    const user = await User.findById(assignedTo);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur assigné non trouvé'
      });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { assignedTo },
      { new: true, runValidators: true }
    ).populate('reportedBy', 'firstName lastName email')
     .populate('assignedTo', 'firstName lastName email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Ticket assigné avec succès',
      data: ticket
    });
  } catch (error) {
    console.error('Erreur lors de l\'assignation du ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'assignation du ticket',
      error: error.message
    });
  }
};

// Mettre à jour le statut d'un ticket
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user ? (req.user.userId || req.user._id) : null;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket non trouvé'
      });
    }

    // Role policy: only STARTUP can change status
    if (!req.user || req.user.role !== 'STARTUP') {
      return res.status(403).json({
        success: false,
        message: 'Seule la session STARTUP peut changer le statut'
      });
    }

    // STARTUP can only change status for own tickets
    if (!ticket.reportedBy || ticket.reportedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce ticket'
      });
    }

    // Authorization: STARTUP users can only use allowed statuses
    try {
      // STARTUP users can change status between OPEN, IN_PROGRESS, PENDING, and RESOLVED
      const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED'];
      if (!allowedStatuses.includes(status)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Les startups ne peuvent pas fermer les tickets (statut CLOSED réservé aux administrateurs)' 
        });
      }
    } catch (authErr) {
      console.error('Auth error in updateTicketStatus:', authErr);
      return res.status(403).json({ success: false, message: 'Autorisation invalide' });
    }

    await ticket.updateStatus(status);

    const updatedTicket = await Ticket.findById(id)
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Statut du ticket mis à jour avec succès',
      data: updatedTicket
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

// Réagir à un ticket (LIKE/LOVE)
const reactToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'LIKE' | 'LOVE'
    const userId = req.user ? (req.user.userId || req.user._id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }
    if (!['LIKE', 'LOVE'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type de réaction invalide' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    await ticket.toggleReaction(type, userId);
    const updated = await Ticket.findById(id)
      .populate('reportedBy', 'firstName lastName email role avatar profilePhoto')
      .populate('assignedTo', 'firstName lastName email role avatar profilePhoto')
      .populate('comments.authorId', 'firstName lastName email role avatar profilePhoto');

    const ticketWithLogos = await attachCommentAuthorLogos(updated);

    res.json({ success: true, message: 'Réaction mise à jour', data: ticketWithLogos });
  } catch (error) {
    console.error('Erreur lors de la réaction au ticket:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réaction', error: error.message });
  }
};

// Réagir à un commentaire (LIKE/LOVE)
const reactToComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { type } = req.body; // 'LIKE' | 'LOVE'
    const userId = req.user ? (req.user.userId || req.user._id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }
    if (!['LIKE', 'LOVE'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type de réaction invalide' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    await ticket.toggleCommentReaction(commentId, type, userId);
    const updated = await Ticket.findById(id)
      .populate('reportedBy', 'firstName lastName email role avatar profilePhoto')
      .populate('assignedTo', 'firstName lastName email role avatar profilePhoto')
      .populate('comments.authorId', 'firstName lastName email role avatar profilePhoto');

    const ticketWithLogos = await attachCommentAuthorLogos(updated);

    res.json({ success: true, message: 'Réaction mise à jour', data: ticketWithLogos });
  } catch (error) {
    console.error('Erreur lors de la réaction au commentaire:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la réaction', error: error.message });
  }
};

// Supprimer un commentaire (auteur uniquement)
const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user ? (req.user.userId || req.user._id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket non trouvé' });
    }

    const comment = ticket.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Commentaire non trouvé' });
    }

    if (comment.authorId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorisé à supprimer ce commentaire' });
    }

    comment.deleteOne();
    await ticket.save();

    const updated = await Ticket.findById(id)
      .populate('reportedBy', 'firstName lastName email role avatar profilePhoto')
      .populate('assignedTo', 'firstName lastName email role avatar profilePhoto')
      .populate('comments.authorId', 'firstName lastName email role avatar profilePhoto');

    const ticketWithLogos = await attachCommentAuthorLogos(updated);

    res.json({ success: true, message: 'Commentaire supprimé', data: ticketWithLogos });
  } catch (error) {
    console.error('Erreur lors de la suppression du commentaire:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression', error: error.message });
  }
};

// Récupérer les statistiques des tickets
const getTicketStatistics = async (req, res) => {
  try {
    // Calculer les dates pour les comparaisons
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    // Statistiques actuelles
    const stats = await Ticket.aggregate([
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          openTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] }
          },
          inProgressTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] }
          },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] }
          },
          closedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] }
          },
          urgentTickets: {
            $sum: { $cond: ['$isUrgent', 1, 0] }
          }
        }
      }
    ]);

    // Statistiques des 30 derniers jours
    const recentStats = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          recentTotalTickets: { $sum: 1 },
          recentOpenTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] }
          },
          recentResolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] }
          }
        }
      }
    ]);

    // Statistiques des 30 jours précédents (pour calculer la croissance)
    const previousStats = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          previousTotalTickets: { $sum: 1 },
          previousOpenTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] }
          },
          previousResolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] }
          }
        }
      }
    ]);

    // Calculer les pourcentages de croissance
    const calculateGrowthPercentage = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const currentStats = stats[0] || {
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0
    };

    const recentData = recentStats[0] || {
      recentTotalTickets: 0,
      recentOpenTickets: 0,
      recentResolvedTickets: 0
    };

    const previousData = previousStats[0] || {
      previousTotalTickets: 0,
      previousOpenTickets: 0,
      previousResolvedTickets: 0
    };

    // Calculer les pourcentages de croissance
    const totalGrowthPercentage = calculateGrowthPercentage(
      recentData.recentTotalTickets,
      previousData.previousTotalTickets
    );

    const openGrowthPercentage = calculateGrowthPercentage(
      recentData.recentOpenTickets,
      previousData.previousOpenTickets
    );

    const resolvedGrowthPercentage = calculateGrowthPercentage(
      recentData.recentResolvedTickets,
      previousData.previousResolvedTickets
    );

    const categoryStats = await Ticket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const priorityStats = await Ticket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          ...currentStats,
          totalTickets: currentStats.totalTickets || 0,
          openTickets: currentStats.openTickets || 0,
          inProgressTickets: currentStats.inProgressTickets || 0,
          resolvedTickets: currentStats.resolvedTickets || 0,
          closedTickets: currentStats.closedTickets || 0,
          urgentTickets: currentStats.urgentTickets || 0,
          // Ajouter les pourcentages de croissance
          growthPercentages: {
            totalTickets: Math.round(totalGrowthPercentage * 100) / 100,
            openTickets: Math.round(openGrowthPercentage * 100) / 100,
            resolvedTickets: Math.round(resolvedGrowthPercentage * 100) / 100
          }
        },
        byCategory: categoryStats,
        byPriority: priorityStats
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

// Récupérer les tickets de l'utilisateur connecté
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const {
      page = 1,
      limit = 10,
      status,
      category,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Construction du filtre pour l'utilisateur connecté
    const filter = { reportedBy: userId };
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    
    // Recherche textuelle
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    // Options de tri
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await Ticket.find(filter)
      .populate('reportedBy', 'firstName lastName email avatar profilePhoto')
      .populate('assignedTo', 'firstName lastName email avatar profilePhoto')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const totalTickets = await Ticket.countDocuments(filter);

    console.log(`Récupération des tickets pour l'utilisateur ${userId}: ${tickets.length} tickets trouvés`);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalTickets / parseInt(limit)),
        totalTickets,
        hasNext: skip + tickets.length < totalTickets,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tickets de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de vos tickets',
      error: error.message
    });
  }
};

// Récupérer les énumérations
const getEnums = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        categories: Object.values(Ticket.Category),
        priorities: Object.values(Ticket.Priority),
        statuses: Object.values(Ticket.Status),
        impacts: Object.values(Ticket.Impact)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des énumérations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des énumérations',
      error: error.message
    });
  }
};

module.exports = {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  addComment,
  assignTicket,
  updateTicketStatus,
  reactToTicket,
  reactToComment,
  deleteComment,
  getTicketStatistics,
  getEnums,
  getMyTickets
};
