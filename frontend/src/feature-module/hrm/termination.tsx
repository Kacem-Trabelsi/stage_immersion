import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Table from "../../core/common/dataTable/index";
import { all_routes } from '../router/all_routes';
import ImageWithBasePath from '../../core/common/imageWithBasePath';
import CollapseHeader from '../../core/common/collapse-header/collapse-header';
import { useAuth } from '../../contexts/AuthContext';
import userManagementService from '../../services/userManagementService';

// Interfaces TypeScript
interface User {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username?: string;
  role: 'S2T' | 'STARTUP' | 'EXPERT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  lastLogin?: string;
  blocked?: boolean;
  avatar?: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
}

interface UserStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byRole?: {
    S2T?: number;
    STARTUP?: number;
    EXPERT?: number;
  };
}

type FilterType = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Chargement initial des données avec vérification d'authentification
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      const token = localStorage.getItem('token');
      
      // Petit délai pour permettre au contexte Auth de se synchroniser
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!user && !token) {
        navigate('/login', { replace: true });
        return;
      }
      
      setAuthChecked(true);
      
      // Charger les données seulement si authentifié
      if (user || token) {
        await fetchUsers();
        await fetchStats();
      }
    };
    
    checkAuthAndLoadData();
  }, [user, navigate]);

  const fetchUsers = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await userManagementService.getAllUsers() as ApiResponse<User[]>;
      if (response.success) {
        setUsers(response.data);
        setError(''); // Clear any previous errors
      } else {
        setError(response.message || 'Erreur lors du chargement des utilisateurs');
      }
    } catch (err: any) {
      // Ne pas afficher d'erreur si l'utilisateur a été redirigé vers login
      if (!err.message?.includes('invalide') && !err.message?.includes('expiré')) {
        setError('Erreur de connexion au serveur');
      }
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (): Promise<void> => {
    try {
      const response = await userManagementService.getUserStats() as ApiResponse<UserStats>;
      if (response.success) {
        setStats(response.data);
      }
    } catch (err: any) {
      // Ne pas loguer l'erreur si c'est un problème de token (déjà géré par le service)
      if (!err.message?.includes('invalide') && !err.message?.includes('expiré')) {
        console.error('Erreur stats:', err);
      }
    }
  };

  const handleApproveUser = async (userId: string): Promise<void> => {
    try {
      const response = await userManagementService.approveUser(userId) as ApiResponse<User>;
      if (response.success) {
        setSuccess('Utilisateur approuvé avec succès!');
        await fetchUsers();
        await fetchStats();
        // Notification optionnelle
        await userManagementService.notifyUser(userId, 'APPROVED');
      } else {
        setError(response.message || 'Erreur lors de l\'approbation');
      }
    } catch (err: any) {
      setError('Erreur lors de l\'approbation de l\'utilisateur');
      console.error('Erreur:', err);
    }
  };

  const handleDeleteUser = async (userId: string, reason: string = ''): Promise<void> => {
    try {
      const response = await userManagementService.deleteUser(userId, reason) as ApiResponse<any>;
      if (response.success) {
        setSuccess('Utilisateur supprimé avec succès!');
        await fetchUsers();
        await fetchStats();
        // Notification optionnelle
        await userManagementService.notifyUser(userId, 'REJECTED', reason);
      } else {
        setError(response.message || 'Erreur lors de la suppression');
      }
    } catch (err: any) {
      setError('Erreur lors de la suppression de l\'utilisateur');
      console.error('Erreur:', err);
    }
  };

  const handleToggleBlock = async (userId: string, blocked: boolean): Promise<void> => {
    try {
      const response = await userManagementService.toggleUserBlock(userId, blocked) as ApiResponse<User>;
      if (response.success) {
        setSuccess(`Utilisateur ${blocked ? 'bloqué' : 'débloqué'} avec succès!`);
        await fetchUsers();
      } else {
        setError(response.message || 'Erreur lors du blocage/déblocage');
      }
    } catch (err: any) {
      setError('Erreur lors du blocage/déblocage de l\'utilisateur');
      console.error('Erreur:', err);
    }
  };



  const getStatusBadge = (status: User['status']): JSX.Element => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge badge-success">Approuvé</span>;
      case 'PENDING':
        return <span className="badge badge-warning">En attente</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">Rejeté</span>;
      default:
        return <span className="badge badge-secondary">Inconnu</span>;
    }
  };

  const getRoleBadge = (role: User['role']): JSX.Element => {
    switch (role) {
      case 'S2T':
        return <span className="badge badge-primary">S2T</span>;
      case 'STARTUP':
        return <span className="badge badge-info">Startup</span>;
      case 'EXPERT':
        return <span className="badge badge-secondary">Expert</span>;
      default:
        return <span className="badge badge-light">Autre</span>;
    }
  };

  const filteredUsers: User[] = users.filter((user: User) => {
    const matchesFilter = filter === 'ALL' || user.status === filter;
    const matchesSearch = searchTerm === '' || 
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const columns = [
    {
      title: "Utilisateur",
      dataIndex: "user",
      render: (text: string, record: User) => (
        <div className="d-flex align-items-center">
          <div className="avatar avatar-md me-2">
            {record.avatar ? (
              <ImageWithBasePath
                src={record.avatar.startsWith('http') ? record.avatar : `assets/img/profiles/${record.avatar}`}
                className="rounded-circle"
                alt="user"
              />
            ) : (
              <div className="avatar-initial bg-primary rounded-circle">
                <i className="ti ti-user"></i>
              </div>
            )}
          </div>
          <div>
            <h6 className="fw-medium mb-0">
              {record.firstName && record.lastName 
                ? `${record.firstName} ${record.lastName}`
                : record.username || 'Nom non défini'
              }
            </h6>
            <small className="text-muted">{record.email}</small>
          </div>
        </div>
      ),
      sorter: (a: User, b: User) => (a.firstName || a.username || '').localeCompare(b.firstName || b.username || ''),
    },
    {
      title: "Rôle",
      dataIndex: "role",
      render: (role: User['role']) => getRoleBadge(role),
      sorter: (a: User, b: User) => a.role.localeCompare(b.role),
    },
    {
      title: "Statut",
      dataIndex: "status",
      render: (status: User['status']) => getStatusBadge(status),
      sorter: (a: User, b: User) => a.status.localeCompare(b.status),
    },
    {
      title: "Date de création",
      dataIndex: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString('fr-FR'),
      sorter: (a: User, b: User) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: "Dernière connexion",
      dataIndex: "lastLogin",
      render: (date: string) => date ? new Date(date).toLocaleDateString('fr-FR') : 'Jamais',
      sorter: (a: User, b: User) => {
        if (!a.lastLogin && !b.lastLogin) return 0;
        if (!a.lastLogin) return -1;
        if (!b.lastLogin) return 1;
        return new Date(a.lastLogin).getTime() - new Date(b.lastLogin).getTime();
      },
    },
    {
      title: "Actions",
      dataIndex: "actions",
      render: (text: string, record: User) => (
        <div className="action-icon d-inline-flex">
          {record.status === 'PENDING' && (
            <>
              <button
                className="btn btn-sm btn-success me-2"
                onClick={() => handleApproveUser(record._id)}
                title="Approuver"
              >
                <i className="ti ti-check" />
              </button>
              <button
                className="btn btn-sm btn-danger me-2"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedUser(record);
                  // Utiliser setTimeout pour s'assurer que selectedUser est mis à jour
                  setTimeout(() => {
                    const modalElement = document.querySelector('#reject_modal') as HTMLElement;
                    if (modalElement && (window as any).bootstrap) {
                      const modal = new (window as any).bootstrap.Modal(modalElement);
                      modal.show();
                    } else {
                      // Fallback si Bootstrap n'est pas disponible
                      modalElement?.setAttribute('class', modalElement.className + ' show');
                      modalElement?.style.setProperty('display', 'block');
                    }
                  }, 50);
                }}
                title="Rejeter"
              >
                <i className="ti ti-x" />
              </button>
            </>
          )}
          {record.status === 'APPROVED' && record.role !== 'S2T' && (
            <button
              className={`btn btn-sm me-2 ${record.blocked ? 'btn-success' : 'btn-warning'}`}
              onClick={() => handleToggleBlock(record._id, !record.blocked)}
              title={record.blocked ? 'Débloquer' : 'Bloquer'}
            >
              <i className={`ti ti-${record.blocked ? 'lock-open' : 'lock'}`} />
            </button>
          )}
          {record.role !== 'S2T' && (
            <button
              className="btn btn-sm btn-danger"
              onClick={(e) => {
                e.preventDefault();
                setSelectedUser(record);
                // Utiliser setTimeout pour s'assurer que selectedUser est mis à jour
                setTimeout(() => {
                  const modalElement = document.querySelector('#delete_modal') as HTMLElement;
                  if (modalElement && (window as any).bootstrap) {
                    const modal = new (window as any).bootstrap.Modal(modalElement);
                    modal.show();
                  } else {
                    // Fallback si Bootstrap n'est pas disponible
                    modalElement?.setAttribute('class', modalElement.className + ' show');
                    modalElement?.style.setProperty('display', 'block');
                  }
                }, 50);
              }}
              title="Supprimer définitivement"
            >
              <i className="ti ti-trash" />
            </button>
          )}
        </div>
      ),
    },
  ]
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Gestion des Utilisateurs</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Administration</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Gestion des Utilisateurs
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <div className="row g-2 mb-2">
                <div className="col-auto">
                  <div className="card border-0 bg-light">
                    <div className="card-body p-2 text-center">
                      <h6 className="mb-0">{stats.total}</h6>
                      <small className="text-muted">Total</small>
                    </div>
                  </div>
                </div>
                <div className="col-auto">
                  <div className="card border-0 bg-warning-light">
                    <div className="card-body p-2 text-center">
                      <h6 className="mb-0">{stats.pending}</h6>
                      <small className="text-muted">En attente</small>
                    </div>
                  </div>
                </div>
                <div className="col-auto">
                  <div className="card border-0 bg-success-light">
                    <div className="card-body p-2 text-center">
                      <h6 className="mb-0">{stats.approved}</h6>
                      <small className="text-muted">Approuvés</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className="head-icons ms-2">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}
          {/* Termination List */}
          <div className="row">
            <div className="col-sm-12">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="d-flex align-items-center">Liste des Utilisateurs</h5>
                  <div className="d-flex align-items-center flex-wrap row-gap-3">
                    {/* Alertes de succès et d'erreur */}
                    {success && (
                      <div className="alert alert-success alert-dismissible fade show me-2" role="alert">
                        <i className="ti ti-check-circle me-2"></i>
                        {success}
                        <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
                      </div>
                    )}
                    {error && (
                      <div className="alert alert-danger alert-dismissible fade show me-2" role="alert">
                        <i className="ti ti-alert-circle me-2"></i>
                        {error}
                        <button type="button" className="btn-close" onClick={() => setError('')}></button>
                      </div>
                    )}
                    
                    {/* Barre de recherche */}
                    <div className="input-icon position-relative me-2">
                      <span className="input-icon-addon">
                        <i className="ti ti-search" />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Rechercher un utilisateur..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    {/* Filtre par statut */}
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="dropdown-toggle btn btn-white d-inline-flex align-items-center fs-12"
                        data-bs-toggle="dropdown"
                      >
                        <p className="fs-12 d-inline-flex me-1">Filtrer : </p>
                        {filter === 'ALL' ? 'Tous' : 
                         filter === 'PENDING' ? 'En attente' :
                         filter === 'APPROVED' ? 'Approuvés' : 'Rejetés'}
                      </Link>
                      <ul className="dropdown-menu dropdown-menu-end p-3">
                        <li>
                          <button
                            className="dropdown-item rounded-1"
                            onClick={() => setFilter('ALL')}
                          >
                            Tous
                          </button>
                        </li>
                        <li>
                          <button
                            className="dropdown-item rounded-1"
                            onClick={() => setFilter('PENDING')}
                          >
                            En attente
                          </button>
                        </li>
                        <li>
                          <button
                            className="dropdown-item rounded-1"
                            onClick={() => setFilter('APPROVED')}
                          >
                            Approuvés
                          </button>
                        </li>
                        <li>
                          <button
                            className="dropdown-item rounded-1"
                            onClick={() => setFilter('REJECTED')}
                          >
                            Rejetés
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  {!authChecked || loading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Chargement...</span>
                      </div>
                      <p className="mt-2">
                        {!authChecked ? 'Vérification de l\'authentification...' : 'Chargement des utilisateurs...'}
                      </p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="ti ti-users fs-1 text-muted mb-3"></i>
                      <h5 className="text-muted">Aucun utilisateur trouvé</h5>
                      <p className="text-muted">
                        {searchTerm ? 'Aucun résultat pour votre recherche.' : 'Aucun utilisateur correspondant au filtre sélectionné.'}
                      </p>
                    </div>
                  ) : (
                    <Table dataSource={filteredUsers} columns={columns} Selection={false} />
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* /User Management List  */}
        </div>
        {/* Footer */}
        <div className="footer d-sm-flex align-items-center justify-content-between bg-white border-top p-3">
          <p className="mb-0">2014 - 2025 © SynergyPark.</p>
          <p>
            Système de gestion des utilisateurs S2T
          </p>
        </div>
        {/* /Footer */}
      </div>
      {/* /Page Wrapper */}
      
      {/* Modal de rejet avec raison */}
      <div className="modal fade" id="reject_modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Rejeter l'utilisateur</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="text-center mb-3">
                <span className="avatar avatar-xl bg-transparent-warning text-warning mb-3">
                  <i className="ti ti-user-x fs-36" />
                </span>
                <h5 className="mb-2">Rejeter la demande</h5>
                <p className="text-muted">
                  Êtes-vous sûr de vouloir rejeter cet utilisateur ? Cette action est irréversible.
                </p>
              </div>
              {selectedUser && (
                <div className="bg-light rounded p-3 mb-3">
                  <div className="d-flex align-items-center">
                    <div className="avatar avatar-md me-3">
                      {selectedUser.avatar ? (
                        <ImageWithBasePath
                          src={selectedUser.avatar.startsWith('http') ? selectedUser.avatar : `assets/img/profiles/${selectedUser.avatar}`}
                          className="rounded-circle"
                          alt="user"
                        />
                      ) : (
                        <div className="avatar-initial bg-primary rounded-circle">
                          <i className="ti ti-user"></i>
                        </div>
                      )}
                    </div>
                    <div>
                      <h6 className="mb-0">
                        {selectedUser.firstName && selectedUser.lastName 
                          ? `${selectedUser.firstName} ${selectedUser.lastName}`
                          : selectedUser.username || 'Nom non défini'
                        }
                      </h6>
                      <small className="text-muted">{selectedUser.email}</small>
                    </div>
                  </div>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Raison du rejet (optionnel)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Expliquez la raison du rejet..."
                  id="rejectionReason"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light me-3"
                data-bs-dismiss="modal"
              >
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-danger"
                data-bs-dismiss="modal"
                onClick={() => {
                  if (selectedUser) {
                    const reasonElement = document.getElementById('rejectionReason') as HTMLTextAreaElement;
                    const reason = reasonElement?.value || '';
                    handleDeleteUser(selectedUser._id, reason);
                  }
                }}
              >
                Rejeter définitivement
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de suppression définitive */}
      <div className="modal fade" id="delete_modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="avatar avatar-xl bg-transparent-danger text-danger mb-3">
                <i className="ti ti-trash-x fs-36" />
              </span>
              <h4 className="mb-1">Supprimer définitivement</h4>
              <p className="mb-3">
                Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? 
                Cette action ne peut pas être annulée.
              </p>
              {selectedUser && (
                <div className="bg-light rounded p-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center">
                    <div className="avatar avatar-md me-3">
                      {selectedUser.avatar ? (
                        <ImageWithBasePath
                          src={selectedUser.avatar.startsWith('http') ? selectedUser.avatar : `assets/img/profiles/${selectedUser.avatar}`}
                          className="rounded-circle"
                          alt="user"
                        />
                      ) : (
                        <div className="avatar-initial bg-primary rounded-circle">
                          <i className="ti ti-user"></i>
                        </div>
                      )}
                    </div>
                    <div>
                      <h6 className="mb-0">
                        {selectedUser.firstName && selectedUser.lastName 
                          ? `${selectedUser.firstName} ${selectedUser.lastName}`
                          : selectedUser.username || 'Nom non défini'
                        }
                      </h6>
                      <small className="text-muted">{selectedUser.email}</small>
                    </div>
                  </div>
                </div>
              )}
              <div className="d-flex justify-content-center">
                <button
                  type="button"
                  className="btn btn-light me-3"
                  data-bs-dismiss="modal"
                >
                  Annuler
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  data-bs-dismiss="modal"
                  onClick={() => {
                    if (selectedUser) {
                      handleDeleteUser(selectedUser._id);
                    }
                  }}
                >
                  Oui, Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>



    </>
  )
}

export default UserManagement
