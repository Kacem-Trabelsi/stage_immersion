// src/hooks/useCompanyProfile.tsx
import { useState, useEffect, useCallback } from 'react';
import companyProfileService from '../services/companyProfileService';

// Types pour les nouveaux indicateurs
interface CompanyProfile {
  _id?: string;
  userId: string;
  consentGiven: boolean;
  companyName: string;
  founderName: string;
  email: string;
  phone?: string;
  companyCreationDate: string;
  activityDomain: string;
  activitySubDomain?: string;
  projectProgress: string;
  staffRange: string;
  address?: string;
  // Optional identity and site info
  slogan?: string;
  logo?: string;
  website?: string;
  longDescription?: string;
  businessPlanSummary?: string;
  staffPositions?: string;
  targetMarket?: string;
  requestStatus: string;
  createdAt?: string;
  updatedAt?: string;
  
  // --- NOUVEAUX INDICATEURS ---
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  sectors: string[];
  qualityCertification: boolean;
  certificationDetails?: string;
  projectStage: 'IDEA' | 'PROTOTYPE' | 'PILOT' | 'MARKET_ENTRY' | 'SCALING';
  workforce: number;
  blockingFactors: string[];
  interventionsNeeded: string[];
  projectNotes?: string;
  
  // --- STATISTIQUES CALCULÉES ---
  statistics?: {
    genderDistribution: { male: number; female: number; other: number };
    sectorDistribution: { [key: string]: number };
    certificationRate: number;
    projectStageDistribution: { [key: string]: number };
    workforceDistribution: { [key: string]: number };
    blockingFactorsAnalysis: { [key: string]: number };
    interventionsAnalysis: { [key: string]: number };
  };
}

interface UseCompanyProfileReturn {
  // Données
  companyProfile: CompanyProfile | null;
  statistics: any;
  loading: boolean;
  error: string | null;
  
  // Actions
  createOrUpdateProfile: (data: Partial<CompanyProfile>) => Promise<boolean>;
  fetchProfile: () => Promise<void>;
  fetchStatistics: () => Promise<void>;
  downloadPDFReport: (companyId: string) => Promise<void>;
  
  // États
  isCreating: boolean;
  isUpdating: boolean;
  isDownloading: boolean;
}

export const useCompanyProfile = (userId?: string): UseCompanyProfileReturn => {
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Récupérer le profil de l'entreprise
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await companyProfileService.getCompanyProfile(userId!);
      if (response.success) {
        setCompanyProfile(response.data);
        return;
      }

      // No existing profile yet is a valid STARTUP state
      const notFound =
        response?.message === 'Company profile not found' ||
        response?.message === 'Profil d\'entreprise non trouvé';
      if (notFound) {
        setCompanyProfile(null);
        setError(null);
      } else {
        setError(response.message || 'Échec de la récupération du profil');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la récupération du profil');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Récupérer les statistiques
  const fetchStatistics = async () => {
    try {
      const response = await companyProfileService.getStatistics();
      if (response.success) {
        setStatistics(response.data);
      }
    } catch (err: any) {
      console.error('Erreur lors de la récupération des statistiques:', err);
    }
  };

  // Créer ou mettre à jour le profil
  const createOrUpdateProfile = async (data: Partial<CompanyProfile>): Promise<boolean> => {
    if (!userId) {
      setError('ID utilisateur requis pour créer/mettre à jour le profil');
      return false;
    }

    const isUpdate = !!companyProfile?._id;
    setIsCreating(!isUpdate);
    setIsUpdating(isUpdate);
    setError(null);

    try {
      let response;
      
      if (isUpdate) {
        response = await companyProfileService.updateCompanyProfile(userId, data);
      } else {
        response = await companyProfileService.createCompanyProfile({ ...data, userId });
      }

      if (response.success) {
        setCompanyProfile(response.data);
        return true;
      } else {
        setError(response.message || `Échec de la ${isUpdate ? 'mise à jour' : 'création'} du profil`);
        return false;
      }
    } catch (err: any) {
      setError(err.message || `Erreur lors de la ${isUpdate ? 'mise à jour' : 'création'} du profil`);
      return false;
    } finally {
      setIsCreating(false);
      setIsUpdating(false);
    }
  };

  // Télécharger le rapport PDF
  const downloadPDFReport = async (companyId: string) => {
    setIsDownloading(true);
    setError(null);

    try {
      const response = await companyProfileService.downloadPDFReport(companyId);
      if (response.success) {
        // Le téléchargement est géré par le service
        console.log('Rapport PDF téléchargé avec succès');
      } else {
        setError(response.message || 'Échec du téléchargement du rapport');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du téléchargement du rapport');
    } finally {
      setIsDownloading(false);
    }
  };

  // Charger le profil au montage du composant
  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId, fetchProfile]);

  return {
    companyProfile,
    statistics,
    loading,
    error,
    createOrUpdateProfile,
    fetchProfile,
    fetchStatistics,
    downloadPDFReport,
    isCreating,
    isUpdating,
    isDownloading,
  };
};