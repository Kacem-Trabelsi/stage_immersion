import React, { useState, useEffect, useCallback } from "react";
import CommonSelect from "../common/commonSelect";
import CommonTagsInput from "../common/Taginput";
import ticketService from "../../services/ticketService";
import { useAuth } from "../../contexts/AuthContext";

// Types pour les options des selects
interface SelectOption {
  value: string;
  label: string;
}

// Types pour les données du formulaire
interface FormData {
  title: string;
  description: string;
  category: string;
  priority: string;
  impact: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  proposedSolution: string;
  dueDate: string;
  tags: string[];
  isUrgent: boolean;
  isPublic: boolean;
}

// Types pour les énumérations
type TicketCategory = 'TECHNICAL' | 'BUSINESS' | 'LEGAL' | 'FINANCIAL' | 'MARKETING' | 'OPERATIONAL' | 'HUMAN_RESOURCES' | 'OTHER';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketImpact = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED' | 'CLOSED';

// Extension de l'interface Window pour Bootstrap
declare global {
  interface Window {
    bootstrap: {
      Modal: {
        getInstance: (element: HTMLElement) => any;
      };
    };
  }
}

const TicketListModal = () => {
  // Utiliser le contexte d'authentification
  const { user, isAuthenticated } = useAuth();

  // États pour le formulaire
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    priority: '',
    impact: '',
    contactEmail: user?.email || '',
    contactPhone: '',
    companyName: '',
    proposedSolution: '',
    dueDate: '',
    tags: [],
    isUrgent: false,
    isPublic: false
  });

  // États pour les options des selects
  const [categories, setCategories] = useState<SelectOption[]>([{ value: "Select", label: "Sélectionner une catégorie" }]);
  const [priorities, setPriorities] = useState<SelectOption[]>([{ value: "Select", label: "Sélectionner une priorité" }]);
  const [impacts, setImpacts] = useState<SelectOption[]>([{ value: "Select", label: "Sélectionner un impact" }]);

  // États pour la gestion du formulaire
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: string; message: string }>({ type: '', message: '' });

  // Fonctions de traduction des labels
  const getCategoryLabel = (category: TicketCategory): string => {
    const labels: Record<TicketCategory, string> = {
      'TECHNICAL': 'Problème technique',
      'BUSINESS': 'Problème business',
      'LEGAL': 'Problème légal',
      'FINANCIAL': 'Problème financier',
      'MARKETING': 'Problème marketing',
      'OPERATIONAL': 'Problème opérationnel',
      'HUMAN_RESOURCES': 'Problème RH',
      'OTHER': 'Autre'
    };
    return labels[category] || category;
  };

  const getPriorityLabel = (priority: TicketPriority): string => {
    const labels: Record<TicketPriority, string> = {
      'LOW': 'Faible',
      'MEDIUM': 'Moyen',
      'HIGH': 'Élevé',
      'URGENT': 'Urgent'
    };
    return labels[priority] || priority;
  };

  const getImpactLabel = (impact: TicketImpact): string => {
    const labels: Record<TicketImpact, string> = {
      'LOW': 'Impact faible',
      'MEDIUM': 'Impact moyen',
      'HIGH': 'Impact élevé',
      'CRITICAL': 'Impact critique'
    };
    return labels[impact] || impact;
  };

  // Mettre à jour les données du formulaire quand l'utilisateur change
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        contactEmail: user.email || prev.contactEmail, // Email toujours de l'utilisateur connecté
        companyName: user.companyName || prev.companyName
      }));
    }
  }, [user]);

  // S'assurer que l'email est toujours celui de l'utilisateur connecté
  useEffect(() => {
    if (isAuthenticated && user && user.email) {
      setFormData(prev => ({
        ...prev,
        contactEmail: user.email // Forcer l'email de l'utilisateur connecté
      }));
    }
  }, [isAuthenticated, user]);

  // Charger les énumérations au montage du composant
  const loadEnums = useCallback(async () => {
    try {
      const response = await ticketService.getEnums();
      if (response.success) {
        const { categories: cats, priorities: prios, impacts: imps } = response.data;
        
        setCategories([
          { value: "Select", label: "Sélectionner une catégorie" },
          ...cats.map((cat: TicketCategory) => ({ value: cat, label: getCategoryLabel(cat) }))
        ]);
        
        setPriorities([
          { value: "Select", label: "Sélectionner une priorité" },
          ...prios.map((prio: TicketPriority) => ({ value: prio, label: getPriorityLabel(prio) }))
        ]);
        
        setImpacts([
          { value: "Select", label: "Sélectionner un impact" },
          ...imps.map((imp: TicketImpact) => ({ value: imp, label: getImpactLabel(imp) }))
        ]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des énumérations:', error);
    }
  }, []);

  useEffect(() => {
    loadEnums();
  }, [loadEnums]);

  // Gestion des changements dans le formulaire
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    // Empêcher la modification de l'email de contact
    if (name === 'contactEmail') {
      return; // Ignorer les tentatives de modification de l'email
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSelectChange = (name: string, selectedOption: SelectOption | null) => {
    setFormData(prev => ({
      ...prev,
      [name]: selectedOption ? selectedOption.value : ''
    }));
  };

  const handleTagsChange = (newTags: string[]) => {
    setFormData(prev => ({
      ...prev,
      tags: newTags
    }));
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', message: '' });

    try {
      // Vérifier si l'utilisateur est connecté
      if (!isAuthenticated || !user) {
        setSubmitMessage({ 
          type: 'error', 
          message: 'Vous devez être connecté pour créer un ticket' 
        });
        return;
      }

      // Validation des champs requis
      if (!formData.title || !formData.description || !formData.category || 
          !formData.priority || !formData.impact || !formData.contactEmail || 
          !formData.companyName) {
        setSubmitMessage({ 
          type: 'error', 
          message: 'Veuillez remplir tous les champs obligatoires' 
        });
        return;
      }

      // Préparer les données pour l'envoi avec l'ID de l'utilisateur
      const ticketData = {
        ...formData,
        category: formData.category !== 'Select' ? formData.category : undefined,
        priority: formData.priority !== 'Select' ? formData.priority : undefined,
        impact: formData.impact !== 'Select' ? formData.impact : undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        // L'ID de l'utilisateur sera automatiquement ajouté par le backend via le token JWT
        reportedBy: user.id // Ajouter l'ID de l'utilisateur pour référence
      };

      console.log('Création du ticket pour l\'utilisateur:', user.id, user.email);
      console.log('Données du ticket:', ticketData);

      const response = await ticketService.createTicket(ticketData);
      
      if (response.success) {
        setSubmitMessage({ 
          type: 'success', 
          message: `Ticket créé avec succès ! Votre problème a été signalé. (ID: ${response.data._id})` 
        });
        
        // Réinitialiser le formulaire en gardant les données utilisateur
        setFormData({
          title: '',
          description: '',
          category: '',
          priority: '',
          impact: '',
          contactEmail: user.email || '', // Toujours l'email de l'utilisateur
          contactPhone: '',
          companyName: user.companyName || '',
          proposedSolution: '',
          dueDate: '',
          tags: [],
          isUrgent: false,
          isPublic: false
        });

        // Fermer le modal après 3 secondes pour laisser le temps de voir le message
        setTimeout(() => {
          const modal = document.getElementById('add_ticket');
          if (modal) {
            const modalInstance = window.bootstrap?.Modal?.getInstance(modal);
            if (modalInstance) {
              modalInstance.hide();
            }
          }
        }, 3000);
      }
    } catch (error: any) {
      console.error('Erreur lors de la création du ticket:', error);
      setSubmitMessage({ 
        type: 'error', 
        message: error.response?.data?.message || 'Erreur lors de la création du ticket' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Add Ticket */}
      <div className="modal fade" id="add_ticket">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Déclarer un Problème</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            
            {/* Informations utilisateur */}
            {isAuthenticated && user && (
              <div className="alert alert-info mx-3 mt-2 mb-0">
                <i className="ti ti-user me-2"></i>
                <strong>Connecté en tant que :</strong> {user.firstName} {user.lastName} ({user.email})
                {user.role && (
                  <span className="badge bg-primary ms-2">{user.role}</span>
                )}
              </div>
            )}
            
            {!isAuthenticated && (
              <div className="alert alert-warning mx-3 mt-2 mb-0">
                <i className="ti ti-alert-triangle me-2"></i>
                <strong>Attention :</strong> Vous devez être connecté pour créer un ticket.
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Message de statut */}
                {submitMessage.message && (
                  <div className={`alert ${submitMessage.type === 'success' ? 'alert-success' : 'alert-danger'} mb-3`}>
                    {submitMessage.message}
                  </div>
                )}

                <div className="row">
                  <div className="col-md-12">
                    {/* Titre du problème */}
                    <div className="mb-3">
                      <label className="form-label">Titre du Problème *</label>
                      <input
                        type="text"
                        name="title"
                        className="form-control"
                        placeholder="Décrivez brièvement votre problème"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    {/* Catégorie du problème */}
                    <div className="mb-3">
                      <label className="form-label">Catégorie du Problème *</label>
                      <CommonSelect
                        className="select"
                        options={categories}
                        value={categories.find(opt => opt.value === formData.category) || categories[0]}
                        onChange={(selectedOption) => handleSelectChange('category', selectedOption)}
                      />
                    </div>

                    {/* Nom de l'entreprise */}
                    <div className="mb-3">
                      <label className="form-label">Nom de l'Entreprise *</label>
                      <input
                        type="text"
                        name="companyName"
                        className="form-control"
                        placeholder="Nom de votre startup/entreprise"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    {/* Email de contact */}
                    <div className="mb-3">
                      <label className="form-label">Email de Contact *</label>
                      <input
                        type="email"
                        name="contactEmail"
                        className="form-control"
                        style={{ 
                          backgroundColor: '#f8f9fa', 
                          cursor: 'not-allowed',
                          border: '1px solid #dee2e6'
                        }}
                        placeholder="votre.email@entreprise.com"
                        value={formData.contactEmail}
                        onChange={handleInputChange}
                        readOnly
                        required
                      />
                      <div className="form-text text-muted">
                        <i className="ti ti-lock me-1"></i>
                        <strong>Email verrouillé :</strong> Votre email de contact est automatiquement rempli depuis votre profil et ne peut pas être modifié
                      </div>
                    </div>

                    {/* Téléphone de contact */}
                    <div className="mb-3">
                      <label className="form-label">Téléphone de Contact</label>
                      <input
                        type="tel"
                        name="contactPhone"
                        className="form-control"
                        placeholder="+33 1 23 45 67 89"
                        value={formData.contactPhone}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* Description du problème */}
                    <div className="mb-3">
                      <label className="form-label">Description du Problème *</label>
                      <textarea
                        name="description"
                        className="form-control"
                        rows={4}
                        placeholder="Décrivez en détail votre problème, son contexte et son impact sur votre activité"
                        value={formData.description}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    {/* Priorité */}
                    <div className="mb-3">
                      <label className="form-label">Priorité *</label>
                      <CommonSelect
                        className="select"
                        options={priorities}
                        value={priorities.find(opt => opt.value === formData.priority) || priorities[0]}
                        onChange={(selectedOption) => handleSelectChange('priority', selectedOption)}
                      />
                    </div>

                    {/* Impact */}
                    <div className="mb-3">
                      <label className="form-label">Impact sur l'Entreprise *</label>
                      <CommonSelect
                        className="select"
                        options={impacts}
                        value={impacts.find(opt => opt.value === formData.impact) || impacts[0]}
                        onChange={(selectedOption) => handleSelectChange('impact', selectedOption)}
                      />
                    </div>

                    {/* Solution proposée */}
                    <div className="mb-3">
                      <label className="form-label">Solution Proposée (optionnel)</label>
                      <textarea
                        name="proposedSolution"
                        className="form-control"
                        rows={3}
                        placeholder="Avez-vous une idée de solution ou des pistes à explorer ?"
                        value={formData.proposedSolution}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* Date limite */}
                    <div className="mb-3">
                      <label className="form-label">Date Limite Souhaitée (optionnel)</label>
                      <input
                        type="datetime-local"
                        name="dueDate"
                        className="form-control"
                        value={formData.dueDate}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* Tags */}
                    <div className="mb-3">
                      <label className="form-label">Mots-clés (optionnel)</label>
                      <CommonTagsInput
                        value={formData.tags}
                        onChange={handleTagsChange}
                        placeholder="Ajouter des mots-clés pour faciliter le traitement"
                        className="custom-input-class"
                      />
                    </div>

                    {/* Options */}
                    <div className="mb-3">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              name="isUrgent"
                              id="isUrgent"
                              checked={formData.isUrgent}
                              onChange={handleInputChange}
                            />
                            <label className="form-check-label" htmlFor="isUrgent">
                              Problème urgent
                            </label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              name="isPublic"
                              id="isPublic"
                              checked={formData.isPublic}
                              onChange={handleInputChange}
                            />
                            <label className="form-check-label" htmlFor="isPublic">
                              Rendre public (visible par d'autres startups)
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light me-2"
                  data-bs-dismiss="modal"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Envoi en cours...
                    </>
                  ) : (
                    'Déclarer le Problème'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Ticket */}
    </>
  );
};

export default TicketListModal;
