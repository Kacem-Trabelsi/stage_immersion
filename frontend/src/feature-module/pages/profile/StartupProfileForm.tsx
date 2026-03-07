import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompanyProfile } from '../../../hooks/useCompanyProfile';

type Option = { label: string; value: string };

interface FormState {
  companyName: string;
  logo: string; // base64 for now
  slogan: string;
  shortDescription: string;
  longDescription: string;
  activityDomain: string;
  companyCreationDate: string;
  legalStatus: string;
  country: string;
  city: string;
  address: string;
  website: string;
  founderName: string;
  leadershipTeam: string;
  workforce: string; // number as string
  projectStage: string;
  businessModel: string;
  targetCustomers: string;
  usersCount: string; // optional
}

const sectorOptions: Option[] = [
  { label: 'FinTech', value: 'FINTECH' },
  { label: 'HealthTech', value: 'HEALTH_TECH' },
  { label: 'EdTech', value: 'E_LEARNING' },
  { label: 'AgriTech', value: 'AGRITECH' },
  { label: 'IA / AI', value: 'IA' },
  { label: 'Cyber Security', value: 'CYBER_SECURITY' },
  { label: 'Industry', value: 'INDUSTRY' },
  { label: 'Other', value: 'OTHER' },
];

const stageOptions: Option[] = [
  { label: 'Idée', value: 'IDEA' },
  { label: 'Prototype', value: 'PROTOTYPE' },
  { label: 'MVP', value: 'PILOT' },
  { label: 'Startup lancée', value: 'MARKET_ENTRY' },
  { label: 'Scale-up', value: 'SCALING' },
];

const businessModelOptions: Option[] = [
  { label: 'B2B', value: 'B2B' },
  { label: 'B2C', value: 'B2C' },
  { label: 'Marketplace', value: 'MARKETPLACE' },
  { label: 'SaaS', value: 'SAAS' },
];

const legalStatusOptions: Option[] = [
  { label: 'SARL', value: 'SARL' },
  { label: 'SA', value: 'SA' },
  { label: 'Auto-entrepreneur', value: 'AUTO' },
  { label: 'Autre', value: 'OTHER' },
];

const mapProjectStageToProgress = (projectStage: string): string => {
  switch (projectStage) {
    case 'IDEA':
      return 'IDEA_STAGE';
    case 'PROTOTYPE':
      return 'PROTOTYPE';
    case 'PILOT':
      return 'MVP';
    case 'MARKET_ENTRY':
      return 'SEED';
    case 'SCALING':
      return 'GROWTH';
    default:
      return 'MVP';
  }
};

const mapWorkforceToStaffRange = (workforce: number): string => {
  if (workforce <= 1) return 'SOLO_FOUNDER';
  if (workforce < 5) return 'LESS_THAN_5';
  if (workforce <= 10) return 'BETWEEN_5_10';
  if (workforce <= 25) return 'BETWEEN_10_25';
  if (workforce <= 50) return 'BETWEEN_25_50';
  return 'MORE_THAN_50';
};

