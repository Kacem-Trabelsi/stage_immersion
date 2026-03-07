import React from "react";
import NotesService from "../../services/notesService";
import { Link, Navigate } from "react-router-dom";
import NotesModal from "./notesModal";
import { all_routes } from "../router/all_routes";
import CommonSelect from "../../core/common/commonSelect";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import { useAuth } from "../../contexts/AuthContext";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";

const Notes = () => {
  const routes = all_routes;
  const { user, loading } = useAuth();
  const startupUserId = (user as any)?.id || (user as any)?._id;
  const { companyProfile } = useCompanyProfile(startupUserId);
  const [myNotes, setMyNotes] = React.useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = React.useState<boolean>(false);
  const [errorNotes, setErrorNotes] = React.useState<string>("");
  const [deleteModal, setDeleteModal] = React.useState<boolean>(false);
  const [noteToDelete, setNoteToDelete] = React.useState<string | null>(null);
  const [viewModal, setViewModal] = React.useState<boolean>(false);
  const [noteToView, setNoteToView] = React.useState<any>(null);
  const [editModal, setEditModal] = React.useState<boolean>(false);
  const [noteToEdit, setNoteToEdit] = React.useState<any>(null);
  const [editForm, setEditForm] = React.useState({
    title: '',
    content: '',
    priority: 'Medium'
  });

  React.useEffect(() => {
    const fetchNotes = async () => {
      try {
        setLoadingNotes(true);
        const res = await NotesService.listMyNotes();
        setMyNotes(res?.data || []);
      } catch (e: any) {
        setErrorNotes(e?.message || "Failed to load notes");
      } finally {
        setLoadingNotes(false);
      }
    };
    fetchNotes();
  }, []);

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    
    try {
      await NotesService.delete(noteToDelete);
      setMyNotes(prevNotes => prevNotes.filter(note => note._id !== noteToDelete));
      setDeleteModal(false);
      setNoteToDelete(null);
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      setErrorNotes(error?.message || "Failed to delete note");
    }
  };

  const openDeleteModal = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteModal(true);
  };

  const openViewModal = (note: any) => {
    setNoteToView(note);
    setViewModal(true);
  };

  const openEditModal = (note: any) => {
    setNoteToEdit(note);
    setEditForm({
      title: note.title || '',
      content: note.content || '',
      priority: note.priority || 'Medium'
    });
    setEditModal(true);
  };

  const handleEditNote = async () => {
    if (!noteToEdit) return;
    
    try {
      await (NotesService as any).update(noteToEdit._id, editForm);
      setMyNotes(prevNotes => 
        prevNotes.map(note => 
          note._id === noteToEdit._id 
            ? { ...note, ...editForm }
            : note
        )
      );
      setEditModal(false);
      setNoteToEdit(null);
    } catch (error: any) {
      console.error('Failed to update note:', error);
      setErrorNotes(error?.message || "Failed to update note");
    }
  };

  const optionsChoose = [
    { value: "Bulk Actions", label: "Bulk Actions" },
    { value: "Delete Marked", label: "Delete Marked" },
    { value: "Unmark All", label: "Unmark All" },
    { value: "Mark All", label: "Mark All" },
  ];
  const recentChoose = [
    { value: "Recent", label: "Recent" },
    { value: "Last Modified", label: "Last Modified" },
    { value: "Last Modified by me", label: "Last Modified by me" }
  ];

  const getStartupLogoUrl = () => {
    const logo = companyProfile?.logo;
    if (!logo || user?.role !== "STARTUP") return "";
    if (logo.startsWith("data:")) return logo;
    if (logo.startsWith("/uploads/")) {
      const backendUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
      return `${backendUrl}${logo}`;
    }
    return logo;
  };

  if (loading) {
    return null;
  }

  if (user?.role !== "EXPERT") {
    return <Navigate to={routes.unauthorized} replace />;
  }

  return (
    <>
        {/* Page wrapper */}
        <div className="page-wrapper">
          <div className="content pb-4">
            {/* Breadcrumb */}
            <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
              <div className="my-auto mb-2">
                <h2 className="mb-1">Notes</h2>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>
                        <i className="ti ti-smart-home" />
                      </Link>
                    </li>
                    <li className="breadcrumb-item">Application</li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Notes
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
                <div className="me-2 mb-2">
                  <div className="dropdown">
                    <Link
                      to="#"
                      className="dropdown-toggle btn btn-white d-inline-flex align-items-center"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-file-export me-2" />
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
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary d-flex align-items-center"
                    data-bs-toggle="modal" data-inert={true}
                    data-bs-target="#add_note"
                  >
                    <i className="ti ti-circle-plus me-2" />
                    Add Notes
                  </Link>
                </div>
                <div className="ms-2 head-icons">
                  <CollapseHeader />
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-xl-3 col-md-12 sidebars-right theiaStickySidebar section-bulk-widget">
                <div className="border rounded-3 bg-white p-3">
                  <div className="mb-3 pb-3 border-bottom">
                    <h4 className="d-flex align-items-center">
                      <i className="ti ti-file-text me-2" />
                      Notes List
                    </h4>
                  </div>
                  <div className="border-bottom pb-3 ">
                    <div
                      className="nav flex-column nav-pills"
                      id="v-pills-tab"
                      role="tablist"
                      aria-orientation="vertical"
                    >
                      <button
                        className="d-flex text-start align-items-center fw-medium fs-15 nav-link active mb-1"
                        id="v-pills-profile-tab"
                        data-bs-toggle="pill"
                        data-bs-target="#v-pills-profile"
                        type="button"
                        role="tab"
                        aria-controls="v-pills-profile"
                        aria-selected="true"
                      >
                        <i className="ti ti-inbox me-2" />
                        All Notes<span className="ms-2">{myNotes.length}</span>
                      </button>
                      <button
                        className="d-flex text-start align-items-center fw-medium fs-15 nav-link mb-1"
                        id="v-pills-messages-tab"
                        data-bs-toggle="pill"
                        data-bs-target="#v-pills-messages"
                        type="button"
                        role="tab"
                        aria-controls="v-pills-messages"
                        aria-selected="false"
                      >
                        <i className="ti ti-star me-2" />
                        Important
                      </button>
                      <button
                        className="d-flex text-start align-items-center fw-medium fs-15 nav-link mb-0"
                        id="v-pills-settings-tab"
                        data-bs-toggle="pill"
                        data-bs-target="#v-pills-settings"
                        type="button"
                        role="tab"
                        aria-controls="v-pills-settings"
                        aria-selected="false"
                      >
                        <i className="ti ti-trash me-2" />
                        Trash
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="border-bottom px-2 pb-3 mb-3">
                      <h5 className="mb-2">Tags</h5>
                      <div className="d-flex flex-column mt-2">
                        <Link to="#" className="text-info mb-2">
                          <span className="text-info me-2">
                            <i className="fas fa-square square-rotate fs-10" />
                          </span>
                          Pending
                        </Link>
                        <Link to="#" className="text-danger mb-2">
                          <span className="text-danger me-2">
                            <i className="fas fa-square square-rotate fs-10" />
                          </span>
                          Onhold
                        </Link>
                        <Link to="#" className="text-warning mb-2">
                          <span className="text-warning me-2">
                            <i className="fas fa-square square-rotate fs-10" />
                          </span>
                          Inprogress
                        </Link>
                        <Link to="#" className="text-success">
                          <span className="text-success me-2">
                            <i className="fas fa-square square-rotate fs-10" />
                          </span>
                          Done
                        </Link>
                      </div>
                    </div>
                    <div className="px-2">
                      <h5 className="mb-2">Priority</h5>
                      <div className="d-flex flex-column mt-2">
                        <Link to="#" className="text-warning mb-2">
                          <span className="text-warning me-2">
                            <i className="fas fa-square square-rotate fs-10" />
                          </span>
                          Medium
                        </Link>
                        <Link to="#" className="text-success mb-2">
                          <span className="text-success me-2">
                            <i className="fas fa-square square-rotate fs-10" />
                          </span>
                          High
                        </Link>
                        <Link to="#" className="text-danger">
                          <span className="text-danger me-2">
                            <i className="fas fa-square square-rotate fs-10" />
                          </span>
                          Low
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-xl-9 budget-role-notes">
                <div className="bg-white rounded-3 d-flex align-items-center justify-content-between flex-wrap mb-4 p-3 pb-0">
                  <div className="d-flex align-items-center mb-3">
                    <div className="me-3">
                      <CommonSelect
                        className="select"
                        options={optionsChoose}
                        defaultValue={optionsChoose[0]}
                      />
                    </div>
                    <Link to="#" className="btn btn-light">
                      Apply
                    </Link>
                  </div>
                  <div className="form-sort mb-3">
                    <i className="ti ti-filter feather-filter info-img" />
                    <CommonSelect
                      className="select"
                      options={recentChoose}
                      defaultValue={recentChoose[0]}
                    />
                  </div>
                </div>
                <div className="tab-content" id="v-pills-tabContent2">
                  <div
                    className="tab-pane fade active show"
                    id="v-pills-profile"
                    role="tabpanel"
                    aria-labelledby="v-pills-profile-tab"
                  >
                    <div className="border-bottom mb-4 pb-4">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="d-flex align-items-center justify-content-between flex-wrap mb-2">
                            <div className="d-flex align-items-center mb-3">
                              <h4>Important Notes </h4>
                              <div className="owl-nav slide-nav5 text-end nav-control ms-3" />
                            </div>
                            <div className="notes-close mb-3">
                              <Link
                                to="#"
                                className="text-danger fs-15"
                              >
                                <i className="fas fa-times me-1" /> Close{" "}
                              </Link>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-12">
                          {loadingNotes && (
                            <div className="row">
                              <div className="col-12">
                                <div className="card rounded-3 mb-0">
                                  <div className="card-body p-4 text-center">Loading...</div>
                                </div>
                              </div>
                            </div>
                          )}
                          {!loadingNotes && myNotes.length === 0 && (
                            <div className="row">
                              <div className="col-12">
                                <div className="card rounded-3 mb-0">
                                  <div className="card-body p-4 text-center">No notes yet</div>
                                </div>
                              </div>
                            </div>
                          )}
                          {!loadingNotes && myNotes.length > 0 && (
                            <div className="row g-3">
                              {myNotes.map((n) => (
                                <div className="col-lg-4 col-md-6 col-sm-6" key={n._id}>
                                  <div className="card rounded-3 mb-0 h-100">
                                    <div className="card-body p-4 d-flex flex-column">
                                      <div className="d-flex align-items-center justify-content-between mb-3">
                                        <span className={`badge d-inline-flex align-items-center ${n.priority === 'High' ? 'bg-outline-success' : n.priority === 'Medium' ? 'bg-outline-warning' : 'bg-outline-danger'}`}>
                                          <i className="fas fa-circle fs-6 me-1" />
                                          {n.priority || 'Medium'}
                                        </span>
                                        <div>
                                          <Link
                                            to="#"
                                            data-bs-toggle="dropdown"
                                            aria-expanded="false"
                                          >
                                            <i className="fas fa-ellipsis-v" />
                                          </Link>
                                          <div className="dropdown-menu notes-menu dropdown-menu-end">
                                            <button
                                              className="dropdown-item"
                                              onClick={() => openEditModal(n)}
                                              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                                            >
                                              <span>
                                                <i data-feather="edit" />
                                              </span>
                                              Edit
                                            </button>
                                            <button
                                              className="dropdown-item"
                                              onClick={() => openDeleteModal(n._id)}
                                              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                                            >
                                              <span>
                                                <i data-feather="trash-2" />
                                              </span>
                                              Delete
                                            </button>
                                            <Link
                                              to="#"
                                              className="dropdown-item"
                                            >
                                              <span>
                                                <i data-feather="star" />
                                              </span>
                                              Not Important
                                            </Link>
                                            <button
                                              className="dropdown-item"
                                              onClick={() => openViewModal(n)}
                                              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                                            >
                                              <span>
                                                <i data-feather="eye" />
                                              </span>
                                              View
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex-grow-1">
                                        <h5 className="text-truncate mb-2">
                                          <Link to="#" className="text-decoration-none">{n.title}</Link>
                                        </h5>
                                        <p className="mb-3 d-flex align-items-center text-dark small">
                                          <i className="ti ti-calendar me-1" />
                                          {new Date(n.createdAt).toLocaleDateString()}
                                        </p>
                                        <p className="text-muted small" style={{ 
                                          display: '-webkit-box',
                                          WebkitLineClamp: 3,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden'
                                        }}>
                                          {n.content}
                                        </p>
                                      </div>
                                      <div className="d-flex align-items-center justify-content-between border-top pt-3 mt-3">
                                        <div className="d-flex align-items-center">
                                          <Link
                                            to="#"
                                            className="avatar avatar-md me-2"
                                          >
                                            {user?.role === "STARTUP" && getStartupLogoUrl() ? (
                                              <img
                                                src={getStartupLogoUrl()}
                                                alt="Profile"
                                                className="img-fluid rounded-circle"
                                              />
                                            ) : (
                                              <ImageWithBasePath
                                                src="./assets/img/profiles/avatar-01.jpg"
                                                alt="Profile"
                                                className="img-fluid rounded-circle"
                                              />
                                            )}
                                          </Link>
                                          <span className="text-info d-flex align-items-center small">
                                            <i className="fas fa-square square-rotate fs-10 me-1" />
                                            {n?.companyId?.companyName || 'Personal'}
                                          </span>
                                        </div>
                                        <div className="d-flex align-items-center">
                                          <Link to="#" className="me-2">
                                            <span>
                                              <i className="fas fa-star text-warning" />
                                            </span>
                                          </Link>
                                          <Link to="#">
                                            <span>
                                              <i className="ti ti-trash text-danger" />
                                            </span>
                                          </Link>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                </div>
                </div>
                <div className="row custom-pagination">
                  <div className="col-md-12">
                    <div className="paginations d-flex justify-content-end">
                      <span>
                        <i className="fas fa-chevron-left" />
                      </span>
                      <ul className="d-flex align-items-center page-wrap">
                        <li>
                          <Link to="#" className="active">
                            1
                          </Link>
                        </li>
                        <li>
                          <Link to="#">2</Link>
                        </li>
                        <li>
                          <Link to="#">3</Link>
                        </li>
                        <li>
                          <Link to="#">4</Link>
                        </li>
                      </ul>
                      <span>
                        <i className="fas fa-chevron-right" />
                      </span>
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
        {/* /Page wrapper */}

      <NotesModal />

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Note</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleteModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete this note? This action cannot be undone.</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteNote}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Note Modal */}
      {viewModal && noteToView && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <div className="d-flex align-items-center">
                  <h4 className="modal-title me-3">Notes</h4>
                  <p className="text-info mb-0">{noteToView?.companyId?.companyName || 'Personal'}</p>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  onClick={() => setViewModal(false)}
                  aria-label="Close"
                >
                  <i className="ti ti-x"></i>
                </button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-12">
                    <div>
                      <h4 className="mb-2">{noteToView.title}</h4>
                      <p className="mb-3">{noteToView.content}</p>
                      <div className="d-flex align-items-center justify-content-between">
                        <span className={`badge d-inline-flex align-items-center ${noteToView.priority === 'High' ? 'bg-outline-danger' : noteToView.priority === 'Medium' ? 'bg-outline-warning' : 'bg-outline-success'}`}>
                          <i className="fas fa-circle fs-6 me-1" />
                          {noteToView.priority || 'Medium'}
                        </span>
                        <div className="d-flex align-items-center text-muted small">
                          <i className="ti ti-calendar me-1" />
                          {new Date(noteToView.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setViewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editModal && noteToEdit && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <div className="d-flex align-items-center">
                  <h4 className="modal-title me-3">Edit Note</h4>
                  <p className="text-info mb-0">{noteToEdit?.companyId?.companyName || 'Personal'}</p>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  onClick={() => setEditModal(false)}
                  aria-label="Close"
                >
                  <i className="ti ti-x"></i>
                </button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-12">
                    <form>
                      <div className="mb-3">
                        <label htmlFor="editTitle" className="form-label">Title</label>
                        <input
                          type="text"
                          className="form-control"
                          id="editTitle"
                          value={editForm.title}
                          onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                          placeholder="Enter note title"
                        />
                      </div>
                      <div className="mb-3">
                        <label htmlFor="editPriority" className="form-label">Priority</label>
                        <select
                          className="form-select"
                          id="editPriority"
                          value={editForm.priority}
                          onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <label htmlFor="editContent" className="form-label">Content</label>
                        <textarea
                          className="form-control"
                          id="editContent"
                          rows={6}
                          value={editForm.content}
                          onChange={(e) => setEditForm({...editForm, content: e.target.value})}
                          placeholder="Enter note content"
                        />
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEditNote}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Notes;
                              