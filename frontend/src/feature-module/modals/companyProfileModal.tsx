// src/feature-module/modals/companyProfileModal.tsx
import React, { useState, useEffect } from 'react';
import { useUser } from '../../hooks/useUser';
import companyProfileService from '../../services/companyProfileService';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData
}) => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enums, setEnums] = useState<any>(null);

  // Formulaire avec tous les nouveaux indicateurs
  const [formData, setFormData] = useState({
    // --- INFORMATIONS DE BASE ---
    consentGiven: false,
    companyName: '',
    founderName: '',
    email: '',
    companyCreationDate: '',
    
    // --- DOMAINE D'ACTIVITÉ ---
    activityDomain: '',
    activitySubDomain: '',
    
    // --- PROJET ET PROGRÈS ---
    projectProgress: '',
    
    // --- EFFECTIF ET ORGANISATION ---
    staffRange: '',
    
    // --- ADRESSE ---
    address: '',
    
    // --- NOUVEAUX INDICATEURS ---
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    sectors: [] as string[],
    qualityCertification: false,
    certificationDetails: '',
    projectStage: 'IDEA' as 'IDEA' | 'PROTOTYPE' | 'PILOT' | 'MARKET_ENTRY' | 'SCALING',
    workforce: 0,
    blockingFactors: [] as string[],
    interventionsNeeded: [] as string[],
    projectNotes: '',
  });

  // Charger les enums au montage
  useEffect(() => {
    loadEnums();
  }, []);

  // Charger les données initiales si fournies
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const loadEnums = async () => {
    try {
      const response = await companyProfileService.getEnums();
      if (response.success) {
        setEnums(response.data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des enums:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field: string, value: string, action: 'add' | 'remove') => {
    setFormData(prev => {
      const currentArray = prev[field as keyof typeof prev] as string[];
      if (action === 'add' && !currentArray.includes(value)) {
        return { ...prev, [field]: [...currentArray, value] };
      } else if (action === 'remove') {
        return { ...prev, [field]: currentArray.filter(item => item !== value) };
      }
      return prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userId = user?._id;
      if (!userId) {
        setError('Utilisateur non identifié');
        return;
      }

      const response = await companyProfileService.createCompanyProfile({
        ...formData,
        userId
      });

      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.message || 'Échec de la sauvegarde du profil');
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Profil de l'Entreprise - Indicateurs S2T</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {/* INFORMATIONS DE BASE */}
              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-primary mb-3">
                    <i className="fas fa-info-circle me-2"></i>
                    Informations de Base
                  </h6>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Nom de l'Entreprise *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Nom du Fondateur *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.founderName}
                      onChange={(e) => handleInputChange('founderName', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Date de Création *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.companyCreationDate}
                      onChange={(e) => handleInputChange('companyCreationDate', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* NOUVEAUX INDICATEURS */}
              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-success mb-3">
                    <i className="fas fa-chart-line me-2"></i>
                    Indicateurs de Performance
                  </h6>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Genre du Fondateur *</label>
                    <select
                      className="form-select"
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      <option value="MALE">Homme</option>
                      <option value="FEMALE">Femme</option>
                      <option value="OTHER">Autre</option>
                    </select>
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Étape du Projet *</label>
                    <select
                      className="form-select"
                      value={formData.projectStage}
                      onChange={(e) => handleInputChange('projectStage', e.target.value)}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      <option value="IDEA">Idée</option>
                      <option value="PROTOTYPE">Prototype</option>
                      <option value="PILOT">Pilote</option>
                      <option value="MARKET_ENTRY">Entrée Marché</option>
                      <option value="SCALING">Mise à l'Échelle</option>
                    </select>
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Effectif (Nombre d'employés)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.workforce}
                      onChange={(e) => handleInputChange('workforce', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Certification Qualité</label>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formData.qualityCertification}
                        onChange={(e) => handleInputChange('qualityCertification', e.target.checked)}
                      />
                      <label className="form-check-label">
                        L'entreprise possède une certification qualité
                      </label>
                    </div>
                  </div>
                </div>
                
                {formData.qualityCertification && (
                  <div className="col-12">
                    <div className="form-group mb-3">
                      <label className="form-label">Détails de la Certification</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.certificationDetails}
                        onChange={(e) => handleInputChange('certificationDetails', e.target.value)}
                        placeholder="Décrivez les certifications obtenues..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTEURS D'ACTIVITÉ */}
              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-info mb-3">
                    <i className="fas fa-industry me-2"></i>
                    Secteurs d'Activité
                  </h6>
                </div>
                
                <div className="col-12">
                  <div className="form-group mb-3">
                    <label className="form-label">Secteurs d'Activité</label>
                    <div className="row">
                      {['Technologie', 'Agriculture', 'Santé', 'Éducation', 'Finance', 'Commerce', 'Transport', 'Énergie', 'Environnement', 'Tourisme'].map((sector) => (
                        <div key={sector} className="col-md-4 mb-2">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={formData.sectors.includes(sector)}
                              onChange={(e) => handleArrayChange('sectors', sector, e.target.checked ? 'add' : 'remove')}
                            />
                            <label className="form-check-label">{sector}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* FACTEURS DE BLOCAGE */}
              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-warning mb-3">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    Facteurs de Blocage
                  </h6>
                </div>
                
                <div className="col-12">
                  <div className="form-group mb-3">
                    <label className="form-label">Facteurs de Blocage Identifiés</label>
                    <div className="row">
                      {['Accès au Financement', 'Conformité Réglementaire', 'Accès au Marché', 'Expertise Technique', 'Infrastructure', 'Ressources Humaines'].map((factor) => (
                        <div key={factor} className="col-md-6 mb-2">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={formData.blockingFactors.includes(factor)}
                              onChange={(e) => handleArrayChange('blockingFactors', factor, e.target.checked ? 'add' : 'remove')}
                            />
                            <label className="form-check-label">{factor}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* INTERVENTIONS REQUISES */}
              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-danger mb-3">
                    <i className="fas fa-hands-helping me-2"></i>
                    Interventions Requises
                  </h6>
                </div>
                
                <div className="col-12">
                  <div className="form-group mb-3">
                    <label className="form-label">Types d'Interventions Nécessaires</label>
                    <div className="row">
                      {['Consultation Stratégie', 'Formation Technique', 'Assistance Financière', 'Support Marché', 'Facilitation Réseautage', 'Mentorat'].map((intervention) => (
                        <div key={intervention} className="col-md-6 mb-2">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={formData.interventionsNeeded.includes(intervention)}
                              onChange={(e) => handleArrayChange('interventionsNeeded', intervention, e.target.checked ? 'add' : 'remove')}
                            />
                            <label className="form-check-label">{intervention}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* INFORMATIONS TRADITIONNELLES */}
              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-secondary mb-3">
                    <i className="fas fa-building me-2"></i>
                    Informations de l'Entreprise
                  </h6>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Domaine d'Activité *</label>
                    <select
                      className="form-select"
                      value={formData.activityDomain}
                      onChange={(e) => handleInputChange('activityDomain', e.target.value)}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {enums?.ActivityDomain && Object.entries(enums.ActivityDomain).map(([key, value]) => (
                        <option key={key} value={key}>{value as string}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Sous-Domaine</label>
                    <select
                      className="form-select"
                      value={formData.activitySubDomain}
                      onChange={(e) => handleInputChange('activitySubDomain', e.target.value)}
                    >
                      <option value="">Sélectionner...</option>
                      {enums?.ActivitySubDomain && Object.entries(enums.ActivitySubDomain).map(([key, value]) => (
                        <option key={key} value={key}>{value as string}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Avancement du Projet *</label>
                    <select
                      className="form-select"
                      value={formData.projectProgress}
                      onChange={(e) => handleInputChange('projectProgress', e.target.value)}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {enums?.ProjectProgress && Object.entries(enums.ProjectProgress).map(([key, value]) => (
                        <option key={key} value={key}>{value as string}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Effectif *</label>
                    <select
                      className="form-select"
                      value={formData.staffRange}
                      onChange={(e) => handleInputChange('staffRange', e.target.value)}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {enums?.StaffRange && Object.entries(enums.StaffRange).map(([key, value]) => (
                        <option key={key} value={key}>{value as string}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="col-12">
                  <div className="form-group mb-3">
                    <label className="form-label">Adresse</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Adresse complète de l'entreprise..."
                    />
                  </div>
                </div>
              </div>

              {/* NOTES DU PROJET */}
              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-dark mb-3">
                    <i className="fas fa-sticky-note me-2"></i>
                    Notes du Projet
                  </h6>
                </div>
                
                <div className="col-12">
                  <div className="form-group mb-3">
                    <label className="form-label">Notes et Observations</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={formData.projectNotes}
                      onChange={(e) => handleInputChange('projectNotes', e.target.value)}
                      placeholder="Ajoutez des notes, observations ou commentaires sur le projet..."
                    />
                  </div>
                </div>
              </div>

              {/* CONSENTEMENT */}
              <div className="row mb-4">
                <div className="col-12">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={formData.consentGiven}
                      onChange={(e) => handleInputChange('consentGiven', e.target.checked)}
                      required
                    />
                    <label className="form-check-label">
                      Je consens à ce que mes données soient utilisées par S2T Incubator pour l'analyse et le support *
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Sauvegarde...
                  </>
                ) : (
                  'Sauvegarder le Profil'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfileModal;