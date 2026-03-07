import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { all_routes } from "../../router/all_routes";
import { useUser } from "../../../hooks/useUser";
import { useCompanyProfile } from "../../../hooks/useCompanyProfile";
import companyProfileService from "../../../services/companyProfileService";

const BLOCKING_FACTORS_OPTIONS = [
  "Accès au Financement",
  "Conformité Réglementaire",
  "Accès au Marché",
  "Expertise Technique",
  "Infrastructure",
  "Ressources Humaines",
  "Acquisition Client (CAC élevé)",
  "Faible rétention des utilisateurs",
  "Manque de product-market fit",
  "Canaux de vente non structurés",
  "Gouvernance et pilotage interne",
  "Protection de la propriété intellectuelle",
  "Partenariats stratégiques insuffisants",
  "Internationalisation / export",
];

const INTERVENTION_OPTIONS = [
  "Consultation Stratégie",
  "Formation Technique",
  "Assistance Financière",
  "Support Marché",
  "Facilitation Réseautage",
  "Mentorat",
];

const SECTOR_OPTIONS = [
  "Technologie",
  "Agriculture",
  "Santé",
  "Éducation",
  "Finance",
  "Commerce",
  "Transport",
  "Énergie",
  "Environnement",
  "Tourisme",
];

const S2TIndicatorsPage = () => {
  const routes = all_routes;
  const { user, loading: userLoading } = useUser();
  const userId = user?._id;
  const {
    companyProfile,
    createOrUpdateProfile,
    loading: profileLoading,
    isCreating,
    isUpdating,
  } = useCompanyProfile(userId);

  const [enums, setEnums] = useState<any>(null);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [formData, setFormData] = useState({
    consentGiven: false,
    companyName: "",
    founderName: "",
    email: "",
    companyCreationDate: "",
    activityDomain: "",
    activitySubDomain: "",
    projectProgress: "",
    staffRange: "",
    address: "",
    gender: "OTHER" as "MALE" | "FEMALE" | "OTHER",
    sectors: [] as string[],
    qualityCertification: false,
    certificationDetails: "",
    projectStage: "IDEA" as "IDEA" | "PROTOTYPE" | "PILOT" | "MARKET_ENTRY" | "SCALING",
    workforce: 0,
    blockingFactors: [] as string[],
    interventionsNeeded: [] as string[],
    projectNotes: "",
  });

  useEffect(() => {
    const loadEnums = async () => {
      try {
        const response = await companyProfileService.getEnums();
        if (response?.success) setEnums(response.data);
      } catch (_err) {
        // non-blocking
      }
    };
    loadEnums();
  }, []);

  const normalizeDate = (value?: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (userLoading || profileLoading) return;

    const founderDefault = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

    // Auto-fill depuis les données déjà enregistrées (Profile settings / company profile)
    // sans écraser les valeurs déjà saisies par l'utilisateur sur cette page.
    setFormData((prev) => ({
      ...prev,
      consentGiven: prev.consentGiven || !!companyProfile?.consentGiven,
      companyName: prev.companyName || companyProfile?.companyName || "",
      founderName: prev.founderName || companyProfile?.founderName || founderDefault || "",
      email: prev.email || companyProfile?.email || user?.email || "",
      companyCreationDate: prev.companyCreationDate || normalizeDate(companyProfile?.companyCreationDate) || "",
      activityDomain: prev.activityDomain || companyProfile?.activityDomain || "",
      activitySubDomain: prev.activitySubDomain || companyProfile?.activitySubDomain || "",
      projectProgress: prev.projectProgress || companyProfile?.projectProgress || "",
      staffRange: prev.staffRange || companyProfile?.staffRange || "",
      address: prev.address || companyProfile?.address || user?.address || "",
      gender:
        (prev.gender === "OTHER" && companyProfile?.gender
          ? (companyProfile.gender as "MALE" | "FEMALE" | "OTHER")
          : prev.gender),
      sectors: prev.sectors.length ? prev.sectors : companyProfile?.sectors || [],
      qualityCertification: prev.qualityCertification || !!companyProfile?.qualityCertification,
      certificationDetails: prev.certificationDetails || companyProfile?.certificationDetails || "",
      projectStage:
        prev.projectStage === "IDEA" && companyProfile?.projectStage
          ? (companyProfile.projectStage as "IDEA" | "PROTOTYPE" | "PILOT" | "MARKET_ENTRY" | "SCALING")
          : prev.projectStage,
      workforce: prev.workforce > 0 ? prev.workforce : companyProfile?.workforce ?? 0,
      blockingFactors: prev.blockingFactors.length ? prev.blockingFactors : companyProfile?.blockingFactors || [],
      interventionsNeeded: prev.interventionsNeeded.length
        ? prev.interventionsNeeded
        : companyProfile?.interventionsNeeded || [],
      projectNotes: prev.projectNotes || companyProfile?.projectNotes || "",
    }));
  }, [userLoading, profileLoading, user, companyProfile]);

  const setField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayValue = (field: "sectors" | "blockingFactors" | "interventionsNeeded", value: string) => {
    setFormData((prev) => {
      const current = prev[field] as string[];
      const exists = current.includes(value);
      return {
        ...prev,
        [field]: exists ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const saving = isCreating || isUpdating;
  const saveLabel = useMemo(() => {
    if (!saving) return "Sauvegarder les Indicateurs";
    return isUpdating ? "Mise à jour..." : "Sauvegarde...";
  }, [saving, isUpdating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!userId) {
      setFormError("Utilisateur non identifié");
      return;
    }

    const founderDefault = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

    // Auto-complete des champs répétitifs au moment de l'envoi
    const payload = {
      ...formData,
      userId,
      companyName: formData.companyName || companyProfile?.companyName || "Startup",
      founderName: formData.founderName || companyProfile?.founderName || founderDefault || "Founder",
      email: formData.email || companyProfile?.email || user?.email || "",
      companyCreationDate:
        formData.companyCreationDate || normalizeDate(companyProfile?.companyCreationDate) || new Date().toISOString().slice(0, 10),
      projectNotes: formData.projectNotes?.trim() || "",
    };

    if (!payload.email || !payload.activityDomain || !payload.projectProgress || !payload.staffRange || !payload.consentGiven) {
      setFormError("Veuillez compléter les champs obligatoires et accepter le consentement.");
      return;
    }

    const ok = await createOrUpdateProfile(payload as any);
    if (ok) {
      setFormSuccess("Indicateurs S2T enregistrés avec succès.");
    } else {
      setFormError("Échec de l'enregistrement des indicateurs.");
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
          <div className="my-auto mb-2">
            <h2 className="mb-1">Indicateurs S2T</h2>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.employeeDashboard}>
                    <i className="ti ti-smart-home" />
                  </Link>
                </li>
                <li className="breadcrumb-item">Startup</li>
                <li className="breadcrumb-item active">Indicateurs S2T</li>
              </ol>
            </nav>
          </div>
          <div className="head-icons ms-2">
            <CollapseHeader />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">Profil de l'Entreprise - Indicateurs S2T</h5>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="card-body">
              {formError && <div className="alert alert-danger">{formError}</div>}
              {formSuccess && <div className="alert alert-success">{formSuccess}</div>}

              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-primary mb-3"><i className="fas fa-info-circle me-2" />Informations de Base</h6>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Nom de l'Entreprise *</label>
                  <input type="text" className="form-control" value={formData.companyName} onChange={(e) => setField("companyName", e.target.value)} required />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Nom du Fondateur *</label>
                  <input type="text" className="form-control" value={formData.founderName} onChange={(e) => setField("founderName", e.target.value)} required />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" value={formData.email} onChange={(e) => setField("email", e.target.value)} required />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Date de Création *</label>
                  <input type="date" className="form-control" value={formData.companyCreationDate} onChange={(e) => setField("companyCreationDate", e.target.value)} required />
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-success mb-3"><i className="fas fa-chart-line me-2" />Indicateurs de Performance</h6>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Genre du Fondateur *</label>
                  <select className="form-select" value={formData.gender} onChange={(e) => setField("gender", e.target.value)} required>
                    <option value="MALE">Homme</option>
                    <option value="FEMALE">Femme</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Étape du Projet *</label>
                  <select className="form-select" value={formData.projectStage} onChange={(e) => setField("projectStage", e.target.value)} required>
                    <option value="IDEA">Idée</option>
                    <option value="PROTOTYPE">Prototype</option>
                    <option value="PILOT">Pilote</option>
                    <option value="MARKET_ENTRY">Entrée Marché</option>
                    <option value="SCALING">Mise à l'Échelle</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Effectif (Nombre d'employés)</label>
                  <input type="number" className="form-control" min="0" value={formData.workforce} onChange={(e) => setField("workforce", parseInt(e.target.value, 10) || 0)} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Certification Qualité</label>
                  <div className="form-check mt-2">
                    <input type="checkbox" className="form-check-input" checked={formData.qualityCertification} onChange={(e) => setField("qualityCertification", e.target.checked)} />
                    <label className="form-check-label">L'entreprise possède une certification qualité</label>
                  </div>
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-info mb-3"><i className="fas fa-industry me-2" />Secteurs d'Activité</h6>
                </div>
                <div className="col-12">
                  <div className="row">
                    {SECTOR_OPTIONS.map((sector) => (
                      <div key={sector} className="col-md-4 mb-2">
                        <div className="form-check">
                          <input type="checkbox" className="form-check-input" checked={formData.sectors.includes(sector)} onChange={() => toggleArrayValue("sectors", sector)} />
                          <label className="form-check-label">{sector}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-warning mb-3"><i className="fas fa-exclamation-triangle me-2" />Facteurs de Blocage</h6>
                  <p className="text-muted mb-2">Sélectionnez les obstacles qui freinent la croissance de votre startup.</p>
                </div>
                <div className="col-12">
                  <div className="row">
                    {BLOCKING_FACTORS_OPTIONS.map((factor) => (
                      <div key={factor} className="col-md-6 mb-2">
                        <div className="form-check">
                          <input type="checkbox" className="form-check-input" checked={formData.blockingFactors.includes(factor)} onChange={() => toggleArrayValue("blockingFactors", factor)} />
                          <label className="form-check-label">{factor}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-danger mb-3"><i className="fas fa-hands-helping me-2" />Interventions Requises</h6>
                </div>
                <div className="col-12">
                  <div className="row">
                    {INTERVENTION_OPTIONS.map((item) => (
                      <div key={item} className="col-md-6 mb-2">
                        <div className="form-check">
                          <input type="checkbox" className="form-check-input" checked={formData.interventionsNeeded.includes(item)} onChange={() => toggleArrayValue("interventionsNeeded", item)} />
                          <label className="form-check-label">{item}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-secondary mb-3"><i className="fas fa-building me-2" />Informations de l'Entreprise</h6>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Domaine d'Activité *</label>
                  <select className="form-select" value={formData.activityDomain} onChange={(e) => setField("activityDomain", e.target.value)} required>
                    <option value="">Sélectionner...</option>
                    {enums?.ActivityDomain &&
                      Object.entries(enums.ActivityDomain).map(([key, value]) => (
                        <option key={key} value={key}>{String(value)}</option>
                      ))}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Sous-Domaine</label>
                  <select className="form-select" value={formData.activitySubDomain} onChange={(e) => setField("activitySubDomain", e.target.value)}>
                    <option value="">Sélectionner...</option>
                    {enums?.ActivitySubDomain &&
                      Object.entries(enums.ActivitySubDomain).map(([key, value]) => (
                        <option key={key} value={key}>{String(value)}</option>
                      ))}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Avancement du Projet *</label>
                  <select className="form-select" value={formData.projectProgress} onChange={(e) => setField("projectProgress", e.target.value)} required>
                    <option value="">Sélectionner...</option>
                    {enums?.ProjectProgress &&
                      Object.entries(enums.ProjectProgress).map(([key, value]) => (
                        <option key={key} value={key}>{String(value)}</option>
                      ))}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Effectif *</label>
                  <select className="form-select" value={formData.staffRange} onChange={(e) => setField("staffRange", e.target.value)} required>
                    <option value="">Sélectionner...</option>
                    {enums?.StaffRange &&
                      Object.entries(enums.StaffRange).map(([key, value]) => (
                        <option key={key} value={key}>{String(value)}</option>
                      ))}
                  </select>
                </div>
                <div className="col-12 mb-3">
                  <label className="form-label">Adresse</label>
                  <textarea className="form-control" rows={2} value={formData.address} onChange={(e) => setField("address", e.target.value)} placeholder="Adresse complète de l'entreprise..." />
                </div>
              </div>

              <div className="row mb-4">
                <div className="col-12">
                  <h6 className="text-dark mb-3"><i className="fas fa-sticky-note me-2" />Notes du Projet</h6>
                </div>
                <div className="col-12 mb-3">
                  <label className="form-label">Notes et Observations</label>
                  <textarea className="form-control" rows={4} value={formData.projectNotes} onChange={(e) => setField("projectNotes", e.target.value)} placeholder="Ajoutez des notes, observations ou commentaires sur le projet..." />
                </div>
              </div>

              <div className="row">
                <div className="col-12">
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" checked={formData.consentGiven} onChange={(e) => setField("consentGiven", e.target.checked)} required />
                    <label className="form-check-label">
                      Je consens à ce que mes données soient utilisées par S2T Incubator pour l'analyse et le support *
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-footer d-flex justify-content-end">
              <button type="submit" className="btn btn-primary" disabled={saving || userLoading || profileLoading}>
                {saveLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default S2TIndicatorsPage;

