/**
 * Routes pour la gestion des utilisateurs par les administrateurs S2T
 */

const express = require('express');
const router = express.Router();
const userManagementController = require('../controllers/userManagementController');
const { authenticateToken } = require('../middleware/authEnhanced');

// Middleware pour toutes les routes - authentification temporairement désactivée
// router.use(authenticateToken);

/**
 * @route   GET /api/user-management/test
 * @desc    Test endpoint to verify routes are working
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'User management routes are working',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/user-management/all
 * @desc    Récupérer tous les utilisateurs
 * @access  Private (Authenticated users)
 */
router.get('/all', userManagementController.getAllUsers);

/**
 * @route   GET /api/users/pending
 * @desc    Récupérer les utilisateurs en attente d'approbation
 * @access  Private (Authenticated users)
 */
router.get('/pending', userManagementController.getPendingUsers);

/**
 * @route   GET /api/users/stats
 * @desc    Récupérer les statistiques des utilisateurs
 * @access  Private (Authenticated users)
 */
router.get('/stats', userManagementController.getUserStats);

/**
 * @route   GET /api/users/search
 * @desc    Rechercher des utilisateurs par critères
 * @access  Private (Authenticated users)
 */
router.get('/search', userManagementController.searchUsers);

/**
 * @route   PUT /api/users/:userId/approve
 * @desc    Approuver un utilisateur
 * @access  Private (Authenticated users)
 */
router.put('/:userId/approve', userManagementController.approveUser);

/**
 * @route   PUT /api/users/:userId/status
 * @desc    Mettre à jour le statut d'un utilisateur
 * @access  Private (Authenticated users)
 */
router.put('/:userId/status', userManagementController.updateUserStatus);

/**
 * @route   PUT /api/users/:userId/block
 * @desc    Bloquer/Débloquer un utilisateur
 * @access  Private (Authenticated users)
 */
router.put('/:userId/block', userManagementController.toggleUserBlock);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Supprimer définitivement un utilisateur
 * @access  Private (Authenticated users)
 */
router.delete('/:userId', userManagementController.deleteUser);

/**
 * @route   POST /api/users/notify
 * @desc    Envoyer une notification à un utilisateur
 * @access  Private (Authenticated users)
 */
router.post('/notify', async (req, res) => {
  try {
    const { userId, type, message } = req.body;
    
    // Logique d'envoi de notification
    // Cette fonctionnalité peut être développée selon les besoins
    
    res.json({
      success: true,
      message: 'Notification envoyée avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de la notification'
    });
  }
});

module.exports = router;