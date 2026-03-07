import React, { useState, useEffect } from 'react'
import { all_routes } from '../../router/all_routes'
import { Link } from 'react-router-dom'
import CollapseHeader from '../../../core/common/collapse-header/collapse-header'
import CrmsModal from '../../../core/modals/crms_modal'
import UserService from '../../../services/userService'
import ChatModule from '../chat/ChatModule'
import { useAuth } from '../../../contexts/AuthContext'
import type { User } from '../../../types/user'

const ContactGrid = () => {
  const routes = all_routes
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false)
  const [selectedChatUser, setSelectedChatUser] = useState<User | null>(null)
  const { user: currentUser } = useAuth()
  
  // Get token from localStorage
  const token = localStorage.getItem('token')

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        const userData = await UserService.getAllUsers()
        setUsers(userData)
        setError(null)
      } catch (err: unknown) {
        console.error('Error fetching users:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch users')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  // Handle opening chat with a specific user
  const handleChatOpen = (user: User) => {
    setSelectedChatUser(user)
    setIsChatOpen(true)
  }

  // Handle closing chat
  const handleChatClose = () => {
    setIsChatOpen(false)
    setSelectedChatUser(null)
  }

  // Get user avatar or default
  const getUserAvatar = (user: User): string => {
    if (user.avatar) {
      return user.avatar.startsWith('http') ? user.avatar : `http://localhost:5000${user.avatar}`
    }
    if (user.profilePhoto) {
      return user.profilePhoto.startsWith('http') ? user.profilePhoto : `http://localhost:5000${user.profilePhoto}`
    }
    return '/assets/img/users/user-49.jpg' // Default avatar
  }

  // Get user display name
  const getUserDisplayName = (user: User): string => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    return user.username || user.email.split('@')[0]
  }

  // Get user role badge color
  const getRoleBadgeColor = (role: User['role']): string => {
    const colors: Record<User['role'], string> = {
      'STARTUP': 'bg-success-transparent',
      'EXPERT': 'bg-info-transparent',
      'ADMIN': 'bg-danger-transparent', 
      'USER': 'bg-primary-transparent',
      'MANAGER': 'bg-warning-transparent'
    }
    return colors[role] || 'bg-pink-transparent'
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Contacts</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">CRM</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Contacts Grid
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
              <div className="me-2 mb-2">
                <div className="d-flex align-items-center border bg-white rounded p-1 me-2 icon-list">
                  <Link to={routes.contactList} className="btn btn-icon btn-sm me-1">
                    <i className="ti ti-list-tree" />
                  </Link>
                  <Link
                    to={routes.contactGrid}
                    className="btn btn-icon btn-sm active bg-primary text-white"
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
                    Sort By : Last 7 Days
                  </Link>
                  <ul className="dropdown-menu dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Descending
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="me-2 mb-2">
                <Link
                  to="#"
                  data-bs-toggle="modal"
                  data-bs-target="#add_contact"
                  className="btn btn-primary d-flex align-items-center"
                >
                  <i className="ti ti-circle-plus me-2" />
                  Add Contact
                </Link>
              </div>
              <div className="head-icons ms-2">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}

          {/* Contact Grid */}
          <div className="card">
            <div className="card-body p-3">
              <div className="d-flex align-items-center justify-content-between">
                <h5>Contact Grid</h5>
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-sm btn-white d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                  >
                    Sort By : Last 7 Days
                  </Link>
                  <ul className="dropdown-menu dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Descending
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            {loading && (
              <div className="col-12 text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading contacts...</p>
              </div>
            )}
            
            {error && (
              <div className="col-12">
                <div className="alert alert-danger" role="alert">
                  <i className="ti ti-alert-circle me-2"></i>
                  Error loading contacts: {error}
                </div>
              </div>
            )}
            
            {!loading && !error && users.length === 0 && (
              <div className="col-12 text-center">
                <div className="empty-state">
                  <i className="ti ti-users fs-1 text-muted"></i>
                  <h5 className="mt-3">No contacts found</h5>
                  <p className="text-muted">There are no users in the system yet.</p>
                </div>
              </div>
            )}
            
            {!loading && !error && users.map((user) => (
              <div key={user._id} className="col-xl-3 col-lg-4 col-md-6">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="form-check form-check-md">
                        <input className="form-check-input" type="checkbox" />
                      </div>
                      <div>
                        <Link
                          to={routes.contactDetails}
                          className="avatar avatar-xl avatar-rounded online border p-1 border-primary rounded-circle"
                        >
                          <img
                            src={getUserAvatar(user)}
                            className="img-fluid h-auto w-auto"
                            alt="User Avatar"
                          />
                        </Link>
                      </div>
                      <div className="dropdown">
                        <button
                          className="btn btn-icon btn-sm rounded-circle"
                          type="button"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <i className="ti ti-dots-vertical" />
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end p-3">
                          <li>
                            <Link
                              to="#"
                              className="dropdown-item rounded-1"
                              data-bs-toggle="modal"
                              data-bs-target="#edit_contact"
                            >
                              <i className="ti ti-edit me-1" />
                              Edit
                            </Link>
                          </li>
                          <li>
                            <button
                              className="dropdown-item rounded-1"
                              onClick={() => handleChatOpen(user)}
                            >
                              <i className="ti ti-message-2 me-1" />
                              Chat
                            </button>
                          </li>
                          <li>
                            <Link
                              to="#"
                              className="dropdown-item rounded-1"
                              data-bs-toggle="modal"
                              data-bs-target="#delete_modal"
                            >
                              <i className="ti ti-trash me-1" />
                              Delete
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="text-center mb-3">
                      <h6 className="mb-1">
                        <Link to={routes.contactDetails}>
                          {getUserDisplayName(user)}
                        </Link>
                      </h6>
                      <span className={`badge ${getRoleBadgeColor(user.role)} fs-10 fw-medium`}>
                        {user.position || user.role}
                      </span>
                    </div>
                    <div className="d-flex flex-column">
                      <p className="text-dark d-inline-flex align-items-center mb-2">
                        <i className="ti ti-mail-forward text-gray-5 me-2" />
                        {user.email}
                      </p>
                      {user.phone && (
                        <p className="text-dark d-inline-flex align-items-center mb-2">
                          <i className="ti ti-phone text-gray-5 me-2" />
                          {user.phone}
                        </p>
                      )}
                      {user.country && (
                        <p className="text-dark d-inline-flex align-items-center">
                          <i className="ti ti-map-pin text-gray-5 me-2" />
                          {user.country}
                        </p>
                      )}
                    </div>
                    <div className="d-flex align-items-center justify-content-between border-top pt-3 mt-3">
                      <div className="icons-social d-flex align-items-center">
                        <Link to="#" className="avatar avatar-rounded avatar-sm me-1">
                          <i className="ti ti-mail" />
                        </Link>
                        <Link to="#" className="avatar avatar-rounded avatar-sm me-1">
                          <i className="ti ti-phone-call" />
                        </Link>
                        <button 
                          className="avatar avatar-rounded avatar-sm me-1 btn p-0"
                          onClick={() => handleChatOpen(user)}
                          title="Start Chat"
                        >
                          <i className="ti ti-message-2" />
                        </button>
                        <Link to="#" className="avatar avatar-rounded avatar-sm me-1">
                          <i className="ti ti-brand-skype" />
                        </Link>
                        <Link to="#" className="avatar avatar-rounded avatar-sm">
                          <i className="ti ti-brand-facebook" />
                        </Link>
                      </div>
                      <span className="d-inline-flex align-items-center">
                        <i className="ti ti-star-filled text-warning me-1" />
                        {Math.floor(Math.random() * 2 + 3)}.{Math.floor(Math.random() * 9)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Module */}
          {isChatOpen && (
            <ChatModule
              isOpen={isChatOpen}
              onClose={handleChatClose}
              selectedUser={selectedChatUser}
              currentUser={currentUser}
              token={token}
            />
          )}
          {/* /Contact Grid */}
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
      <CrmsModal/>
    </>
  )
}

export default ContactGrid
