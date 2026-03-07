/**
 * Contrôleur de gestion des utilisateurs
 * Gère l'approbation, le rejet et la gestion des comptes utilisateurs
 * Accessible à tous les utilisateurs authentifiés
 */

const { User } = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../services/emailService');

class UserManagementController {
  
  /**
   * Récupérer tous les utilisateurs
   */
  async getAllUsers(req, res) {
    try {
      console.log('getAllUsers called - Starting query...');
      
      // Simple query first to test database connection
      const users = await User.find({})
        .select('-password')
        .sort({ createdAt: -1 });
      
      console.log(`getAllUsers - Found ${users.length} users`);
      
      res.json({
        success: true,
        data: users,
        total: users.length
      });
    } catch (error) {
      console.error('Erreur getAllUsers - Full error:', error);
      console.error('Error stack:', error.stack);
      
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des utilisateurs',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Récupérer uniquement les utilisateurs en attente
   */
  async getPendingUsers(req, res) {
    try {
      const pendingUsers = await User.find({ status: 'PENDING' })
        .select('-password')
        .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: pendingUsers,
        total: pendingUsers.length
      });
    } catch (error) {
      console.error('Erreur getPendingUsers:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des utilisateurs en attente'
      });
    }
  }

  /**
   * Approuver un utilisateur
   */
  async approveUser(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findByIdAndUpdate(
        userId,
        {
          status: 'APPROVED',
          approvedBy: req.user ? req.user._id : null,
          approvedAt: new Date()
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Envoyer un email de notification d'approbation
      try {
        await sendEmail({
          to: user.email,
          subject: 'Compte approuvé - SynergyPark',
          template: 'account-approved',
          data: {
            firstName: user.firstName,
            lastName: user.lastName,
            loginUrl: `${process.env.FRONTEND_URL}/login`
          }
        });
      } catch (emailError) {
        console.error('Erreur envoi email:', emailError);
        // Ne pas faire échouer la requête si l'email échoue
      }

      // Log de l'action pour audit
      console.log(`[AUDIT] Utilisateur approuvé - ID: ${userId}, Par: ${req.user ? req.user.email : 'System'}, Date: ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: 'Utilisateur approuvé avec succès',
        data: user
      });
    } catch (error) {
      console.error('Erreur approveUser:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'approbation de l\'utilisateur'
      });
    }
  }

  /**
   * Rejeter/Supprimer un utilisateur
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      // Vérifier que l'utilisateur existe
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Autoriser la suppression pour tous les utilisateurs
      // Note: Plus de restrictions de rôle S2T

      // Envoyer un email de notification de rejet avant suppression
      try {
        await sendEmail({
          to: targetUser.email,
          subject: 'Demande de compte rejetée - SynergyPark',
          template: 'account-rejected',
          data: {
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            reason: reason || 'Aucune raison spécifiée',
            supportEmail: process.env.SUPPORT_EMAIL
          }
        });
      } catch (emailError) {
        console.error('Erreur envoi email rejet:', emailError);
      }

      // Supprimer l'utilisateur
      await User.findByIdAndDelete(userId);

      // Log de l'action pour audit
      console.log(`[AUDIT] Utilisateur supprimé - ID: ${userId}, Email: ${targetUser.email}, Par: ${req.user ? req.user.email : 'System'}, Raison: ${reason}, Date: ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: 'Utilisateur supprimé avec succès'
      });
    } catch (error) {
      console.error('Erreur deleteUser:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression de l\'utilisateur'
      });
    }
  }

  /**
   * Mettre à jour le statut d'un utilisateur
   */
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      // Valider le statut
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Statut invalide. Valeurs acceptées: PENDING, APPROVED, REJECTED'
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { 
          status,
          ...(status === 'APPROVED' && { approvedBy: req.user ? req.user._id : null, approvedAt: new Date() })
        },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      res.json({
        success: true,
        message: 'Statut utilisateur mis à jour avec succès',
        data: user
      });
    } catch (error) {
      console.error('Erreur updateUserStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du statut'
      });
    }
  }

  /**
   * Bloquer/Débloquer un utilisateur
   */
  async toggleUserBlock(req, res) {
    try {
      const { userId } = req.params;
      const { blocked } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        { blocked: Boolean(blocked) },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Log de l'action
      console.log(`[AUDIT] Utilisateur ${blocked ? 'bloqué' : 'débloqué'} - ID: ${userId}, Par: ${req.user ? req.user.email : 'System'}, Date: ${new Date().toISOString()}`);

      res.json({
        success: true,
        message: `Utilisateur ${blocked ? 'bloqué' : 'débloqué'} avec succès`,
        data: user
      });
    } catch (error) {
      console.error('Erreur toggleUserBlock:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du blocage/déblocage'
      });
    }
  }

  /**
   * Obtenir les statistiques des utilisateurs
   */
  async getUserStats(req, res) {
    try {
      console.log('getUserStats called - Starting query...');
      
      const [
        total,
        pending,
        approved,
        rejected,
        byRole
      ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ status: 'PENDING' }),
        User.countDocuments({ status: 'APPROVED' }),
        User.countDocuments({ status: 'REJECTED' }),
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ])
      ]);

      const roleStats = {};
      byRole.forEach(item => {
        roleStats[item._id] = item.count;
      });

      console.log('getUserStats - Stats calculated:', { total, pending, approved, rejected, roleStats });

      res.json({
        success: true,
        data: {
          total,
          pending,
          approved,
          rejected,
          byRole: roleStats
        }
      });
    } catch (error) {
      console.error('Erreur getUserStats - Full error:', error);
      console.error('Error stack:', error.stack);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * Rechercher des utilisateurs par critères
   */
  async searchUsers(req, res) {
    try {
      const { role, status, email, firstName, lastName } = req.query;
      
      let query = {};
      
      if (role) query.role = role;
      if (status) query.status = status;
      if (email) query.email = { $regex: email, $options: 'i' };
      if (firstName) query.firstName = { $regex: firstName, $options: 'i' };
      if (lastName) query.lastName = { $regex: lastName, $options: 'i' };

      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: users,
        total: users.length
      });
    } catch (error) {
      console.error('Erreur searchUsers:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche'
      });
    }
  }
}

module.exports = new UserManagementController();