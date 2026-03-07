import apiClient from './apiService';

const ticketService = {
  // Créer un nouveau ticket
  createTicket: async (ticketData) => {
    try {
      const response = await apiClient.post('/api/tickets', ticketData);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la création du ticket:', error);
      throw error;
    }
  },

  // Récupérer tous les tickets avec pagination et filtres
  getAllTickets: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      // Ajouter les paramètres de pagination
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      
      // Ajouter les filtres
      if (params.status) queryParams.append('status', params.status);
      if (params.category) queryParams.append('category', params.category);
      if (params.priority) queryParams.append('priority', params.priority);
      if (params.assignedTo) queryParams.append('assignedTo', params.assignedTo);
      if (params.reportedBy) queryParams.append('reportedBy', params.reportedBy);
      if (params.search) queryParams.append('search', params.search);
      
      // Ajouter les options de tri
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/api/tickets?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des tickets:', error);
      throw error;
    }
  },

  // Récupérer un ticket par ID
  getTicketById: async (id) => {
    try {
      const response = await apiClient.get(`/api/tickets/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération du ticket:', error);
      throw error;
    }
  },

  // Mettre à jour un ticket
  updateTicket: async (id, updateData) => {
    try {
      const response = await apiClient.put(`/api/tickets/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du ticket:', error);
      throw error;
    }
  },

  // Supprimer un ticket
  deleteTicket: async (id) => {
    try {
      const response = await apiClient.delete(`/api/tickets/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la suppression du ticket:', error);
      throw error;
    }
  },

  // Ajouter un commentaire à un ticket
  addComment: async (id, commentData) => {
    try {
      const response = await apiClient.post(`/api/tickets/${id}/comments`, commentData);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
      throw error;
    }
  },

  // Supprimer un commentaire (auteur uniquement)
  deleteComment: async (id, commentId) => {
    try {
      const response = await apiClient.delete(`/api/tickets/${id}/comments/${commentId}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la suppression du commentaire:', error);
      throw error;
    }
  },

  // Assigner un ticket à un utilisateur
  assignTicket: async (id, assignedTo) => {
    try {
      const response = await apiClient.put(`/api/tickets/${id}/assign`, { assignedTo });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'assignation du ticket:', error);
      throw error;
    }
  },

  // Mettre à jour le statut d'un ticket
  updateTicketStatus: async (id, status) => {
    try {
      const response = await apiClient.put(`/api/tickets/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      throw error;
    }
  },

  // Récupérer les statistiques des tickets
  getTicketStatistics: async () => {
    try {
      const response = await apiClient.get('/api/tickets/statistics');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  },

  // Récupérer les énumérations (catégories, priorités, statuts, impacts)
  getEnums: async () => {
    try {
      const response = await apiClient.get('/api/tickets/enums');
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des énumérations:', error);
      throw error;
    }
  },

  // Récupérer les tickets par statut
  getTicketsByStatus: async (status, params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('status', status);
      
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/api/tickets?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des tickets par statut:', error);
      throw error;
    }
  },

  // Récupérer les tickets par catégorie
  getTicketsByCategory: async (category, params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('category', category);
      
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/api/tickets?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des tickets par catégorie:', error);
      throw error;
    }
  },

  // Récupérer les tickets urgents
  getUrgentTickets: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('priority', 'URGENT');
      
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/api/tickets?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des tickets urgents:', error);
      throw error;
    }
  },

  // Rechercher des tickets
  searchTickets: async (searchTerm, params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('search', searchTerm);
      
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.status) queryParams.append('status', params.status);
      if (params.category) queryParams.append('category', params.category);
      if (params.priority) queryParams.append('priority', params.priority);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/api/tickets?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la recherche des tickets:', error);
      throw error;
    }
  },

  // Récupérer les tickets de l'utilisateur connecté
  getMyTickets: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.status) queryParams.append('status', params.status);
      if (params.category) queryParams.append('category', params.category);
      if (params.priority) queryParams.append('priority', params.priority);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const response = await apiClient.get(`/api/tickets/my-tickets?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération de mes tickets:', error);
      throw error;
    }
  },

  // Réagir à un ticket (LIKE/LOVE)
  reactToTicket: async (id, type) => {
    try {
      const response = await apiClient.post(`/api/tickets/${id}/reactions`, { type });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la réaction au ticket:', error);
      throw error;
    }
  },

  // Réagir à un commentaire (LIKE/LOVE)
  reactToComment: async (id, commentId, type) => {
    try {
      const response = await apiClient.post(`/api/tickets/${id}/comments/${commentId}/reactions`, { type });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la réaction au commentaire:', error);
      throw error;
    }
  }
};

export default ticketService;
