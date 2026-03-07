import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ticketService from '../services/ticketService';
import TicketFilters from '../core/common/TicketFilters';

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
  reportedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface FilterOptions {
  priority: string;
  status: string;
  sortBy: string;
  sortOrder: string;
  search: string;
}

const MyTickets: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
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

  useEffect(() => {
    if (isAuthenticated && user) {
      loadMyTickets();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadMyTickets();
    }
  }, [filters, isAuthenticated, user]);

  const loadMyTickets = async () => {
    try {
      setLoading(true);
      const response = await ticketService.getMyTickets(filters);
      
      if (response.success) {
        setTickets(response.data);
        console.log('Mes tickets chargés:', response.data.length);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      case 'LOW': return 'success';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'primary';
      case 'IN_PROGRESS': return 'warning';
      case 'PENDING': return 'info';
      case 'RESOLVED': return 'success';
      case 'CLOSED': return 'secondary';
      default: return 'light';
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'TECHNICAL': 'Technique',
      'BUSINESS': 'Business',
      'LEGAL': 'Légal',
      'FINANCIAL': 'Financier',
      'MARKETING': 'Marketing',
      'OPERATIONAL': 'Opérationnel',
      'HUMAN_RESOURCES': 'RH',
      'OTHER': 'Autre'
    };
    return labels[category] || category;
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      'LOW': 'Faible',
      'MEDIUM': 'Moyen',
      'HIGH': 'Élevé',
      'URGENT': 'Urgent'
    };
    return labels[priority] || priority;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'OPEN': 'Ouvert',
      'IN_PROGRESS': 'En cours',
      'PENDING': 'En attente',
      'RESOLVED': 'Résolu',
      'CLOSED': 'Fermé'
    };
    return labels[status] || status;
  };

  if (!isAuthenticated) {
    return (
      <div className="alert alert-warning">
        <i className="ti ti-alert-triangle me-2"></i>
        Vous devez être connecté pour voir vos tickets.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Chargement...</span>
        </div>
        <p className="mt-2">Chargement de vos tickets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="ti ti-alert-circle me-2"></i>
        {error}
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="ti ti-ticket me-2"></i>
                Mes Tickets ({tickets.length})
              </h5>
            </div>
            <div className="card-body p-3">
              {/* Filtres */}
              <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3 mb-4">
                <h5>Mes Tickets</h5>
                <TicketFilters onFiltersChange={handleFiltersChange} />
              </div>
              
              {tickets.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-ticket-off display-1 text-muted"></i>
                  <h4 className="mt-3">Aucun ticket trouvé</h4>
                  <p className="text-muted">Vous n'avez pas encore créé de tickets.</p>
                  {user?.role === 'STARTUP' && (
                    <button 
                      className="btn btn-primary"
                      data-bs-toggle="modal" 
                      data-bs-target="#add_ticket"
                    >
                      <i className="ti ti-plus me-2"></i>
                      Créer un ticket
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Titre</th>
                        <th>Catégorie</th>
                        <th>Priorité</th>
                        <th>Statut</th>
                        <th>Entreprise</th>
                        <th>Date de création</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr key={ticket._id}>
                          <td>
                            <div>
                              <strong>{ticket.title}</strong>
                              <br />
                              <small className="text-muted">
                                {ticket.description.length > 100 
                                  ? `${ticket.description.substring(0, 100)}...` 
                                  : ticket.description
                                }
                              </small>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark">
                              {getCategoryLabel(ticket.category)}
                            </span>
                          </td>
                          <td>
                            <span className={`badge bg-${getPriorityColor(ticket.priority)}`}>
                              {getPriorityLabel(ticket.priority)}
                            </span>
                          </td>
                          <td>
                            <span className={`badge bg-${getStatusColor(ticket.status)}`}>
                              {getStatusLabel(ticket.status)}
                            </span>
                          </td>
                          <td>{ticket.companyName}</td>
                          <td>
                            {new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td>
                            {ticket.status === 'RESOLVED' ? (
                              <button className="btn btn-sm btn-outline-secondary" disabled title="Ticket résolu">
                                <i className="ti ti-lock"></i>
                              </button>
                            ) : (
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => console.log('Voir détails du ticket:', ticket._id)}
                              >
                                <i className="ti ti-eye"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTickets;
