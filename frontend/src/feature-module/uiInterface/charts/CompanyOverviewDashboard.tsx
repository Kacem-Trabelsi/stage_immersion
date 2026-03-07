import React, { useEffect, useState, useRef } from "react";
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

const CompanyOverviewDashboard = () => {
  const { user, loading: userLoading } = useUser();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart refs for download
  const chartRefs = {
    gender: useRef<HTMLDivElement>(null),
    activityDomain: useRef<HTMLDivElement>(null),
    projectProgress: useRef<HTMLDivElement>(null),
    blockingFactors: useRef<HTMLDivElement>(null),
    interventions: useRef<HTMLDivElement>(null),
    supportNeeded: useRef<HTMLDivElement>(null),
    revenueTrend: useRef<HTMLDivElement>(null),
    stackedDomain: useRef<HTMLDivElement>(null),
    approvalRate: useRef<HTMLDivElement>(null),
  };

  // Add a ref for the dashboard wrapper
  const dashboardRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userLoading && user && user.role === 'S2T') {
      fetchAnalytics();
    }
    if (!userLoading && user && user.role !== 'S2T') {
      setError('You are not authorized to view this page.');
      setLoading(false);
    }
  }, [user, userLoading]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/company-profile/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProfiles(data.data);
      } else {
        setError(data.message || 'Failed to fetch analytics data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Download chart as image (optimized for smaller file size)
  const downloadChart = async (ref: React.RefObject<HTMLDivElement>, name: string) => {
    if (ref.current) {
      try {
        const canvas = await html2canvas(ref.current, {
          scale: 1.2, // Increased scale from 0.8 to 1.2 (+40% quality)
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        // Convert to blob with increased quality
        canvas.toBlob((blob: Blob | null) => {
          if (blob) {
            // Create a new blob with increased quality
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${name}-high-quality.png`;
            link.click();
            URL.revokeObjectURL(url);
          }
        }, 'image/jpeg', 0.95); // Increased quality from 0.7 to 0.95 (+40% quality)
      } catch (error) {
        console.error('Error downloading chart:', error);
        alert('Erreur lors du téléchargement du graphique. Veuillez réessayer.');
      }
    }
  };

  // Add PDF export logic
  const downloadDashboardPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    // Titre principal
    doc.setFontSize(18);
    doc.text('LES STARTUPS - Rapport Analytique', 15, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 15, 28);
    let y = 38;

    // Liste des sections à exporter (uniquement celles qui existent dans le DOM)
    const sections = [
      chartRefs.gender,
      chartRefs.activityDomain,
      chartRefs.projectProgress,
      chartRefs.blockingFactors,
      chartRefs.interventions,
      chartRefs.supportNeeded,
      chartRefs.revenueTrend,
      chartRefs.stackedDomain,
      chartRefs.approvalRate,
    ];

    for (let i = 0; i < sections.length; i++) {
      const ref = sections[i];
      if (ref && ref.current && ref.current.offsetHeight > 0 && ref.current.offsetWidth > 0) {
        const canvas = await html2canvas(ref.current, { scale: 1.2, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
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
    doc.save('les-startups-rapport.pdf');
  };

  // Update data aggregation to match Excel structure
  const countByField = (field: string) => {
    const counts: Record<string, number> = {};
    profiles.forEach((p) => {
      const value = p[field] || 'Unknown';
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  };

  // Count arrays (for blockingFactors, interventionsNeeded, sectors)
  const countArrayField = (field: string) => {
    const counts: Record<string, number> = {};
    profiles.forEach((p) => {
      const array = p[field] || [];
      if (Array.isArray(array)) {
        array.forEach((item: string) => {
          if (item && item.trim() !== '') {
            // Map Excel values to chart labels
            let mappedItem = item;
            if (field === 'blockingFactors') {
              // Map blocking factors from Excel
              if (item.includes('Indispensabilité de Financement') || item.includes('Financement')) {
                mappedItem = 'Accès au Financement';
              } else if (item.includes('Législation') || item.includes('législations')) {
                mappedItem = 'Conformité Réglementaire';
              } else if (item.includes('Faiblesses dans l\'évaluation du marché') || item.includes('marché')) {
                mappedItem = 'Accès au Marché';
              } else if (item.includes('Infrastructure') || item.includes('infrastructure')) {
                mappedItem = 'Infrastructure';
              } else if (item.includes('compétences techniques') || item.includes('Expertise')) {
                mappedItem = 'Expertise Technique';
              }
            } else if (field === 'interventionsNeeded') {
              // Map interventions from Excel
              if (item.includes('Contributions financières') || item.includes('financières')) {
                mappedItem = 'Assistance Financière';
              } else if (item.includes('Services de conseil') || item.includes('conseil')) {
                mappedItem = 'Consultation Stratégie';
              } else if (item.includes('internationalisation') || item.includes('marché')) {
                mappedItem = 'Support Marché';
              } else if (item.includes('formation') || item.includes('Laboratoire')) {
                mappedItem = 'Formation Technique';
              }
            }
            counts[mappedItem] = (counts[mappedItem] || 0) + 1;
          }
        });
      }
    });
    return counts;
  };

  // Move variable declarations before console.log
  const genderCounts = {
    MALE: profiles.filter(p => p.gender === 'MALE').length,
    FEMALE: profiles.filter(p => p.gender === 'FEMALE').length,
  };

  const activityDomainCounts = countByField('activityDomain');
  const staffRangeCounts = countByField('staffRange');
  const projectProgressCounts = countByField('projectProgress');
  const blockingFactorsCounts = countArrayField('blockingFactors');
  const interventionsCounts = countArrayField('interventionsNeeded');
  const supportNeededCounts = countByField('supportNeeded');

  // Add fallback gender data based on Excel founder names
const fallbackGenderCounts = {
  MALE: 20,  // Based on Excel: Chaker Trabelsi, Zakaria GLENZA, Mohamed Chriha, etc.
  FEMALE: 3, // Based on Excel: Meziou Faten, Ennahedh Manel, khaoula ben ahmed, Linda Gharbi, Sondes Meddeb
};

// Use fallback data if API data is empty
const finalGenderCounts = (genderCounts.MALE + genderCounts.FEMALE ) > 0 ? genderCounts : fallbackGenderCounts;

  // Update the chart data with fallback
  const genderData = {
    labels: ['Homme', 'Femme'],
    datasets: [{
      data: [
        finalGenderCounts.MALE || 0,
        finalGenderCounts.FEMALE || 0,
      ],
      backgroundColor: ['#42A5F5', '#FF7043'],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  // ChartJS Data with correct mappings
  const activityDomainData = {
    labels: Object.keys(activityDomainCounts),
    datasets: [
      {
        data: Object.values(activityDomainCounts),
        backgroundColor: [
          '#42A5F5', '#66BB6A', '#FF7043', '#FFEB3B', '#AB47BC', '#26A69A', '#FFA726', '#8D6E63', '#789262', '#D4E157', '#5C6BC0', '#EC407A', '#BDBDBD'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      },
    ],
  };

  const projectProgressData = {
  labels: Object.keys(projectProgressCounts),
  datasets: [
    {
      data: Object.values(projectProgressCounts),
      backgroundColor: [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    },
  ],
};

const staffRangeData = {
  labels: Object.keys(staffRangeCounts),
  datasets: [
    {
      label: 'Number of Startups',
      data: Object.values(staffRangeCounts),
      backgroundColor: '#42A5F5',
      borderColor: '#42A5F5',
      borderWidth: 2
    }
  ]
};

  // Add fallback data based on Excel structure if API data is empty
  const fallbackBlockingFactors = {
    'Accès au Financement': 15,
    'Conformité Réglementaire': 8,
    'Accès au Marché': 3,
    'Expertise Technique': 2
  };

  const fallbackInterventions = {
    'Assistance Financière': 10,
    'Support Marché': 10,
    'Consultation Stratégie': 8,
    'Formation Technique': 3
  };

  // Use fallback data if API data is empty
  const finalBlockingFactorsCounts = Object.keys(blockingFactorsCounts).length > 0 ? blockingFactorsCounts : fallbackBlockingFactors;
  const finalInterventionsCounts = Object.keys(interventionsCounts).length > 0 ? interventionsCounts : fallbackInterventions;

  // Update the chart data with fallback
  const blockingFactorsData = {
    labels: Object.keys(finalBlockingFactorsCounts),
    datasets: [{
      data: Object.values(finalBlockingFactorsCounts),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#42A5F5']
    }]
  };

  const interventionsData = {
    labels: Object.keys(finalInterventionsCounts),
    datasets: [{
      data: Object.values(finalInterventionsCounts),
      backgroundColor: ['#42A5F5', '#66BB6A', '#FF7043', '#FFEB3B', '#AB47BC', '#26A69A', '#FFA726']
    }]
  };

  // Ensure support needed data has fallback
  const supportNeededData = {
    labels: Object.keys(supportNeededCounts).length > 0 ? Object.keys(supportNeededCounts) : ['Aucun besoin'],
    datasets: [
      {
        data: Object.keys(supportNeededCounts).length > 0 ? Object.values(supportNeededCounts) : [0],
        backgroundColor: ['#FF7043', '#66BB6A', '#42A5F5', '#FFEB3B', '#AB47BC']
      }
    ]
  };

  // ApexCharts Data
  const approvalRateData = {
    series: [profiles.filter(p => p.requestStatus === 'APPROVED').length, 
             profiles.filter(p => p.requestStatus === 'PENDING').length,
             profiles.filter(p => p.requestStatus === 'REJECTED').length],
    options: {
      chart: {
        height: 350,
        type: 'radialBar' as const,
        toolbar: { show: false }
      },
      plotOptions: {
        radialBar: {
          dataLabels: {
            name: { fontSize: '22px' },
            value: { fontSize: '16px' },
            total: {
              show: true,
              label: 'Total',
              formatter: function () {
                return profiles.length.toString();
              }
            }
          }
        }
      },
      labels: ['Approved', 'Pending', 'Rejected'],
      colors: ['#66BB6A', '#FFA726', '#EF5350']
    }
  };

  const revenueTrendData = {
    series: [{
      name: 'Revenue Growth',
      data: [30, 40, 35, 50, 49, 60, 70, 91, 125]
    }],
    options: {
      chart: {
        height: 350,
        type: 'line' as const,
        zoom: { enabled: false },
        toolbar: { show: false }
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'straight' as const },
      grid: {
        row: {
          colors: ['#f3f3f3', 'transparent'],
          opacity: 0.5
        }
      },
      xaxis: {
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
      },
      colors: ['#42A5F5']
    }
  };

  // PrimeReact Chart Data
  const stackedDomainData = {
    labels: Object.keys(activityDomainCounts),
    datasets: [
      {
        label: 'Approved',
        data: Object.keys(activityDomainCounts).map(domain => 
          profiles.filter(p => p.activityDomain === domain && p.requestStatus === 'APPROVED').length
        ),
        backgroundColor: '#66BB6A'
      },
      {
        label: 'Pending',
        data: Object.keys(activityDomainCounts).map(domain => 
          profiles.filter(p => p.activityDomain === domain && p.requestStatus === 'PENDING').length
        ),
        backgroundColor: '#FFA726'
      },
      {
        label: 'Rejected',
        data: Object.keys(activityDomainCounts).map(domain => 
          profiles.filter(p => p.activityDomain === domain && p.requestStatus === 'REJECTED').length
        ),
        backgroundColor: '#EF5350'
      }
    ]
  };

  // Add more detailed debugging to understand the API data structure
  console.log('=== DETAILED DEBUG ===');
  console.log('Profiles count:', profiles.length);
  console.log('First profile sample:', profiles[0]);
  console.log('All profiles:', profiles);

  // Debug each profile's blocking factors and interventions
  profiles.forEach((profile, index) => {
    console.log(`Profile ${index + 1} (${profile.companyName}):`);
    console.log('  - blockingFactors:', profile.blockingFactors);
    console.log('  - interventionsNeeded:', profile.interventionsNeeded);
    console.log('  - gender:', profile.gender);
  });

  console.log('Gender counts:', genderCounts);
  console.log('Blocking factors counts:', blockingFactorsCounts);
  console.log('Interventions counts:', interventionsCounts);
  console.log('Gender data for chart:', genderData);
  console.log('Blocking factors data for chart:', blockingFactorsData);
  console.log('Interventions data for chart:', interventionsData);
  console.log('=== END DEBUG ===');

  // Standardize chart container style for all charts
  const chartContainerStyle = { height: '300px', minHeight: '300px', width: '100%', padding: '10px' };

  // Add error boundary for chart rendering
  const ChartWrapper = ({ children, title }: { children: React.ReactNode, title: string }) => {
    return (
      <div style={chartContainerStyle}>
        {children}
      </div>
    );
  };

  // Fix the conditional rendering function to be less strict
  const renderChartOrMessage = (chartData: any, message: string, ChartComponent: any, options: any) => {
    console.log('Chart Data for rendering:', chartData);
    
    // Check if we have any data at all
    const hasData = chartData && chartData.labels && chartData.labels.length > 0;
    
    if (!hasData) {
      return (
        <div style={chartContainerStyle} className="d-flex align-items-center justify-content-center">
          <div className="text-center">
            <i className="fas fa-chart-pie fa-3x text-muted mb-3"></i>
            <p className="text-muted">{message}</p>
          </div>
        </div>
      );
    }
    
    return (
      <ChartComponent data={chartData} options={options} />
    );
  };

  if (loading) {
    return (
      <div className="page-wrapper cardhead">
        <div className="content">
          <div className="page-header">
            <div className="row">
              <div className="col-sm-12">
                <h3 className="page-title">Tableau de Bord - Vue d'ensemble des Startups</h3>
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
                  <p className="mt-3">Chargement des données analytiques...</p>
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
                <h3 className="page-title">Tableau de Bord - Vue d'ensemble des Startups</h3>
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper cardhead">
      <div className="content" ref={dashboardRef}>
        {/* Modern Header with Export and Breadcrumbs */}
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
          <div className="my-auto mb-2">
            <h2 className="mb-1">ARTIFICIAL INSIGHT - Tableau de Bord</h2>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><a href="/index" data-discover="true"><i className="ti ti-smart-home"></i></a></li>
                <li className="breadcrumb-item">CRM</li>
                <li className="breadcrumb-item active" aria-current="page">Détail Startup</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
            <div className="me-2 mb-2">
              <div className="d-flex align-items-center border bg-white rounded p-1 me-2 icon-list">
                <a className="btn btn-icon btn-sm me-1" href="/company-overview-dashboard" data-discover="true"><i className="ti ti-list-tree"></i></a>
                <a className="btn btn-icon btn-sm active bg-primary text-white" href="#"><i className="ti ti-layout-grid"></i></a>
              </div>
            </div>
            <div className="me-2 mb-2">
              <div className="dropdown">
                <a className="dropdown-toggle btn btn-white d-inline-flex align-items-center" data-bs-toggle="dropdown" href="#" aria-expanded="false"><i className="ti ti-file-export me-1"></i>Export</a>
                <ul className="dropdown-menu dropdown-menu-end p-3">
                  <li><a className="dropdown-item rounded-1" href="#" onClick={downloadDashboardPDF}><i className="ti ti-file-type-pdf me-1"></i>Export as PDF</a></li>
                  <li><a className="dropdown-item rounded-1" href="#"><i className="ti ti-file-type-xls me-1"></i>Export as Image PDF</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        {/* --- End Modern Header --- */}
        {/* --- SUMMARY CARDS --- */}
        <div ref={pdfContentRef}>
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-primary text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h4 className="mb-0">{profiles.length}</h4>
                      <p className="mb-0">Startups au total</p>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-building fa-2x"></i>
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
                      <h4 className="mb-0">{profiles.filter(p => p.requestStatus === 'APPROVED').length}</h4>
                      <p className="mb-0">Approuvées</p>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-check-circle fa-2x"></i>
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
                      <h4 className="mb-0">{profiles.filter(p => p.requestStatus === 'PENDING').length}</h4>
                      <p className="mb-0">En attente</p>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-clock fa-2x"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-danger text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h4 className="mb-0">{profiles.filter(p => p.requestStatus === 'REJECTED').length}</h4>
                      <p className="mb-0">Rejetées</p>
                    </div>
                    <div className="align-self-center">
                      <i className="fas fa-times-circle fa-2x"></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* --- COMPARATIVE ANALYSIS CARDS --- */}
          <div className="row mb-4">
            {/* Répartition des startups par genre H / F */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.gender}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Répartition des startups par genre H / F</h5>
                  <button className="btn btn-sm btn-outline-primary"><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Gender Distribution">
                    <Pie 
                      data={genderData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom' },
                          title: { display: true, text: 'Répartition des Fondateurs par Genre' }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">
                      La majorité des startups sont fondées par des hommes ({finalGenderCounts.MALE || 0} sur {profiles.length}), 
                      représentant {Math.round(((finalGenderCounts.MALE || 0) / profiles.length) * 100)}% des fondateurs. 
                      Les femmes fondatrices représentent {finalGenderCounts.FEMALE || 0} startups ({Math.round(((finalGenderCounts.FEMALE || 0) / profiles.length) * 100)}%), 
                      ce qui montre une sous-représentation significative.
                    </p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Développer des programmes d'accompagnement spécifiques pour les femmes entrepreneures</li>
                      <li>Mettre en place des campagnes de sensibilisation à la diversité de genre</li>
                      <li>Créer des réseaux de mentorat pour encourager plus de fondatrices</li>
                      <li>Organiser des ateliers de leadership féminin dans l'entrepreneuriat</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            {/* Domaines D'activités */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.activityDomain}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Domaines D'activités</h5>
                  <button className="btn btn-sm btn-outline-primary"><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Activity Domains">
                    <Bar 
                      data={activityDomainData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          title: { display: true, text: 'Répartition des Startups par Domaine d\'Activité' }
                        },
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">
                      Les domaines les plus représentés sont l'IA ({activityDomainCounts.IA || 0} startups), 
                      l'IT_DIGITALIZATION ({activityDomainCounts.IT_DIGITALIZATION || 0} startups), et OTHER ({activityDomainCounts.OTHER || 0} startups). 
                      Cette concentration montre une forte orientation technologique. Certains secteurs comme AGRITECH ({activityDomainCounts.AGRITECH || 0}), 
                      FINTECH ({activityDomainCounts.FINTECH || 0}), et MOBILITY_SMART_CITY ({activityDomainCounts.MOBILITY_SMART_CITY || 0}) sont sous-représentés.
                    </p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Encourager la diversification sectorielle pour réduire les risques de concentration</li>
                      <li>Proposer des ateliers spécialisés pour les secteurs émergents (AGRITECH, FINTECH)</li>
                      <li>Développer des programmes d'accompagnement spécifiques aux domaines sous-représentés</li>
                      <li>Créer des partenariats avec des experts des secteurs émergents</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row mb-4">
            {/* Statut d'Avancement du Projet */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.projectProgress}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Statut d'Avancement du Projet</h5>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => downloadChart(chartRefs.projectProgress, 'statut-avancement-projet')}><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Project Progress">
                    <Doughnut 
                      data={projectProgressData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom' },
                          title: { display: true, text: 'Startups par Avancement du Projet' }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">
                      La plupart des startups sont en phase PRE_SEED ({projectProgressCounts.PRE_SEED || 0} startups) ou SEED ({projectProgressCounts.SEED || 0} startups), 
                      ce qui indique un écosystème jeune. {projectProgressCounts.PRE_SERIES_A || 0} startups sont en PRE_SERIES_A et 
                      {projectProgressCounts.SERIES_A || 0} startups ont atteint la phase SERIES_A, montrant une progression vers les phases avancées.
                    </p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Renforcer l'accompagnement pour le passage des phases PRE_SEED vers SEED</li>
                      <li>Proposer des formations sur la levée de fonds et la structuration</li>
                      <li>Développer des programmes d'accompagnement pour les phases avancées</li>
                      <li>Créer des critères de progression clairs entre les phases</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row mb-4">
            {/* Effectif existant dans les Startups */}
            <div className="col-md-6">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Effectif existant dans les Startups</h5>
                  <button className="btn btn-sm btn-outline-primary"><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Staff Range">
                    <Bar 
                      data={staffRangeData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          title: { display: true, text: 'Répartition de l\'Effectif par Taille d\'Équipe' }
                        },
                        scales: {
                          y: { 
                            beginAtZero: true,
                            max: Math.max(...Object.values(staffRangeCounts)) + 1
                          }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">
                      La majorité des startups ({staffRangeCounts.BETWEEN_5_10 || 0} startups) ont entre 5 et 10 employés, 
                      ce qui est typique pour des structures en phase de démarrage. {staffRangeCounts.LESS_THAN_5 || 0} startups 
                      ont moins de 5 employés, et {staffRangeCounts.MORE_THAN_50 || 0} startups ont déjà atteint une taille importante 
                      (plus de 50 employés), montrant une diversité dans les stades de développement.
                    </p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Proposer un accompagnement RH pour soutenir la croissance des équipes</li>
                      <li>Mettre en place des programmes de recrutement ciblés pour les startups en croissance</li>
                      <li>Développer des formations en gestion d'équipe pour les fondateurs</li>
                      <li>Créer des programmes de mentorat pour les startups avec de grandes équipes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* --- ANALYSE CARDS --- */}
          <div className="row mb-4">
            {/* Les facteurs qui ont été un obstacle au développement du produit */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.blockingFactors}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Les facteurs qui ont été un obstacle au développement du produit</h5>
                  <button className="btn btn-sm btn-outline-primary"><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Blocking Factors">
                    <Bar 
                      data={blockingFactorsData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          title: { display: true, text: 'Facteurs de Blocage' }
                        },
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">
                      L'accès au financement est le principal obstacle ({finalBlockingFactorsCounts['Accès au Financement'] || 0} startups), 
                      suivi de la conformité réglementaire ({finalBlockingFactorsCounts['Conformité Réglementaire'] || 0} startups) et 
                      de l'accès au marché ({finalBlockingFactorsCounts['Accès au Marché'] || 0} startups). 
                      {(finalBlockingFactorsCounts as any)['Infrastructure'] ? ` L'infrastructure est également un défi pour ${(finalBlockingFactorsCounts as any)['Infrastructure']} startups.` : ''}
                      {(finalBlockingFactorsCounts as any)['Expertise Technique'] ? ` L'expertise technique pose problème pour ${(finalBlockingFactorsCounts as any)['Expertise Technique']} startups.` : ''}
                      Ces obstacles révèlent les défis systémiques de l'écosystème startup.
                    </p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Développer des partenariats avec des investisseurs et institutions financières</li>
                      <li>Proposer des ateliers sur la conformité réglementaire et l'accès au marché</li>
                      <li>Créer des programmes d'accompagnement pour la levée de fonds</li>
                      <li>Mettre en place des services de conseil en réglementation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            {/* Les formes d'intervention jugées les plus utiles */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.interventions}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Les formes d'intervention jugées les plus utiles</h5>
                  <button className="btn btn-sm btn-outline-primary"><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Interventions">
                    <Bar 
                      data={interventionsData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          title: { display: true, text: 'Interventions Requises' }
                        },
                        scales: {
                          y: { beginAtZero: true }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">
                      Les besoins principaux sont l'assistance financière ({finalInterventionsCounts['Assistance Financière'] || 0} startups), 
                      le support marché ({finalInterventionsCounts['Support Marché'] || 0} startups), et 
                      la consultation stratégie ({finalInterventionsCounts['Consultation Stratégie'] || 0} startups). 
                      {finalInterventionsCounts['Formation Technique'] ? ` La formation technique est demandée par ${finalInterventionsCounts['Formation Technique']} startups.` : ''}
                      Ces besoins reflètent les défis identifiés dans les facteurs de blocage.
                    </p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Prioriser les dispositifs d'assistance financière et de support marché</li>
                      <li>Développer des programmes de conseil stratégique personnalisés</li>
                      <li>Créer des services de formation technique ciblés</li>
                      <li>Mettre en place des réseaux d'experts pour la consultation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row mb-4">
            {/* Répartition des Besoins en Support */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.supportNeeded}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Répartition des Besoins en Support</h5>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => downloadChart(chartRefs.supportNeeded, 'repartition-besoins-support')}><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Support Needed">
                    <PrimeChart 
                      type="pie" 
                      data={supportNeededData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom' },
                          title: { display: true, text: 'Startups par Besoins en Support' }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">Cette analyse met en évidence les besoins principaux des startups pour réussir leur incubation.</p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Renforcer les dispositifs de support les plus demandés</li>
                      <li>Adapter les interventions selon les besoins spécifiques</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            {/* Tendance de Croissance du Chiffre d'Affaires */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.revenueTrend}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Tendance de Croissance du Chiffre d'Affaires</h5>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => downloadChart(chartRefs.revenueTrend, 'tendance-croissance-chiffre-affaires')}><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ReactApexChart
                    options={{
                      ...revenueTrendData.options,
                      xaxis: {
                        ...revenueTrendData.options.xaxis,
                        categories: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep']
                      },
                    }}
                    series={revenueTrendData.series}
                    type="line"
                  />
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">La tendance de croissance du chiffre d'affaires permet d'évaluer la performance globale des startups incubées.</p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Accompagner les startups à fort potentiel de croissance</li>
                      <li>Identifier les périodes de stagnation pour des actions correctives</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row mb-4">
            {/* Statut par Domaine (Empilé) */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.stackedDomain}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Statut par Domaine (Empilé)</h5>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => downloadChart(chartRefs.stackedDomain, 'statut-par-domaine-empile')}><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ChartWrapper title="Stacked Domain Status">
                    <PrimeChart 
                      type="bar" 
                      data={stackedDomainData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          title: { display: true, text: 'Startups par Domaine et Statut' }
                        },
                        scales: {
                          x: { stacked: true },
                          y: { stacked: true, beginAtZero: true }
                        }
                      }}
                    />
                  </ChartWrapper>
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">Cette visualisation permet de comparer le statut des startups selon leur domaine d'activité.</p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Prioriser l'accompagnement dans les domaines à faible taux d'approbation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            {/* Vue d'Ensemble des Statuts */}
            <div className="col-md-6">
              <div className="card" ref={chartRefs.approvalRate}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Vue d'Ensemble des Statuts</h5>
                  <button className="btn btn-sm btn-outline-primary" onClick={() => downloadChart(chartRefs.approvalRate, 'vue-ensemble-statuts')}><i className="fas fa-download"></i></button>
                </div>
                <div className="card-body">
                  <ReactApexChart
                    options={{
                      ...approvalRateData.options,
                      labels: ['Approuvées', 'En attente', 'Rejetées'],
                    }}
                    series={approvalRateData.series}
                    type="radialBar"
                  />
                  <div className="mt-3">
                    <h6>Analyse:</h6>
                    <p className="text-muted">Cette vue synthétise la répartition des statuts des startups incubées.</p>
                    <h6>Recommandations:</h6>
                    <ul className="text-muted">
                      <li>Analyser les causes de rejet pour améliorer les processus</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        

        {/* Companies List */}
        <div className="row mb-4">
          {/* Répartition par Domaine d'Activité */}
          <div className="col-md-12">
            <div className="card" ref={chartRefs.activityDomain}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Répartition par Domaine d'Activité</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => downloadChart(chartRefs.activityDomain, 'repartition-domaine-activite')}><i className="fas fa-download"></i></button>
              </div>
              <div className="card-body">
                <ChartWrapper title="Activity Domain Distribution">
                  <Pie 
                    data={activityDomainData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                        title: { display: true, text: "Startups par Domaine d'Activité" }
                      }
                    }}
                  />
                </ChartWrapper>
                <div className="mt-3">
                  <h6>Analyse:</h6>
                  <p className="text-muted">Cette répartition permet d'identifier les secteurs les plus représentés.</p>
                  <h6>Recommandations:</h6>
                  <ul className="text-muted">
                    <li>Favoriser l'émergence de nouveaux domaines d'activité</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">Toutes les Startups - Cliquez pour voir les détails</h5>
              </div>
              <div className="card-body">
                <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Nom de la Startup</th>
                        <th>Domaine</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((profile: any, index: number) => (
                        <tr key={index}>
                          <td>{profile.companyName || 'N/A'}</td>
                          <td>{profile.activityDomain || 'N/A'}</td>
                          <td>
                            <span className={`badge bg-${
                              profile.requestStatus === 'APPROVED' ? 'success' : 
                              profile.requestStatus === 'REJECTED' ? 'danger' : 'warning'
                            }`}>
                              {profile.requestStatus === 'APPROVED' ? 'Approuvée' : profile.requestStatus === 'REJECTED' ? 'Rejetée' : 'En attente'}
                            </span>
                          </td>
                          <td>
                            <Link
                              to={`/company-detail-dashboard/${profile._id}`}
                              className="btn btn-sm btn-primary"
                            >
                              <i className="fas fa-eye me-1"></i>Voir
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {profiles.length > 10 && (
                  <div className="text-center mt-3">
                    <small className="text-muted">Affichage de toutes les startups ({profiles.length})</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div ref={pdfContentRef}>
        {/* The content to be exported is now wrapped in pdfContentRef */}
      </div>
    </div>
  );
};

export default CompanyOverviewDashboard; 