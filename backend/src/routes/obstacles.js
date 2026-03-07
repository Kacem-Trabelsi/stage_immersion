// backend/src/routes/obstacles.js
const express = require('express');
const router = express.Router();
const {
  createObstacle,
  getAllObstacles,
  getObstacleById,
  updateObstacle,
  deleteObstacle,
  addComment,
  getObstacleStatistics,
  assignObstacle
} = require('../controllers/obstacleController');

// Import du middleware d'authentification depuis app.js
// Note: Le middleware authenticateToken sera importé depuis app.js

// 📝 Routes pour les obstacles

// POST /api/obstacles - Créer un nouvel obstacle (accessible sans authentification pour permettre les signalements anonymes)
router.post('/', createObstacle);

// GET /api/obstacles - Récupérer tous les obstacles (avec pagination et filtres)
router.get('/', getAllObstacles);

// GET /api/obstacles/statistics - Récupérer les statistiques des obstacles
router.get('/statistics', getObstacleStatistics);

// GET /api/obstacles/:id - Récupérer un obstacle par ID
router.get('/:id', getObstacleById);

// PUT /api/obstacles/:id - Mettre à jour un obstacle
router.put('/:id', updateObstacle);

// DELETE /api/obstacles/:id - Supprimer un obstacle
router.delete('/:id', deleteObstacle);

// POST /api/obstacles/:id/comments - Ajouter un commentaire à un obstacle
router.post('/:id/comments', addComment);

// PUT /api/obstacles/:id/assign - Assigner un obstacle à un utilisateur
router.put('/:id/assign', assignObstacle);

module.exports = router;