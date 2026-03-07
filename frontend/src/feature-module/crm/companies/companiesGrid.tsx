import React from 'react'
import { Link } from 'react-router-dom'
import { all_routes } from '../../router/all_routes'
import CollapseHeader from '../../../core/common/collapse-header/collapse-header'
import CrmsModal from '../../../core/modals/crms_modal'
import companyProfileService from '../../../services/companyProfileService'
import { useAuth } from '../../../contexts/AuthContext'
import { API_BASE_URL } from '../../../services/apiService'

const CompaniesGrid = () => {
  const routes = all_routes
  const { user } = useAuth()
  const [startups, setStartups] = React.useState<any[]>([])
  const [loadingStartups, setLoadingStartups] = React.useState<boolean>(false)
  const [errorStartups, setErrorStartups] = React.useState<string>("")

  React.useEffect(() => {
    const fetchStartups = async () => {
      try {
        setLoadingStartups(true)
        const res = await companyProfileService.getAllCompanyProfiles()
        const profiles = Array.isArray(res?.data) ? res.data : []
        const startupProfiles = profiles.filter((p: any) => !p?.userId?.role || p?.userId?.role === 'STARTUP')
        setStartups(startupProfiles)
      } catch (e: any) {
        setErrorStartups(e?.message || "Failed to load startups")
      } finally {
        setLoadingStartups(false)
      }
    }

    fetchStartups()
  }, [])

  const getLogoUrl = (logo?: string) => {
    if (!logo) return "/assets/img/company/company-12.svg"
    if (logo.startsWith('/data:image/')) return logo.substring(1)
    if (logo.startsWith('data:') || logo.startsWith('http')) return logo
    if (logo.startsWith('assets/')) return `/${logo}`
    if (logo.startsWith('/uploads') || logo.startsWith('uploads/')) {
      const normalized = logo.startsWith('/') ? logo : `/${logo}`
      return `${API_BASE_URL}${normalized}`
    }
    return logo
  }

  return (
    <>
    <div className="page-wrapper">
  <div className="content">
    {/* Breadcrumb */}
    <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
      <div className="my-auto mb-2">
        <h2 className="mb-1">Companies</h2>
        <nav>
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <Link to={routes.adminDashboard}>
                <i className="ti ti-smart-home" />
              </Link>
            </li>
            <li className="breadcrumb-item">CRM</li>
            <li className="breadcrumb-item active" aria-current="page">
              Companies Grid
            </li>
          </ol>
        </nav>
      </div>
      <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
        <div className="me-2 mb-2">
          <div className="d-flex align-items-center border bg-white rounded p-1 me-2 icon-list">
            <Link to={routes.companiesList} className="btn btn-icon btn-sm me-1">
              <i className="ti ti-list-tree" />
            </Link>
            <Link
              to={routes.companiesGrid}
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
        {user?.role !== 'EXPERT' && (
          <div className="mb-2">
            <Link
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#add_company"
              className="btn btn-primary d-flex align-items-center"
            >
              <i className="ti ti-circle-plus me-2" />
              Add Company
            </Link>
          </div>
        )}
        <div className="head-icons ms-2">
        <CollapseHeader/>
        </div>
      </div>
    </div>
    {/* /Breadcrumb */}
    <div className="card">
      <div className="card-body p-3">
        <div className="d-flex align-items-center justify-content-between">
          <h5>Companies Grid</h5>
          <div className="dropdown">
            <Link
              to="#"
              className="dropdown-toggle btn btn-sm btn-white d-inline-flex align-items-center"
              data-bs-toggle="dropdown"
            >
              Sort By : Last 7 Days
            </Link>
            <ul className="dropdown-menu  dropdown-menu-end p-3">
              <li>
                <Link
                  to="#"
                  className="dropdown-item rounded-1"
                >
                  Recently Added
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item rounded-1"
                >
                  Ascending
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item rounded-1"
                >
                  Desending
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item rounded-1"
                >
                  Last Month
                </Link>
              </li>
              <li>
                <Link
                  to="#"
                  className="dropdown-item rounded-1"
                >
                  Last 7 Days
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div className="row">
      {loadingStartups && (
        <div className="col-12">
          <div className="card">
            <div className="card-body text-center">Loading startups...</div>
          </div>
        </div>
      )}
      {!loadingStartups && errorStartups && (
        <div className="col-12">
          <div className="card">
            <div className="card-body text-center text-danger">
              <i className="ti ti-alert-circle me-2"></i>
              Error: {errorStartups}
              <br />
              <small className="text-muted">Check console for more details</small>
            </div>
          </div>
        </div>
      )}
      {!loadingStartups && !errorStartups && startups.length === 0 && (
        <div className="col-12">
          <div className="card">
            <div className="card-body text-center">No startups registered yet</div>
          </div>
        </div>
      )}
      {!loadingStartups && !errorStartups && startups.map((startup) => (
        <div className="col-xl-3 col-lg-4 col-md-6" key={startup._id}>
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="form-check form-check-md">
                  <input className="form-check-input" type="checkbox" />
                </div>
                <div>
                  <Link
                    to={routes.companyDetailDashboard.replace(':companyId', startup._id)}
                    className="avatar avatar-xl avatar-rounded online border rounded-circle"
                  >
                    <img
                      src={getLogoUrl(startup.logo)}
                      className="w-100 h-100 rounded-circle object-fit-cover"
                      alt="img"
                    />
                  </Link>
                </div>

              </div>
              <div className="text-center mb-3">
                <h6 className="mb-1">
                  <Link to={routes.companyDetailDashboard.replace(':companyId', startup._id)}>
                    {startup.companyName || `${startup?.userId?.firstName || ''} ${startup?.userId?.lastName || ''}`.trim() || 'Startup'}
                  </Link>
                </h6>
                <p className="text-muted small mb-2">
                  @{startup?.userId?.username || 'startup'}
                </p>
              </div>
              <div className="d-flex flex-column">
                <p className="text-dark d-inline-flex align-items-center mb-2">
                  <i className="ti ti-mail-forward text-gray-5 me-2" />
                  {startup?.userId?.email || startup.email || 'contact@example.com'}
                </p>
                <p className="text-dark d-inline-flex align-items-center mb-2">
                  <i className="ti ti-building text-gray-5 me-2" />
                  {startup.activityDomain || 'Domain not specified'}
                </p>
                <p className="text-dark d-inline-flex align-items-center mb-2">
                  <i className="ti ti-flag text-gray-5 me-2" />
                  {startup.projectProgress || 'Progress not specified'}
                </p>
                <p className="text-dark d-inline-flex align-items-center mb-2">
                  <i className="ti ti-users text-gray-5 me-2" />
                  {startup.staffRange || 'Team size not specified'}
                </p>
                <p className="text-dark d-inline-flex align-items-center">
                  <i className="ti ti-map-pin text-gray-5 me-2" />
                  {startup.address || 'Location not specified'}
                </p>
              </div>
              <div className="d-flex align-items-center justify-content-between border-top pt-3 mt-3">
                <div className="icons-social d-flex align-items-center">
                  <Link to="#" className="avatar avatar-rounded avatar-sm me-1">
                    <i className="ti ti-mail" />
                  </Link>
                  <Link to="#" className="avatar avatar-rounded avatar-sm me-1">
                    <i className="ti ti-phone-call" />
                  </Link>
                  <Link to="#" className="avatar avatar-rounded avatar-sm me-1">
                    <i className="ti ti-message-2" />
                  </Link>
                  <Link to="#" className="avatar avatar-rounded avatar-sm me-1">
                    <i className="ti ti-brand-skype" />
                  </Link>
                  <Link to="#" className="avatar avatar-rounded avatar-sm">
                    <i className="ti ti-brand-facebook" />
                  </Link>
                </div>
                <span className="d-inline-flex align-items-center">
                  <i className="ti ti-star-filled text-warning me-1" />
                  {startup.rating || '4.2'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="text-center mb-4">
      <Link to="#" className="btn btn-white border">
        <i className="ti ti-loader-3 text-primary me-2" />
        Load More
      </Link>
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
<CrmsModal/>
    </>
  )
}

export default CompaniesGrid