const StartupProfileForm: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || user?._id;
  const { companyProfile, createOrUpdateProfile, loading, error, isCreating, isUpdating } = useCompanyProfile(userId);

  const [form, setForm] = useState<FormState>({
    companyName: '',
    logo: '',
    slogan: '',
    shortDescription: '',
    longDescription: '',
    activityDomain: '',
    companyCreationDate: '',
    legalStatus: '',
    country: '',
    city: '',
    address: '',
    website: '',
    founderName: '',
    leadershipTeam: '',
    workforce: '',
    projectStage: '',
    businessModel: '',
    targetCustomers: '',
    usersCount: '',
  });

  const [logoPreview, setLogoPreview] = useState<string>('');
  const [submitMessage, setSubmitMessage] = useState<string>('');
  const [imageError, setImageError] = useState<string>('');

  // Fonction pour valider et nettoyer le data URL de l'image
  const validateAndCleanImageData = (imageData: string): string | null => {
    try {
      // Vérifier si c'est un data URL valide
      if (!imageData || typeof imageData !== 'string') {
        return null;
      }

      // Vérifier le format data URL
      if (!imageData.startsWith('data:image/')) {
        console.error('Format d\'image invalide:', imageData.substring(0, 50));
        return null;
      }

      // Vérifier que le data URL n'est pas tronqué
      const base64Part = imageData.split(',')[1];
      if (!base64Part || base64Part.length < 100) {
        console.error('Data URL semble tronqué:', imageData.length, 'caractères');
        return null;
      }

      // Vérifier que la partie base64 est valide
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(base64Part)) {
        console.error('Base64 invalide dans le data URL');
        return null;
      }

      return imageData;
    } catch (error) {
      console.error('Erreur lors de la validation de l\'image:', error);
      return null;
    }
  };

  // Fonction pour tenter de réparer un data URL tronqué
  const attemptRepairImageData = (imageData: string): string | null => {
    try {
      // Si le data URL semble tronqué, essayer de le réparer
      if (imageData.includes('data:image/') && !imageData.includes(',')) {
        console.log('Tentative de réparation du data URL tronqué...');
        // Le data URL semble être tronqué au niveau de la virgule
        return null; // Pour l'instant, on ne peut pas réparer automatiquement
      }

      // Vérifier si la partie base64 est tronquée
      const parts = imageData.split(',');
      if (parts.length === 2) {
        const base64Part = parts[1];
        // Vérifier si la partie base64 se termine correctement
        if (base64Part.length % 4 !== 0) {
          console.log('Tentative de réparation du padding base64...');
          // Ajouter le padding manquant
          const padding = '='.repeat(4 - (base64Part.length % 4));
          const repairedData = imageData + padding;
          if (validateAndCleanImageData(repairedData)) {
            return repairedData;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la réparation de l\'image:', error);
      return null;
    }
  };

  useEffect(() => {
    if (companyProfile) {
      const parts = (companyProfile.address || '')
        .split(',')
        .map((p: string) => p.trim())
        .filter(Boolean);
      const country = parts.length >= 1 ? parts[parts.length - 1] : '';
      const city = parts.length >= 2 ? parts[parts.length - 2] : '';
      const address = parts.length >= 3 ? parts.slice(0, parts.length - 2).join(', ') : (parts[0] || '');

      setForm((prev) => ({
        ...prev,
        companyName: companyProfile.companyName || '',
        logo: companyProfile.logo || '',
        slogan: companyProfile.slogan || '',
        shortDescription: companyProfile.businessPlanSummary || '',
        longDescription: companyProfile.longDescription || '',
        activityDomain: companyProfile.activityDomain || '',
        companyCreationDate: companyProfile.companyCreationDate ? new Date(companyProfile.companyCreationDate).toISOString().slice(0, 10) : '',
        country,
        city,
        address,
        website: companyProfile.website || '',
        founderName: companyProfile.founderName || '',
        leadershipTeam: companyProfile.staffPositions || '',
        workforce: (companyProfile.workforce ?? '').toString(),
        projectStage: companyProfile.projectStage || '',
        targetCustomers: companyProfile.targetMarket || '',
      }));
      if (companyProfile.logo) {
        console.log('Logo reçu du backend:', companyProfile.logo.substring(0, 100) + '...');
        console.log('Longueur du logo:', companyProfile.logo.length);
        console.log('Type du logo:', typeof companyProfile.logo);
        
        let validatedImage = validateAndCleanImageData(companyProfile.logo);
        
        // Si la validation échoue, essayer de réparer
        if (!validatedImage) {
          console.log('Tentative de réparation de l\'image...');
          validatedImage = attemptRepairImageData(companyProfile.logo);
        }
        
        if (typeof validatedImage === 'string') {
          const safeLogo: string = validatedImage;
          setForm((prev) => ({ ...prev, logo: safeLogo }));
          setLogoPreview(safeLogo);
          setImageError('');
        } else {
          setImageError('Format d\'image invalide ou image corrompue. Veuillez re-télécharger l\'image.');
          setLogoPreview('');
        }
      }
    }
  }, [companyProfile]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSubmitMessage('');
  };

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Vérifier la taille du fichier (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Le fichier est trop volumineux (max 5MB)');
      return;
    }
    
    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setImageError('Veuillez sélectionner un fichier image valide');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const validatedImage = validateAndCleanImageData(base64);
      if (typeof validatedImage === 'string') {
        const safeLogo: string = validatedImage;
        setForm((prev) => ({ ...prev, logo: safeLogo }));
        setLogoPreview(safeLogo);
        setImageError('');
      } else {
        setImageError('Erreur lors du traitement de l\'image');
      }
    };
    reader.onerror = () => {
      setImageError('Erreur lors de la lecture du fichier');
    };
    reader.readAsDataURL(file);
  };

  const isSubmitting = useMemo(() => loading || isCreating || isUpdating, [loading, isCreating, isUpdating]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmitMessage('');

    if (!form.companyName || !form.founderName || !form.companyCreationDate) {
      setSubmitMessage('Veuillez renseigner au minimum: nom startup, fondateur et date de création.');
      return;
    }

    const parsedWorkforce = Number(form.workforce || 0);
    const safeWorkforce = Number.isFinite(parsedWorkforce) && parsedWorkforce >= 0 ? parsedWorkforce : 0;
    const stage = form.projectStage || 'IDEA';
    const domain = form.activityDomain || 'OTHER';

    // Backend required fields mapping + additional requested fields
    const payload: any = {
      consentGiven: true,
      userId,
      companyName: form.companyName,
      founderName: form.founderName,
      email: user?.email || '',
      phone: user?.phone || '',
      companyCreationDate: form.companyCreationDate,
      activityDomain: domain,
      sectors: [domain],
      projectProgress: mapProjectStageToProgress(stage),
      staffRange: mapWorkforceToStaffRange(safeWorkforce),
      gender: 'OTHER',
      projectStage: stage,
      workforce: safeWorkforce,
      targetMarket: form.targetCustomers,
      businessPlanSummary: form.shortDescription,
      longDescription: form.longDescription,
      address: `${form.address}${form.city ? ', ' + form.city : ''}${form.country ? ', ' + form.country : ''}`,
      website: form.website,
      staffPositions: form.leadershipTeam,
      logo: form.logo,
      slogan: form.slogan,
      qualityCertification: false,
      blockingFactors: [],
      interventionsNeeded: [],
      stage: 'STARTUP',
      // labelType has strict enum on backend (STARTUP_LABEL | INNOVATION_LABEL | TECH_LABEL | GREEN_LABEL | SOCIAL_LABEL | OTHER)
      // Keep OTHER by default to avoid validation error on legal status values like SARL/AUTO.
      labelType: 'OTHER',
      competitors: form.businessModel || '',
      recommendations: form.usersCount ? `UsersCount: ${form.usersCount}` : '',
    };

    const ok = await createOrUpdateProfile(payload);
    setSubmitMessage(ok ? 'Profil STARTUP enregistré avec succès.' : "Échec de l'enregistrement du profil.");
  };

  return (
    <div className="card">
      <div className="card-body">
        <div className="border-bottom mb-3 pb-3">
          <h4>Profil STARTUP</h4>
        </div>

        {error && (
          <div className="alert alert-danger">{error}</div>
        )}
        {submitMessage && (
          <div className={`alert ${submitMessage.includes('succès') ? 'alert-success' : 'alert-warning'}`}>{submitMessage}</div>
        )}

        <form onSubmit={onSubmit}>
          <div className="border-bottom mb-3">
            <h6 className="mb-3">Informations de base</h6>
            <div className="row">
              <div className="col-md-8 mb-3">
                <label className="form-label">Nom de la startup</label>
                <input className="form-control" name="companyName" value={form.companyName} onChange={onChange} required />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Logo</label>
                <input className="form-control" type="file" accept="image/*" onChange={onLogoChange} />
                {imageError && (
                  <div className="alert alert-warning mt-2" style={{ fontSize: '0.8rem' }}>
                    {imageError}
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-secondary ms-2"
                      onClick={() => {
                        setImageError('');
                        setLogoPreview('');
                        setForm((prev) => ({ ...prev, logo: '' }));
                      }}
                    >
                      Réinitialiser
                    </button>
                  </div>
                )}
                {logoPreview && !imageError && (
                  <div className="mt-2">
                    <img 
                      src={logoPreview} 
                      alt="logo" 
                      style={{ 
                        height: 60, 
                        maxWidth: '100%', 
                        objectFit: 'contain',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                      onError={(e) => {
                        console.error('Erreur lors du chargement de l\'image:', e);
                        setImageError('Erreur lors du chargement de l\'image');
                        setLogoPreview('');
                      }}
                    />
                    <div className="mt-1">
                      <small className="text-muted">
                        Image chargée ({logoPreview.length} caractères)
                      </small>
                    </div>
                  </div>
                )}
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Slogan</label>
                <input className="form-control" name="slogan" value={form.slogan} onChange={onChange} />
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Description courte</label>
                <textarea className="form-control" rows={2} name="shortDescription" value={form.shortDescription} onChange={onChange} />
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Description détaillée</label>
                <textarea className="form-control" rows={5} name="longDescription" value={form.longDescription} onChange={onChange} />
              </div>
            </div>
          </div>

          <div className="border-bottom mb-3">
            <h6 className="mb-3">Informations générales</h6>
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Secteur d’activité</label>
                <select className="form-select" name="activityDomain" value={form.activityDomain} onChange={onChange}>
                  <option value="">Sélectionner</option>
                  {sectorOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Date de création</label>
                <input type="date" className="form-control" name="companyCreationDate" value={form.companyCreationDate} onChange={onChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Statut juridique</label>
                <select className="form-select" name="legalStatus" value={form.legalStatus} onChange={onChange}>
                  <option value="">Sélectionner</option>
                  {legalStatusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Pays</label>
                <input className="form-control" name="country" value={form.country} onChange={onChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Ville</label>
                <input className="form-control" name="city" value={form.city} onChange={onChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Adresse postale</label>
                <input className="form-control" name="address" value={form.address} onChange={onChange} />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Site web</label>
                <input className="form-control" name="website" value={form.website} onChange={onChange} />
              </div>
            </div>
          </div>

          <div className="border-bottom mb-3">
            <h6 className="mb-3">Équipe</h6>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Fondateur / CEO</label>
                <input className="form-control" name="founderName" value={form.founderName} onChange={onChange} />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Équipe dirigeante</label>
                <input className="form-control" name="leadershipTeam" value={form.leadershipTeam} onChange={onChange} placeholder="Cofondateurs, CTO, COO…" />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Nombre d’employés</label>
                <input className="form-control" name="workforce" value={form.workforce} onChange={onChange} />
              </div>
            </div>
          </div>

          <div className="border-bottom mb-3">
            <h6 className="mb-3">Données business</h6>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Stade de développement</label>
                <select className="form-select" name="projectStage" value={form.projectStage} onChange={onChange}>
                  <option value="">Sélectionner</option>
                  {stageOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Modèle économique</label>
                <select className="form-select" name="businessModel" value={form.businessModel} onChange={onChange}>
                  <option value="">Sélectionner</option>
                  {businessModelOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Clients cibles</label>
                <input className="form-control" name="targetCustomers" value={form.targetCustomers} onChange={onChange} />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Nombre d’utilisateurs / clients (optionnel)</label>
                <input className="form-control" name="usersCount" value={form.usersCount} onChange={onChange} />
              </div>
            </div>
          </div>

          <div className="text-end">
            <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartupProfileForm;


