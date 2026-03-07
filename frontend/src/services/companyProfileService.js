const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Service pour la gestion des profils d'entreprise avec nouveaux indicateurs
class CompanyProfileService {
  // Récupérer le profil d'une entreprise
  async getCompanyProfile(userId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Récupérer les détails d'une entreprise (pour le dashboard)
  async getCompanyDetail(companyId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/detail/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des détails:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Créer un nouveau profil d'entreprise
  async createCompanyProfile(profileData) {
    try {
      const token = localStorage.getItem('token');
      const userId = profileData.userId;
      const response = await fetch(`${API_URL}/api/company-profile/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la création du profil:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Mettre à jour un profil d'entreprise existant
  async updateCompanyProfile(userId, profileData) {
    try {
      const token = localStorage.getItem('token');
      // Backend currently exposes POST for create/update on same endpoint
      const response = await fetch(`${API_URL}/api/company-profile/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Récupérer les statistiques globales (pour le dashboard)
  async getStatistics() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Télécharger le rapport PDF d'une entreprise
  async downloadPDFReport(companyId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/${companyId}/report`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-entreprise-${companyId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        return { success: true, message: 'Rapport téléchargé avec succès' };
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.message || 'Échec du téléchargement' };
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement du rapport:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Récupérer tous les profils d'entreprise (pour l'aperçu)
  async getAllCompanyProfiles() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des profils:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Vérifier l'existence d'un profil
  async checkProfileExists(userId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/check/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la vérification du profil:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Récupérer les enums pour les formulaires
  async getEnums() {
    try {
      const response = await fetch(`${API_URL}/api/company-profile/enums`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la récupération des enums:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }

  // Supprimer un profil d'entreprise
  async deleteCompanyProfile(userId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erreur lors de la suppression du profil:', error);
      return { success: false, message: 'Erreur de connexion au serveur' };
    }
  }
}

// Export de l'instance du service
const companyProfileService = new CompanyProfileService();
export default companyProfileService; 