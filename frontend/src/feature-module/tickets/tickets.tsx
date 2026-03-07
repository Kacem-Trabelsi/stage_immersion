import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import ReactApexChart from "react-apexcharts";
import TicketListModal from "../../core/modals/ticketListModal";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import ticketService from "../../services/ticketService";
import { useAuth } from "../../contexts/AuthContext";
import TicketFilters from "../../core/common/TicketFilters";

interface Ticket {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  impact: string;
  status: string;
  contactEmail: string;
  companyName: string;
  createdAt: string;
  updatedAt: string;
  reportedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  comments?: any[];
}

interface FilterOptions {
  priority: string;
  status: string;
  sortBy: string;
  sortOrder: string;
  search: string;
}

const Tickets = () => {
  const routes = all_routes;
  const { user } = useAuth();
  
  // États pour les tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filters, setFilters] = useState<FilterOptions>({
    priority: '',
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    search: ''
  });
  const [statistics, setStatistics] = useState({
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    pendingTickets: 0,
    growthPercentages: {
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0
    }
  });

  // Charger les tickets et statistiques
  useEffect(() => {
    loadTickets();
    loadStatistics();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [filters]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await ticketService.getAllTickets({ ...filters, limit: 10 });
      
      if (response.success) {
        setTickets(response.data);
      } else {
        setError('Erreur lors du chargement des tickets');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des tickets:', err);
      setError(err.message || 'Erreur lors du chargement des tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const loadStatistics = async () => {
    try {
      const response = await ticketService.getTicketStatistics();
      
      if (response.success) {
        const stats = response.data.overview;
        setStatistics({
          totalTickets: stats.totalTickets || 0,
          openTickets: stats.openTickets || 0,
          resolvedTickets: stats.resolvedTickets || 0,
          pendingTickets: stats.inProgressTickets || 0,
          growthPercentages: stats.growthPercentages || {
            totalTickets: 0,
            openTickets: 0,
            resolvedTickets: 0
          }
        });
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des statistiques:', err);
    }
  };

  // Fonctions utilitaires pour l'affichage
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'danger';
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      default: return 'secondary';
    }
  };

  // Fonction pour formater les pourcentages
  const formatPercentage = (percentage: number) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  // Fonction pour obtenir l'icône de tendance
  const getTrendIcon = (percentage: number) => {
    return percentage >= 0 ? 'ti-trending-up' : 'ti-trending-down';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'pink';
      case 'IN_PROGRESS': return 'warning';
      case 'PENDING': return 'info';
      case 'RESOLVED': return 'success';
      case 'CLOSED': return 'secondary';
      default: return 'light';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'OPEN': return 'Open';
      case 'IN_PROGRESS': return 'In Progress';
      case 'PENDING': return 'On Hold';
      case 'RESOLVED': return 'Resolved';
      case 'CLOSED': return 'Closed';
      default: return status;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'TECHNICAL': 'IT Support',
      'BUSINESS': 'Business',
      'LEGAL': 'Legal',
      'FINANCIAL': 'Financial',
      'MARKETING': 'Marketing',
      'OPERATIONAL': 'Operational',
      'HUMAN_RESOURCES': 'HR',
      'OTHER': 'Other'
    };
    return labels[category] || category;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  const [Areachart] = useState<any>({
    series: [
      {
        name: "Messages",
        data: [8, 5, 6, 3, 4, 6, 7, 3, 8, 6, 4, 7],
      },
    ],

    chart: {
      type: "bar",
      width: 70,
      height: 70,
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      dropShadow: {
        enabled: false,
        top: 3,
        left: 14,
        blur: 4,
        opacity: 0.12,
        color: "#fff",
      },
      sparkline: {
        enabled: !0,
      },
    },
    markers: {
      size: 0,
      colors: ["#F26522"],
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: {
        size: 7,
      },
    },
    plotOptions: {
      bar: {
        horizontal: !1,
        columnWidth: "35%",
        endingShape: "rounded",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: !0,
      width: 2.5,
      curve: "smooth",
    },
    colors: ["#FF6F28"],
    xaxis: {
      categories: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
      ],
      labels: {
        show: false,
      },
    },
    tooltip: {
      show: false,
      theme: "dark",
      fixed: {
        enabled: false,
      },
      x: {
        show: false,
      },

      marker: {
        show: false,
      },
    },
  });
  const [Areachart1] = useState<any>({
    series: [{
        name: "Messages",
        data: [8,5,6,3,4,6,7,3,8,6,4,7]
      }],

      chart: {
        type: 'bar',
        width: 70,
        height:70,
        toolbar: {
          show: false
        },
        zoom: {
          enabled: false
        },
        dropShadow: {
          enabled: false,
          top: 3,
          left: 14,
          blur: 4,
          opacity: .12,
          color: "#fff"
        },
        sparkline: {
          enabled: !0
        }
      },
      markers: {
        size: 0,
        colors: ["#F26512"],
        strokeColors: "#fff",
        strokeWidth: 2,
        hover: {
          size: 7
        }
      },
      plotOptions: {
        bar: {
          horizontal: !1,
          columnWidth: "35%",
          endingShape: "rounded"
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        show: !0,
        width: 2.5,
        curve: "smooth"
      },
      colors: ["#AB47BC"],
      xaxis: {
        categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
        labels: {
          show: false,}
      },
      tooltip: {
        show:false,
        theme: "dark",
        fixed: {
          enabled: false
        },
        x: {
          show: false
        },

        marker: {
          show: false
        }
      }
  });
  const [Areachart2] = useState<any>({
    series: [{
        name: "Messages",
        data: [8,5,6,3,4,6,7,3,8,6,4,7]
      }],

      chart: {
        type: 'bar',
        width: 70,
        height:70,
        toolbar: {
          show: false
        },
        zoom: {
          enabled: false
        },
        dropShadow: {
          enabled: false,
          top: 3,
          left: 14,
          blur: 4,
          opacity: .12,
          color: "#fff"
        },
        sparkline: {
          enabled: !0
        }
      },
      markers: {
        size: 0,
        colors: ["#F26522"],
        strokeColors: "#fff",
        strokeWidth: 2,
        hover: {
          size: 7
        }
      },
      plotOptions: {
        bar: {
          horizontal: !1,
          columnWidth: "35%",
          endingShape: "rounded"
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        show: !0,
        width: 2.5,
        curve: "smooth"
      },
      colors: ["#02C95A"],
      xaxis: {
        categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
        labels: {
          show: false,}
      },
      tooltip: {
        show:false,
        theme: "dark",
        fixed: {
          enabled: false
        },
        x: {
          show: false
        },

        marker: {
          show: false
        }
      }
  });
  const [Areachart3] = useState<any>({
    series: [{
        name: "Messages",
        data: [8,5,6,3,4,6,7,3,8,6,4,7]
      }],

      chart: {
        type: 'bar',
        width: 70,
        height:70,
        toolbar: {
          show: false
        },
        zoom: {
          enabled: false
        },
        dropShadow: {
          enabled: false,
          top: 3,
          left: 14,
          blur: 4,
          opacity: .12,
          color: "#fff"
        },
        sparkline: {
          enabled: !0
        }
      },
      markers: {
        size: 0,
        colors: ["#F26522"],
        strokeColors: "#fff",
        strokeWidth: 2,
        hover: {
          size: 7
        }
      },
      plotOptions: {
        bar: {
          horizontal: !1,
          columnWidth: "35%",
          endingShape: "rounded"
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        show: !0,
        width: 2.5,
        curve: "smooth"
      },
      colors: ["#0DCAF0"],
      xaxis: {
        categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
        labels: {
          show: false,}
      },
      tooltip: {
        show:false,
        theme: "dark",
        fixed: {
          enabled: false
        },
        x: {
          show: false
        },

        marker: {
          show: false
        }
      }
  });

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Tickets</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Employee</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Tickets
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
              <div className="me-2 mb-2">
                <div className="d-flex align-items-center border bg-white rounded p-1 me-2 icon-list">
                  <Link
                    to={routes.tickets}
                    className="btn btn-icon btn-sm active bg-primary text-white me-1"
                  >
                    <i className="ti ti-list-tree" />
                  </Link>
                  <Link
                    to={routes.ticketGrid}
                    className="btn btn-icon btn-sm"
                  >
                    <i className="ti ti-layout-grid" />
                  </Link>
                </div>
              </div>
              <div className="me-2 mb-2">
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-file-export me-1" />
                    Export
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link
                        to="#"
                        className="dropdown-item rounded-1"
                      >
                        <i className="ti ti-file-type-pdf me-1" />
                        Export as PDF
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className="dropdown-item rounded-1"
                      >
                        <i className="ti ti-file-type-xls me-1" />
                        Export as Excel{" "}
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              {user?.role === 'STARTUP' && (
                <div className="mb-2">
                  <Link
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#add_ticket"
                    className="btn btn-primary d-flex align-items-center"
                  >
                    <i className="ti ti-circle-plus me-2" />
                    Add Ticket
                  </Link>
                </div>
              )}
              <div className="head-icons ms-2">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}
          <div className="row">
            <div className="col-xl-4 col-md-6 d-flex">
              <div className="card flex-fill shadow-sm border-0" style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #fff8f0 100%)',
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                border: '1px solid rgba(255, 193, 7, 0.1)'
              }}>
                <div className="card-body p-4">
                  <div className="row align-items-center">
                    <div className="col-6">
                      <div className="d-flex flex-column">
                        <div className="position-relative mb-3">
                          <div className="d-inline-flex align-items-center justify-content-center" 
                               style={{
                                 width: '60px',
                                 height: '60px',
                                 background: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
                                 borderRadius: '20px',
                                 boxShadow: '0 8px 25px rgba(255, 193, 7, 0.3)',
                                 position: 'relative'
                               }}>
                            <i className="ti ti-ticket fs-24 text-white" />
                            <div className="position-absolute top-0 start-100 translate-middle" 
                                 style={{
                                   width: '12px',
                                   height: '12px',
                                   background: '#ffc107',
                                   borderRadius: '50%',
                                   border: '2px solid white',
                                   boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                 }}></div>
                          </div>
                        </div>
                        <div>
                          <p className="fw-semibold fs-13 mb-1 text-muted" style={{ letterSpacing: '0.5px' }}>
                            New Tickets
                          </p>
                          <h3 className="fw-bold mb-0 text-warning" style={{ 
                            fontSize: '2rem',
                            textShadow: '0 2px 4px rgba(255, 193, 7, 0.1)'
                          }}>
                            {statistics.totalTickets}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="d-flex flex-column align-items-end h-100 justify-content-between">
                        <div className="mb-3">
                          <span className="badge d-inline-flex align-items-center px-3 py-2" 
                                style={{
                                  background: 'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)',
                                  color: 'white',
                                  borderRadius: '20px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  boxShadow: '0 4px 15px rgba(23, 162, 184, 0.3)',
                                  border: 'none'
                                }}>
                            <i className={`ti ${getTrendIcon(statistics.growthPercentages.totalTickets)} me-1 fs-12`} />
                            {formatPercentage(statistics.growthPercentages.totalTickets)}
                          </span>
                        </div>
                        <div className="w-100" style={{ height: '70px' }}>
                          <ReactApexChart
                            options={Areachart}
                            series={Areachart.series}
                            type="bar"
                            height={70}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-4 col-md-6 d-flex">
              <div className="card flex-fill shadow-sm border-0" style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f0ff 100%)',
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                border: '1px solid rgba(111, 66, 193, 0.1)'
              }}>
                <div className="card-body p-4">
                  <div className="row align-items-center">
                    <div className="col-6">
                      <div className="d-flex flex-column">
                        <div className="position-relative mb-3">
                          <div className="d-inline-flex align-items-center justify-content-center" 
                               style={{
                                 width: '60px',
                                 height: '60px',
                                 background: 'linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)',
                                 borderRadius: '20px',
                                 boxShadow: '0 8px 25px rgba(111, 66, 193, 0.3)',
                                 position: 'relative'
                               }}>
                            <i className="ti ti-folder-open fs-24 text-white" />
                            <div className="position-absolute top-0 start-100 translate-middle" 
                                 style={{
                                   width: '12px',
                                   height: '12px',
                                   background: '#6f42c1',
                                   borderRadius: '50%',
                                   border: '2px solid white',
                                   boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                 }}></div>
                          </div>
                        </div>
                        <div>
                          <p className="fw-semibold fs-13 mb-1 text-muted" style={{ letterSpacing: '0.5px' }}>
                            Open Tickets
                          </p>
                          <h3 className="fw-bold mb-0 text-purple" style={{ 
                            fontSize: '2rem',
                            textShadow: '0 2px 4px rgba(111, 66, 193, 0.1)'
                          }}>
                            {statistics.openTickets}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="d-flex flex-column align-items-end h-100 justify-content-between">
                        <div className="mb-3">
                          <span className="badge d-inline-flex align-items-center px-3 py-2" 
                                style={{
                                  background: 'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)',
                                  color: 'white',
                                  borderRadius: '20px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  boxShadow: '0 4px 15px rgba(23, 162, 184, 0.3)',
                                  border: 'none'
                                }}>
                            <i className={`ti ${getTrendIcon(statistics.growthPercentages.openTickets)} me-1 fs-12`} />
                            {formatPercentage(statistics.growthPercentages.openTickets)}
                          </span>
                        </div>
                        <div className="w-100" style={{ height: '70px' }}>
                          <ReactApexChart
                            options={Areachart1}
                            series={Areachart1.series}
                            type="bar"
                            height={70}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-4 col-md-6 d-flex">
              <div className="card flex-fill shadow-sm border-0" style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fffe 100%)',
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                border: '1px solid rgba(25, 135, 84, 0.1)'
              }}>
                <div className="card-body p-4">
                  <div className="row align-items-center">
                    <div className="col-6">
                      <div className="d-flex flex-column">
                        <div className="position-relative mb-3">
                          <div className="d-inline-flex align-items-center justify-content-center" 
                               style={{
                                 width: '60px',
                                 height: '60px',
                                 background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                 borderRadius: '20px',
                                 boxShadow: '0 8px 25px rgba(40, 167, 69, 0.3)',
                                 position: 'relative'
                               }}>
                            <i className="ti ti-checks fs-24 text-white" />
                            <div className="position-absolute top-0 start-100 translate-middle" 
                                 style={{
                                   width: '12px',
                                   height: '12px',
                                   background: '#28a745',
                                   borderRadius: '50%',
                                   border: '2px solid white',
                                   boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                 }}></div>
                          </div>
                        </div>
                        <div>
                          <p className="fw-semibold fs-13 mb-1 text-muted" style={{ letterSpacing: '0.5px' }}>
                            Solved Tickets
                          </p>
                          <h3 className="fw-bold mb-0 text-success" style={{ 
                            fontSize: '2rem',
                            textShadow: '0 2px 4px rgba(40, 167, 69, 0.1)'
                          }}>
                            {statistics.resolvedTickets}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="d-flex flex-column align-items-end h-100 justify-content-between">
                        <div className="mb-3">
                          <span className="badge d-inline-flex align-items-center px-3 py-2" 
                                style={{
                                  background: 'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)',
                                  color: 'white',
                                  borderRadius: '20px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  boxShadow: '0 4px 15px rgba(23, 162, 184, 0.3)',
                                  border: 'none'
                                }}>
                            <i className={`ti ${getTrendIcon(statistics.growthPercentages.resolvedTickets)} me-1 fs-12`} />
                            {formatPercentage(statistics.growthPercentages.resolvedTickets)}
                          </span>
                        </div>
                        <div className="w-100" style={{ height: '70px' }}>
                          <ReactApexChart
                            options={Areachart2}
                            series={Areachart2.series}
                            type="bar"
                            height={70}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-9 col-md-8">
              {/* Filtres */}
              <div className="card mb-4">
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                    <h5>Ticket List</h5>
                    <TicketFilters onFiltersChange={handleFiltersChange} />
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Chargement des tickets...</p>
                </div>
              ) : error ? (
                <div className="alert alert-danger" role="alert">
                  <i className="ti ti-alert-circle me-2"></i>
                  {error}
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-ticket-off display-1 text-muted"></i>
                  <h4 className="mt-3">Aucun ticket trouvé</h4>
                  <p className="text-muted">Il n'y a pas encore de tickets dans le système.</p>
                </div>
              ) : (
                tickets.map((ticket, index) => (
                  <div key={ticket._id} className="card mb-3">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                      <h5 className="text-info fw-medium">{getCategoryLabel(ticket.category)}</h5>
                      <div className="d-flex align-items-center">
                        <span className={`badge badge-${getPriorityColor(ticket.priority)} d-inline-flex align-items-center`}>
                          <i className="ti ti-circle-filled fs-5 me-1" />
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                    <div className="card-body">
                      <div>
                        <span className="badge badge-info rounded-pill mb-2">
                          Tic - {String(index + 1).padStart(3, '0')}
                        </span>
                        <div className="d-flex align-items-center mb-2">
                          <h5 className="fw-semibold me-2">
                            {ticket.status === 'RESOLVED' ? (
                              <span className="text-muted" title="Resolved tickets are view-only">{ticket.title}</span>
                            ) : (
                              <Link to={`${routes.ticketDetails}/${ticket._id}`}>{ticket.title}</Link>
                            )}
                          </h5>
                          <span className={`badge bg-outline-${getStatusColor(ticket.status)} d-flex align-items-center ms-1`}>
                            <i className="ti ti-circle-filled fs-5 me-1" />
                            {getStatusLabel(ticket.status)}
                          </span>
                        </div>
                        <div className="d-flex align-items-center flex-wrap row-gap-2">
                          <p className="d-flex align-items-center mb-0 me-2">
                            <i className="ti ti-calendar-bolt me-1" />
                            Updated {formatTimeAgo(ticket.updatedAt)}
                          </p>
                          <p className="d-flex align-items-center mb-0">
                            <i className="ti ti-message-share me-1" />
                            {ticket.comments ? ticket.comments.length : 0} Comments
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {tickets.length > 0 && (
                <div className="text-center mb-4">
                  <button 
                    className="btn btn-primary"
                    onClick={loadTickets}
                    disabled={loading}
                  >
                    <i className="ti ti-loader-3 me-1" />
                    {loading ? 'Chargement...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
            <div className="col-xl-3 col-md-4">
              <div className="card">
                <div className="card-header">
                  <h4>Ticket Categories</h4>
                </div>
                <div className="card-body p-0">
                  <div className="d-flex flex-column">
                    {(() => {
                      const categoryCounts = tickets.reduce((acc: any[], ticket) => {
                        const category = ticket.category;
                        const existing = acc.find(item => item.category === category);
                        if (existing) {
                          existing.count++;
                        } else {
                          acc.push({ category, count: 1 });
                        }
                        return acc;
                      }, []);
                      
                      return categoryCounts.map((item, index) => (
                        <div key={item.category} className={`d-flex align-items-center justify-content-between ${index < categoryCounts.length - 1 ? 'border-bottom' : ''} p-3`}>
                          <Link to="#">{getCategoryLabel(item.category)}</Link>
                          <div className="d-flex align-items-center">
                            <span className="badge badge-xs bg-dark rounded-circle">
                              {item.count}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <h4>Support Agents</h4>
                </div>
                <div className="card-body p-0">
                  <div className="d-flex flex-column">
                    {(() => {
                      const agentCounts = tickets.reduce((acc: any[], ticket) => {
                        if (ticket.assignedTo) {
                          const agentId = ticket.assignedTo._id;
                          const existing = acc.find(item => item.agentId === agentId);
                          if (existing) {
                            existing.count++;
                          } else {
                            acc.push({ 
                              agentId, 
                              name: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`,
                              count: 1 
                            });
                          }
                        }
                        return acc;
                      }, []);
                      
                      return agentCounts.length > 0 ? agentCounts.map((item, index) => (
                        <div key={item.agentId} className={`d-flex align-items-center justify-content-between ${index < agentCounts.length - 1 ? 'border-bottom' : ''} p-3`}>
                          <span className="d-flex align-items-center">
                            <ImageWithBasePath
                              src="assets/img/profiles/avatar-01.jpg"
                              className="avatar avatar-xs rounded-circle me-2"
                              alt="img"
                            />
                            {item.name}
                          </span>
                          <div className="d-flex align-items-center">
                            <span className="badge badge-xs bg-dark rounded-circle">
                              {item.count}
                            </span>
                          </div>
                        </div>
                      )) : (
                        <div className="p-3 text-center text-muted">
                          Aucun agent assigné
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3">
          <p className="mb-0">2014 - 2025 © SmartHR.</p>
          <p>
            Designed &amp; Developed By{" "}
            <Link to="#" className="text-primary">
              Dreams
            </Link>
          </p>
        </div>
      </div>
      {/* /Page Wrapper */}

      <TicketListModal />
    </>
  );
};

export default Tickets;
