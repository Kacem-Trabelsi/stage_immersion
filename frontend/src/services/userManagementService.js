/**
 * Service de gestion des utilisateurs pour les utilisateurs S2T
 * Gère l'approbation, la suppression et le statut des comptes utilisateurs
 */

import apiClient from './apiService';

// Fonction utilitaire pour nettoyer les tokens invalides
const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
  // Optionnel: rediriger vers la page de connexion
  console.log('Tokens expirés - données d\'authentification supprimées');
};

/**
 * Récupérer tous les utilisateurs (réservé aux utilisateurs S2T)
 * @returns {Promise<Object>} Liste des utilisateurs avec leurs informations
 */
export const getAllUsers = async () => {
  try {
    const response = await apiClient.get('/api/user-management/all');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    throw error;
  }
};

/**
 * Récupérer uniquement les utilisateurs en attente d'approbation
 * @returns {Promise<Object>} Liste des utilisateurs en attente
 */
export const getPendingUsers = async () => {
  try {
    const response = await apiClient.get('/api/user-management/pending');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs en attente:', error);
    throw error;
  }
};

/**
 * Approuver un compte utilisateur
 * @param {string} userId - ID de l'utilisateur à approuver
 * @returns {Promise<Object>} Résultat de l'approbation
 */
export const approveUser = async (userId) => {
  try {
    const response = await apiClient.put(`/api/user-management/${userId}/approve`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de l\'approbation de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Rejeter/Supprimer un compte utilisateur
 * @param {string} userId - ID de l'utilisateur à supprimer
 * @param {string} reason - Raison de la suppression (optionnel)
 * @returns {Promise<Object>} Résultat de la suppression
 */
export const deleteUser = async (userId, reason = '') => {
  try {
    const response = await apiClient.delete(`/api/user-management/${userId}`, {
      data: { reason }
    });
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    throw error;
  }
};

/**
 * Mettre à jour le statut d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} status - Nouveau statut ('PENDING', 'APPROVED', 'REJECTED')
 * @returns {Promise<Object>} Résultat de la mise à jour
 */
export const updateUserStatus = async (userId, status) => {
  try {
    const response = await apiClient.put(`/api/user-management/${userId}/status`, { status });
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error);
    throw error;
  }
};

/**
 * Bloquer/Débloquer un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {boolean} blocked - État de blocage
 * @returns {Promise<Object>} Résultat du blocage/déblocage
 */
export const toggleUserBlock = async (userId, blocked) => {
  try {
    const response = await apiClient.put(`/api/user-management/${userId}/block`, { blocked });
    return response.data;
  } catch (error) {
    console.error('Erreur lors du blocage/déblocage:', error);
    throw error;
  }
};

/**
 * Obtenir les statistiques des utilisateurs
 * @returns {Promise<Object>} Statistiques des utilisateurs par statut et rôle
 */
export const getUserStats = async () => {
  try {
    const response = await apiClient.get('/api/user-management/stats');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    throw error;
  }
};

/**
 * Rechercher des utilisateurs par critères
 * @param {Object} criteria - Critères de recherche (role, status, email, etc.)
 * @returns {Promise<Object>} Résultats de la recherche
 */
export const searchUsers = async (criteria) => {
  try {
    const params = new URLSearchParams();
    
    Object.entries(criteria).forEach(([key, value]) => {
      if (value && value !== '') {
        params.append(key, value);
      }
    });

    const response = await apiClient.get(`/api/user-management/search?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    throw error;
  }
};

/**
 * Envoyer une notification à un utilisateur après approbation/rejet
 * @param {string} userId - ID de l'utilisateur
 * @param {string} type - Type de notification ('APPROVED', 'REJECTED')
 * @param {string} message - Message personnalisé (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export const notifyUser = async (userId, type, message = '') => {
  try {
    const response = await apiClient.post('/api/user-management/notify', { userId, type, message });
    return response.data;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification:', error);
    throw error;
  }
};

const userManagementService = {
  getAllUsers,
  getPendingUsers,
  approveUser,
  deleteUser,
  updateUserStatus,
  toggleUserBlock,
  getUserStats,
  searchUsers,
  notifyUser,
  clearAuthData
};

export { clearAuthData };
export default userManagementService;