import React, { useState, useEffect } from 'react';
import ticketService from '../../services/ticketService';

interface FilterOptions {
  priority: string;
  status: string;
  sortBy: string;
  sortOrder: string;
  search: string;
}

interface TicketFiltersProps {
  onFiltersChange: (filters: FilterOptions) => void;
  initialFilters?: Partial<FilterOptions>;
}

const TicketFilters: React.FC<TicketFiltersProps> = ({ onFiltersChange, initialFilters = {} }) => {
  const [filters, setFilters] = useState<FilterOptions>({
    priority: initialFilters.priority || '',
    status: initialFilters.status || '',
    sortBy: initialFilters.sortBy || 'createdAt',
    sortOrder: initialFilters.sortOrder || 'desc',
    search: initialFilters.search || ''
  });

  const [enums, setEnums] = useState({
    priorities: [],
    statuses: [],
    categories: []
  });

  const [loading, setLoading] = useState(true);

  // Charger les énumérations
  useEffect(() => {
    loadEnums();
  }, []);

  const loadEnums = async () => {
    try {
      const response = await ticketService.getEnums();
      if (response.success) {
        setEnums({
          priorities: response.data.priorities || [],
          statuses: response.data.statuses || [],
          categories: response.data.categories || []
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des énumérations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour les filtres et notifier le parent
  const updateFilter = (key: keyof FilterOptions, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Options de tri
  const sortOptions = [
    { value: 'createdAt', label: 'Recently Added', sortOrder: 'desc' },
    { value: 'createdAt', label: 'Ascending', sortOrder: 'asc' },
    { value: 'createdAt', label: 'Descending', sortOrder: 'desc' },
    { value: 'updatedAt', label: 'Last Month', sortOrder: 'desc' },
    { value: 'createdAt', label: 'Last 7 Days', sortOrder: 'desc' }
  ];

  // Obtenir le label de la priorité
  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      'URGENT': 'Urgent',
      'HIGH': 'High',
      'MEDIUM': 'Medium',
      'LOW': 'Low'
    };
    return labels[priority] || priority;
  };

  // Obtenir le label du statut
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'OPEN': 'Open',
      'IN_PROGRESS': 'In Progress',
      'PENDING': 'On Hold',
      'RESOLVED': 'Resolved',
      'CLOSED': 'Closed'
    };
    return labels[status] || status;
  };

  // Obtenir le label du tri
  const getSortLabel = (sortBy: string, sortOrder: string) => {
    const option = sortOptions.find(opt => opt.value === sortBy && opt.sortOrder === sortOrder);
    return option ? option.label : 'Recently Added';
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center flex-wrap row-gap-3">
        <div className="spinner-border spinner-border-sm me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span>Chargement des filtres...</span>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center flex-wrap row-gap-3">
      {/* Filtre de recherche */}
      <div className="me-2">
        <div className="input-group input-group-sm">
          <span className="input-group-text">
            <i className="ti ti-search"></i>
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Rechercher..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            style={{ minWidth: '200px' }}
          />
        </div>
      </div>

      {/* Filtre par priorité */}
      <div className="dropdown me-2">
        <a
          className="dropdown-toggle btn btn-sm btn-white d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
          href="#"
          role="button"
          aria-expanded="false"
        >
          {filters.priority ? getPriorityLabel(filters.priority) : 'Priority'}
        </a>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <a
              className="dropdown-item rounded-1"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                updateFilter('priority', '');
              }}
            >
              Toutes les priorités
            </a>
          </li>
          {enums.priorities.map((priority: string) => (
            <li key={priority}>
              <a
                className="dropdown-item rounded-1"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  updateFilter('priority', priority);
                }}
              >
                {getPriorityLabel(priority)}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Filtre par statut */}
      <div className="dropdown me-2">
        <a
          className="dropdown-toggle btn btn-sm btn-white d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
          href="#"
          role="button"
          aria-expanded="false"
        >
          {filters.status ? getStatusLabel(filters.status) : 'Select Status'}
        </a>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <a
              className="dropdown-item rounded-1"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                updateFilter('status', '');
              }}
            >
              Tous les statuts
            </a>
          </li>
          {enums.statuses.map((status: string) => (
            <li key={status}>
              <a
                className="dropdown-item rounded-1"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  updateFilter('status', status);
                }}
              >
                {getStatusLabel(status)}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Filtre de tri */}
      <div className="dropdown">
        <a
          className="dropdown-toggle btn btn-sm btn-white d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
          href="#"
          role="button"
          aria-expanded="false"
        >
          Sort By : {getSortLabel(filters.sortBy, filters.sortOrder)}
        </a>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          {sortOptions.map((option, index) => (
            <li key={index}>
              <a
                className="dropdown-item rounded-1"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  updateFilter('sortBy', option.value);
                  updateFilter('sortOrder', option.sortOrder);
                }}
              >
                {option.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Bouton pour réinitialiser les filtres */}
      {(filters.priority || filters.status || filters.search) && (
        <button
          className="btn btn-sm btn-outline-secondary ms-2"
          onClick={() => {
            const resetFilters = {
              priority: '',
              status: '',
              sortBy: 'createdAt',
              sortOrder: 'desc',
              search: ''
            };
            setFilters(resetFilters);
            onFiltersChange(resetFilters);
          }}
        >
          <i className="ti ti-refresh me-1"></i>
          Reset
        </button>
      )}
    </div>
  );
};

export default TicketFilters;
