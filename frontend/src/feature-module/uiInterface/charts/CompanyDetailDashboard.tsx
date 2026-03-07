import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../../../hooks/useUser";
import { Chart as PrimeChart } from "primereact/chart";
import ReactApexChart from "react-apexcharts";
import { Bar, Pie, Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CompanyDetailDashboard = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();
  const isExpertSession = user?.role === 'EXPERT';
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart refs for download
  const chartRefs = {
    companyOverview: useRef<HTMLDivElement>(null),
    companyDetails: useRef<HTMLDivElement>(null),
    genderDistribution: useRef<HTMLDivElement>(null),
    sectorAnalysis: useRef<HTMLDivElement>(null),
    certificationRate: useRef<HTMLDivElement>(null),
    projectStageDistribution: useRef<HTMLDivElement>(null),
    workforceAnalysis: useRef<HTMLDivElement>(null),
    blockingFactors: useRef<HTMLDivElement>(null),
    interventionsNeeded: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setError('Vous n\'êtes pas autorisé à voir cette page.');
      setLoading(false);
      return;
    }

    const canViewDetails = ['S2T', 'ADMIN', 'EXPERT'].includes(user.role);
    if (!canViewDetails) {
      setError('Vous n\'êtes pas autorisé à voir cette page.');
      setLoading(false);
      return;
    }

    fetchCompanyProfile();
    // Global statistics endpoint remains restricted to S2T/ADMIN
    if (['S2T', 'ADMIN'].includes(user.role)) {
      fetchStatistics();
    }
  }, [user, userLoading, companyId]);

  const fetchCompanyProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/detail/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        setCompanyProfile(data.data);
      } else {
        setError(data.message || 'Échec de la récupération du profil de l\'entreprise');
      }
    } catch (err: any) {
      setError(err.message || 'Échec de la récupération du profil de l\'entreprise');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        setStatistics(data.data);
      }
    } catch (err: any) {
      console.error('Erreur lors de la récupération des statistiques:', err);
    }
  };

  // Download PDF report from backend
  const downloadPDFReport = async () => {
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
        a.download = `${companyProfile?.companyName || 'entreprise'}-rapport-s2t.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Erreur lors du téléchargement du rapport');
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement du rapport:', error);
    }
  };

  // Download dashboard as PDF with charts/images (multi-page, normal size, clean report, optimized size)
  const downloadDashboardPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    // Custom PDF header (not from DOM)
    doc.setFontSize(18);
    doc.text(`${companyProfile?.companyName || 'Entreprise'} - Rapport d'Analyse des Indicateurs S2T`, 15, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 15, 28);
    let y = 38;

    // Only include main dashboard sections (skip header/breadcrumb/export UI)
    const sections = isExpertSession
      ? [chartRefs.companyDetails]
      : [
          chartRefs.genderDistribution,
          chartRefs.sectorAnalysis,
          chartRefs.certificationRate,
          chartRefs.projectStageDistribution,
          chartRefs.workforceAnalysis,
          chartRefs.blockingFactors,
          chartRefs.interventionsNeeded,
        ];

    for (let i = 0; i < sections.length; i++) {
      const ref = sections[i];
      if (ref.current) {
        const canvas = await html2canvas(ref.current, { scale: 1.2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG, 80% quality
        const pageWidth = 210;
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = pageWidth - 20;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (y + pdfHeight > 287) {
          doc.addPage();
          y = 20;
        }
        doc.addImage(imgData, 'JPEG', 10, y, pdfWidth, pdfHeight);
        y += pdfHeight + 10;
      }
    }
    doc.save(`${companyProfile?.companyName || 'entreprise'}-dashboard.pdf`);
  };

  const downloadAsImage = async () => {
    const targetRef = isExpertSession ? chartRefs.companyDetails : chartRefs.companyOverview;
    if (!targetRef.current) return;
    const canvas = await html2canvas(targetRef.current, { scale: 1.5, useCORS: true });
    canvas.toBlob((blob: Blob | null) => {
      if (blob) saveAs(blob, `${companyProfile?.companyName || 'entreprise'}-details.png`);
    });
  };

  // Helper: Download chart as image
  const downloadChart = async (ref: React.RefObject<HTMLDivElement>, name: string) => {
    if (ref.current) {
      const canvas = await html2canvas(ref.current);
      canvas.toBlob((blob: Blob | null) => {
        if (blob) saveAs(blob, `${name}.png`);
      });
    }
  };

  // Generate chart data for new indicators
  const generateIndicatorCharts = () => {
    if (!companyProfile) return {
      genderData: {
        labels: ['Homme', 'Femme', 'Autre'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: ['#42A5F5', '#FF7043', '#66BB6A'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      sectorData: {
        labels: ['Technologie'],
        datasets: [{
          label: 'Répartition par Secteur',
          data: [0],
          backgroundColor: '#AB47BC',
          borderColor: '#AB47BC',
          borderWidth: 2
        }]
      },
      certificationData: {
        labels: ['Certifié', 'Non Certifié'],
        datasets: [{
          data: [0, 1],
          backgroundColor: ['#66BB6A', '#FF7043'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      projectStageData: {
        labels: ['Idée', 'Prototype', 'Pilote', 'Entrée Marché', 'Mise à l\'Échelle'],
        datasets: [{
          label: 'Les postes existants dans les startups',
          data: [0, 0, 0, 0, 0],
          backgroundColor: '#42A5F5',
          borderColor: '#42A5F5',
          borderWidth: 2
        }]
      },
      workforceData: {
        labels: ['0-5', '5-10', '10-20', '20+'],
        datasets: [{
          label: 'Les postes existants dans les startups',
          data: [0, 0, 0, 0],
          backgroundColor: '#FFEB3B',
          borderColor: '#FFEB3B',
          borderWidth: 2
        }]
      }
    };

    // Gender Distribution
    const genderData = {
      labels: ['Homme', 'Femme', 'Autre'],
      datasets: [{
        data: [
          companyProfile.gender === 'MALE' ? 1 : 0,
          companyProfile.gender === 'FEMALE' ? 1 : 0,
          companyProfile.gender === 'OTHER' ? 1 : 0
        ],
        backgroundColor: ['#42A5F5', '#FF7043', '#66BB6A'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };

    // Sector Analysis
    const sectorData = {
      labels: companyProfile.sectors || ['Technologie'],
      datasets: [{
        label: 'Répartition par Secteur',
        data: [1],
        backgroundColor: '#AB47BC',
        borderColor: '#AB47BC',
        borderWidth: 2
      }]
    };

    // Certification Rate
    const certificationData = {
      labels: ['Certifié', 'Non Certifié'],
      datasets: [{
        data: [
          companyProfile.qualityCertification ? 1 : 0,
          companyProfile.qualityCertification ? 0 : 1
        ],
        backgroundColor: ['#66BB6A', '#FF7043'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };

    // Project Stage Distribution
    const projectStageData = {
      labels: ['Idée', 'Prototype', 'Pilote', 'Entrée Marché', 'Mise à l\'Échelle'],
      datasets: [{
        label: 'Les postes existants dans les startups',
        data: [
          companyProfile.projectStage === 'IDEA' ? 1 : 0,
          companyProfile.projectStage === 'PROTOTYPE' ? 1 : 0,
          companyProfile.projectStage === 'PILOT' ? 1 : 0,
          companyProfile.projectStage === 'MARKET_ENTRY' ? 1 : 0,
          companyProfile.projectStage === 'SCALING' ? 1 : 0
        ],
        backgroundColor: '#42A5F5',
        borderColor: '#42A5F5',
        borderWidth: 2
      }]
    };

    // Workforce Analysis
    const workforceData = {
      labels: ['0-5', '5-10', '10-20', '20+'],
      datasets: [{
        label: 'Répartition de l\'Effectif',
        data: [
          companyProfile.workforce <= 5 ? 1 : 0,
          companyProfile.workforce > 5 && companyProfile.workforce <= 10 ? 1 : 0,
          companyProfile.workforce > 10 && companyProfile.workforce <= 20 ? 1 : 0,
          companyProfile.workforce > 20 ? 1 : 0
        ],
        backgroundColor: '#FFEB3B',
        borderColor: '#FFEB3B',
        borderWidth: 2
      }]
    };

    return {
      genderData,
      sectorData,
      certificationData,
      projectStageData,
      workforceData
    };
  };

  const chartData = generateIndicatorCharts();

  if (loading) {
    return (
      <div className="page-wrapper cardhead">
        <div className="content">
          <div className="page-header">
            <div className="row">
              <div className="col-sm-12">
                <h3 className="page-title">Détail du Profil de l'Entreprise</h3>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-body text-center">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Chargement...</span>
                  </div>
                  <p className="mt-3">Chargement des données de l'entreprise...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper cardhead">
        <div className="content">
          <div className="page-header">
            <div className="row">
              <div className="col-sm-12">
                <h3 className="page-title">Détail du Profil de l'Entreprise</h3>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-body text-center">
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                  <button className="btn btn-primary" onClick={() => navigate(-1)}>
                    Retour
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper cardhead" ref={chartRefs.companyOverview}>
      <div className="content">
        {/* Page Header */}
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
          <div className="my-auto mb-2">
            <h2 className="mb-1">{companyProfile?.companyName || 'Entreprise'} - Tableau de Bord</h2>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to="/index"><i className="ti ti-smart-home"></i></Link></li>
                <li className="breadcrumb-item">CRM</li>
                <li className="breadcrumb-item active" aria-current="page">Détail Entreprise</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
            <div className="me-2 mb-2">
              <div className="d-flex align-items-center border bg-white rounded p-1 me-2 icon-list">
                <Link className="btn btn-icon btn-sm me-1" to="/company-overview-dashboard"><i className="ti ti-list-tree"></i></Link>
                <a className="btn btn-icon btn-sm active bg-primary text-white" href="#"><i className="ti ti-layout-grid"></i></a>
              </div>
            </div>
            <div className="me-2 mb-2">
              <div className="dropdown">
                <a className="dropdown-toggle btn btn-white d-inline-flex align-items-center" data-bs-toggle="dropdown" href="#" aria-expanded="false">
                  <i className="ti ti-file-export me-1"></i>Export
                </a>
                <ul className="dropdown-menu dropdown-menu-end p-3">
                  <li>
                    <a
                      className="dropdown-item rounded-1"
                      href="#"
                      onClick={(e) => { e.preventDefault(); downloadPDFReport(); }}
                    >
                      <i className="ti ti-file-type-pdf me-1"></i>Export as PDF
                    </a>
                  </li>
                  <li>
                    <a
                      className="dropdown-item rounded-1"
                      href="#"
                      onClick={(e) => { e.preventDefault(); downloadDashboardPDF(); }}
                    >
                      <i className="ti ti-file-type-xls me-1"></i>Export as Image PDF
                    </a>
                  </li>
                  <li>
                    <a
                      className="dropdown-item rounded-1"
                      href="#"
                      onClick={(e) => { e.preventDefault(); downloadAsImage(); }}
                    >
                      <i className="ti ti-photo me-1"></i>Export as Image
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            {/* Add Deal button and collapse header can be omitted or customized as needed */}
          </div>
        </div>

        {!isExpertSession && (
        <>
        {/* Company Info Cards */}
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card bg-primary text-white">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h4 className="mb-0">{companyProfile?.activityDomain || 'Non spécifié'}</h4>
                    <p className="mb-0">Domaine d'Activité</p>
                  </div>
                  <div className="align-self-center">
                    <i className="fas fa-industry fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h4 className="mb-0">{companyProfile?.projectProgress || 'Non spécifié'}</h4>
                    <p className="mb-0">Les postes existants dans les startups</p>
                  </div>
                  <div className="align-self-center">
                    <i className="fas fa-chart-line fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-warning text-white">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h4 className="mb-0">{companyProfile?.staffRange || 'Non spécifié'}</h4>
                    <p className="mb-0">Effectif</p>
                  </div>
                  <div className="align-self-center">
                    <i className="fas fa-users fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h4 className="mb-0">{companyProfile?.requestStatus || 'EN ATTENTE'}</h4>
                    <p className="mb-0">Statut</p>
                  </div>
                  <div className="align-self-center">
                    <i className="fas fa-flag fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* New Indicators Charts Row 1 */}
        <div className="row">
          {/* Gender Distribution */}
          <div className="col-md-6">
            <div className="card" ref={chartRefs.genderDistribution}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Répartition des startups par genre H / F</h5>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => downloadChart(chartRefs.genderDistribution, 'repartition-genre')}
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
              <div className="card-body">
                <div style={{ height: '300px' }}>
                  <Pie 
                    data={chartData.genderData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                        title: { display: true, text: 'Répartition des Fondateurs par Genre' }
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h6>Analyse:</h6>
                  <p className="text-muted">
                    La répartition par genre révèle les modèles de participation à l'entrepreneuriat dans notre incubateur. 
                    Cette analyse aide à identifier les opportunités d'intervention ciblée pour améliorer la diversité.
                  </p>
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Développer des programmes d'entrepreneuriat axés sur les femmes si un déséquilibre existe</li>
                    <li>Créer des réseaux de mentorat connectant les entrepreneures</li>
                    <li>Organiser des ateliers sectoriels pour encourager la participation inter-genre</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Sector Analysis */}
          <div className="col-md-6">
            <div className="card" ref={chartRefs.sectorAnalysis}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Domaines D'activités</h5>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => downloadChart(chartRefs.sectorAnalysis, 'analyse-sectorielle')}
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
              <div className="card-body">
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={chartData.sectorData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: 'Répartition des Projets par Secteur' }
                      },
                      scales: {
                        y: { beginAtZero: true }
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h6>Analyse:</h6>
                  <p className="text-muted">
                    La répartition sectorielle révèle nos domaines de concentration actuels et l'alignement du marché. 
                    Les projets technologiques dominent généralement, reflétant les tendances d'innovation mondiales.
                  </p>
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Diversifier le portefeuille sectoriel pour réduire la concentration des risques</li>
                    <li>Développer une expertise et des programmes de support sectoriels</li>
                    <li>Identifier les secteurs émergents avec un potentiel de croissance élevé</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* New Indicators Charts Row 2 */}
        <div className="row">
          {/* Quality Certification */}
          <div className="col-md-6">
            <div className="card" ref={chartRefs.certificationRate}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Taux de Certification Qualité</h5>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => downloadChart(chartRefs.certificationRate, 'taux-certification')}
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
              <div className="card-body">
                <div style={{ height: '300px' }}>
                  <Doughnut 
                    data={chartData.certificationData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                        title: { display: true, text: 'Répartition des Projets Certifiés vs Non Certifiés' }
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h6>Analyse:</h6>
                  <p className="text-muted">
                    Les taux de certification qualité indiquent la maturité et la préparation au marché de nos projets incubés. 
                    Les projets certifiés démontrent généralement une crédibilité et un potentiel d'accès au marché plus élevés.
                  </p>
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Implémenter des ateliers de préparation à la certification</li>
                    <li>Développer des partenariats avec les organismes de certification</li>
                    <li>Créer des cadres d'évaluation qualité internes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Project Stage Distribution */}
          <div className="col-md-6">
            <div className="card" ref={chartRefs.projectStageDistribution}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Les postes existants dans les startups</h5>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => downloadChart(chartRefs.projectStageDistribution, 'repartition-etapes')}
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
              <div className="card-body">
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={chartData.projectStageData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: 'Répartition des Projets par Étape de Développement' }
                      },
                      scales: {
                        y: { beginAtZero: true }
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h6>Analyse:</h6>
                  <p className="text-muted">
                    La Les postes existants dans les startups révèle la santé de notre pipeline et l'efficacité du support 
                    à différentes phases de développement. Une répartition équilibrée indique un flux de projets sain.
                  </p>
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Développer des programmes de support spécifiques à chaque étape</li>
                    <li>Créer des critères de progression clairs</li>
                    <li>Implémenter un jumelage de mentorat approprié à chaque phase</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* New Indicators Charts Row 3 */}
        <div className="row">
          {/* Workforce Analysis */}
          <div className="col-md-6">
            <div className="card" ref={chartRefs.workforceAnalysis}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Analyse d'effectif existant dans les Startups</h5>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => downloadChart(chartRefs.workforceAnalysis, 'analyse-effectif')}
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
              <div className="card-body">
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={chartData.workforceData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: 'Répartition de l\'Effectif par Taille d\'Équipe' }
                      },
                      scales: {
                        y: { beginAtZero: true }
                      }
                    }}
                  />
                </div>
                <div className="mt-3">
                  <h6>Analyse:</h6>
                  <p className="text-muted">
                    Les métriques de l'effectif indiquent l'impact de création d'emplois et le succès de mise à l'échelle des projets. 
                    La plupart des projets incubés commencent petits mais les modèles de croissance révèlent un potentiel de mise à l'échelle.
                  </p>
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Fournir un support au développement RH pour les projets en croissance</li>
                    <li>Créer des programmes d'assistance au recrutement</li>
                    <li>Développer des conseils en planification de l'effectif</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Blocking Factors */}
          <div className="col-md-6">
            <div className="card" ref={chartRefs.blockingFactors}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Les facteurs qui ont été un obstacle au développement du produit</h5>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => downloadChart(chartRefs.blockingFactors, 'facteurs-blocage')}
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Les facteurs qui ont été un obstacle au développement du produit</th>
                        <th>Description</th>
                        <th>Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Accès au Financement</td>
                        <td>Capital limité pour les phases de croissance</td>
                        <td><span className="badge bg-danger">Élevé</span></td>
                      </tr>
                      <tr>
                        <td>Conformité Réglementaire</td>
                        <td>Processus complexes de licences et permis</td>
                        <td><span className="badge bg-warning">Moyen</span></td>
                      </tr>
                      <tr>
                        <td>Accès au Marché</td>
                        <td>Difficulté à atteindre les clients cibles</td>
                        <td><span className="badge bg-warning">Moyen</span></td>
                      </tr>
                      <tr>
                        <td>Expertise Technique</td>
                        <td>Lacunes de compétences dans des domaines spécialisés</td>
                        <td><span className="badge bg-info">Faible</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3">
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Établir des connexions avec le réseau d'investisseurs</li>
                    <li>Fournir des conseils en conformité réglementaire</li>
                    <li>Développer des programmes de facilitation d'accès au marché</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Interventions Needed */}
        <div className="row">
          <div className="col-md-12">
            <div className="card" ref={chartRefs.interventionsNeeded}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Les formes d'intervention jugées les plus utiles pour soutenir le processus d'incubation de la S2T</h5>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => downloadChart(chartRefs.interventionsNeeded, 'interventions-requises')}
                >
                  <i className="fas fa-download"></i>
                </button>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Type d'Intervention</th>
                        <th>Description</th>
                        <th>Priorité</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Consultation Stratégie d'Affaires</td>
                        <td>Conseils en stratégie et planification</td>
                        <td><span className="badge bg-danger">Haute</span></td>
                        <td><span className="badge bg-warning">En cours</span></td>
                      </tr>
                      <tr>
                        <td>Formation Compétences Techniques</td>
                        <td>Formation en compétences spécialisées</td>
                        <td><span className="badge bg-warning">Moyenne</span></td>
                        <td><span className="badge bg-success">Terminé</span></td>
                      </tr>
                      <tr>
                        <td>Assistance Planification Financière</td>
                        <td>Conseils en gestion financière</td>
                        <td><span className="badge bg-danger">Haute</span></td>
                        <td><span className="badge bg-info">Planifié</span></td>
                      </tr>
                      <tr>
                        <td>Support Recherche Marché</td>
                        <td>Études de marché et analyses</td>
                        <td><span className="badge bg-warning">Moyenne</span></td>
                        <td><span className="badge bg-warning">En cours</span></td>
                      </tr>
                      <tr>
                        <td>Facilitation Réseautage</td>
                        <td>Connexions avec partenaires et clients</td>
                        <td><span className="badge bg-info">Faible</span></td>
                        <td><span className="badge bg-success">Terminé</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3">
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Élargir les capacités de consultation internes</li>
                    <li>Développer des curricula de formation complets</li>
                    <li>Renforcer les réseaux d'experts externes</li>
                    <li>Créer des systèmes de support entre pairs</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        </>
        )}

        {/* Company Details */}
        <div className="row mt-4">
          <div className="col-md-12">
            <div className="card" ref={chartRefs.companyDetails}>
              <div className="card-header">
                <h5 className="card-title mb-0">Informations Détaillées de l'Entreprise</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <table className="table table-borderless">
                      <tbody>
                        <tr>
                          <td><strong>Nom de l'Entreprise:</strong></td>
                          <td>{companyProfile?.companyName || 'Non spécifié'}</td>
                        </tr>
                        <tr>
                          <td><strong>Fondateur:</strong></td>
                          <td>{companyProfile?.founderName || 'Non spécifié'}</td>
                        </tr>
                        <tr>
                          <td><strong>Email:</strong></td>
                          <td>{companyProfile?.email || 'Non spécifié'}</td>
                        </tr>
                        <tr>
                          <td><strong>Domaine d'Activité:</strong></td>
                          <td>{companyProfile?.activityDomain || 'Non spécifié'}</td>
                        </tr>
                        <tr>
                          <td><strong>Sous-Domaine:</strong></td>
                          <td>{companyProfile?.activitySubDomain || 'Non spécifié'}</td>
                        </tr>
                        <tr>
                          <td><strong>Genre du Fondateur:</strong></td>
                          <td>
                            {companyProfile?.gender === 'MALE' ? 'Homme' : 
                             companyProfile?.gender === 'FEMALE' ? 'Femme' : 
                             companyProfile?.gender === 'OTHER' ? 'Autre' : 'Non spécifié'}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Les postes existants dans les startups:</strong></td>
                          <td>
                            {companyProfile?.projectStage === 'IDEA' ? 'Idée' :
                             companyProfile?.projectStage === 'PROTOTYPE' ? 'Prototype' :
                             companyProfile?.projectStage === 'PILOT' ? 'Pilote' :
                             companyProfile?.projectStage === 'MARKET_ENTRY' ? 'Entrée Marché' :
                             companyProfile?.projectStage === 'SCALING' ? 'Mise à l\'Échelle' : 'Non spécifié'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="col-md-6">
                    <table className="table table-borderless">
                      <tbody>
                        <tr>
                          <td><strong>Avancement du Projet:</strong></td>
                          <td>{companyProfile?.projectProgress || 'Non spécifié'}</td>
                        </tr>
                        <tr>
                          <td><strong>Effectif:</strong></td>
                          <td>{companyProfile?.workforce || 'Non spécifié'} Les postes existants dans les startups</td>
                        </tr>
                        <tr>
                          <td><strong>Certification Qualité:</strong></td>
                          <td>
                            {companyProfile?.qualityCertification ? 
                              <span className="badge bg-success">Certifié</span> : 
                              <span className="badge bg-warning">Non Certifié</span>
                            }
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Détails Certification:</strong></td>
                          <td>{companyProfile?.certificationDetails || 'Non spécifié'}</td>
                        </tr>
                        <tr>
                          <td><strong>Statut:</strong></td>
                          <td>
                            <span className={`badge bg-${
                              companyProfile?.requestStatus === 'APPROVED' ? 'success' : 
                              companyProfile?.requestStatus === 'REJECTED' ? 'danger' : 'warning'
                            }`}>
                              {companyProfile?.requestStatus || 'EN ATTENTE'}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Adresse:</strong></td>
                          <td>{companyProfile?.address || 'Non spécifié'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyDetailDashboard; 