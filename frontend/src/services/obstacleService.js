// frontend/src/services/obstacleService.js
import apiClient from './apiService';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// 📝 Service pour la gestion des obstacles
class ObstacleService {
  
  // Créer un nouvel obstacle
  static async createObstacle(obstacleData) {
    try {
      const response = await apiClient.post('/api/obstacles', obstacleData);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la création de l\'obstacle:', error);
      throw error;
    }
  }

  // Récupérer tous les obstacles avec pagination et filtres
  static async getAllObstacles(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      // Ajouter les paramètres de pagination
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      // Ajouter les filtres
      if (params.status) queryParams.append('status', params.status);
      if (params.category) queryParams.append('category', params.category);
      if (params.priority) queryParams.append('priority', params.priority);
      if (params.impact) queryParams.append('impact', params.impact);
      if (params.search) queryParams.append('search', params.search);
      
      // Ajouter les paramètres de tri
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const url = `/api/obstacles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des obstacles:', error);
      throw error;
    }
  }

  // Récupérer un obstacle par ID
  static async getObstacleById(id) {
    try {
      const response = await apiClient.get(`/api/obstacles/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'obstacle:', error);
      throw error;
    }
  }

  // Mettre à jour un obstacle
  static async updateObstacle(id, updateData) {
    try {
      const response = await apiClient.put(`/api/obstacles/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'obstacle:', error);
      throw error;
    }
  }

  // Supprimer un obstacle
  static async deleteObstacle(id) {
    try {
      const response = await apiClient.delete(`/api/obstacles/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'obstacle:', error);
      throw error;
    }
  }

  // Ajouter un commentaire à un obstacle
  static async addComment(id, comment) {
    try {
      const response = await apiClient.post(`/api/obstacles/${id}/comments`, { comment });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      throw error;
    }
  }

  // Assigner un obstacle à un utilisateur
  static async assignObstacle(id, assignedTo) {
    try {
      const response = await apiClient.put(`/api/obstacles/${id}/assign`, { assignedTo });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'assignation de l\'obstacle:', error);
      throw error;
    }
  }

  // Récupérer les statistiques des obstacles
  static async getObstacleStatistics() {
    try {
      const response = await apiClient.get('/api/obstacles/statistics');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  }

  // Méthodes utilitaires pour les énumérations
  static getObstacleCategories() {
    return [
      { value: 'TECHNICAL', label: 'Problème Technique' },
      { value: 'ADMINISTRATIVE', label: 'Problème Administratif' },
      { value: 'RESOURCES', label: 'Manque de Ressources' },
      { value: 'TRAINING', label: 'Besoin de Formation' },
      { value: 'COMMUNICATION', label: 'Problème de Communication' },
      { value: 'PROCESS', label: 'Amélioration de Processus' },
      { value: 'OTHER', label: 'Autre' }
    ];
  }

  static getObstaclePriorities() {
    return [
      { value: 'LOW', label: 'Faible' },
      { value: 'MEDIUM', label: 'Moyenne' },
      { value: 'HIGH', label: 'Élevée' },
      { value: 'CRITICAL', label: 'Critique' }
    ];
  }

  static getObstacleImpacts() {
    return [
      { value: 'MINIMAL', label: 'Impact Minimal' },
      { value: 'MODERATE', label: 'Impact Modéré' },
      { value: 'IMPORTANT', label: 'Impact Important' },
      { value: 'CRITICAL', label: 'Impact Critique' }
    ];
  }

  static getObstacleStatuses() {
    return [
      { value: 'PENDING', label: 'En attente' },
      { value: 'IN_PROGRESS', label: 'En cours de traitement' },
      { value: 'RESOLVED', label: 'Résolu' },
      { value: 'CLOSED', label: 'Fermé' },
      { value: 'CANCELLED', label: 'Annulé' }
    ];
  }

  // Méthode pour formater les données du formulaire pour l'API
  static formatObstacleData(formData) {
    return {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      impact: formData.impact,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone || '',
      proposedSolution: formData.proposedSolution || '',
      tags: formData.tags || []
    };
  }

  // Méthode pour valider les données du formulaire
  static validateObstacleData(formData) {
    const errors = {};

    if (!formData.title || formData.title.trim().length === 0) {
      errors.title = 'Le titre est requis';
    } else if (formData.title.length > 200) {
      errors.title = 'Le titre ne peut pas dépasser 200 caractères';
    }

    if (!formData.description || formData.description.trim().length === 0) {
      errors.description = 'La description est requise';
    } else if (formData.description.length > 2000) {
      errors.description = 'La description ne peut pas dépasser 2000 caractères';
    }

    if (!formData.category || formData.category === 'Select') {
      errors.category = 'La catégorie est requise';
    }

    if (!formData.priority || formData.priority === 'Select') {
      errors.priority = 'La priorité est requise';
    }

    if (!formData.impact || formData.impact === 'Select') {
      errors.impact = 'L\'impact est requis';
    }

    if (!formData.contactEmail || formData.contactEmail.trim().length === 0) {
      errors.contactEmail = 'L\'email de contact est requis';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contactEmail)) {
        errors.contactEmail = 'Format d\'email invalide';
      }
    }

    if (formData.proposedSolution && formData.proposedSolution.length > 1000) {
      errors.proposedSolution = 'La solution proposée ne peut pas dépasser 1000 caractères';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}

export default ObstacleService;
