import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import CommonSelect from "../../core/common/commonSelect";
import TicketListModal from "../../core/modals/ticketListModal";
import ticketService from "../../services/ticketService";
import { useAuth } from "../../contexts/AuthContext";
import { API_BASE_URL } from "../../services/apiService";
import companyProfileService from "../../services/companyProfileService";

const TicketDetails = () => {
    const routes = all_routes;
    const { id } = useParams();
    const auth = useAuth();
    const user = auth?.user;
    const isAuthenticated = auth?.isAuthenticated;
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [resolving, setResolving] = useState<boolean>(false);
    const [showReply, setShowReply] = useState<boolean>(false);
    const [replyContent, setReplyContent] = useState<string>("");
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [privacyUpdating, setPrivacyUpdating] = useState<boolean>(false);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [inlineReply, setInlineReply] = useState<string>("");
    const [deleting, setDeleting] = useState<string | null>(null);
    const [userIdToCompanyLogo, setUserIdToCompanyLogo] = useState<Record<string, string>>({});
    const isStartupOwner = !!(
      user &&
      user.role === "STARTUP" &&
      (user.id === ticket?.reportedBy?._id || user._id === ticket?.reportedBy?._id)
    );

    const getUserId = (u: any): string => String(u?._id || u?.id || "");

    const resolveAvatar = (u: any, companyLogo?: string): string => {
        const rawValue = companyLogo || u?.avatar || u?.profilePhoto || '';
        if (!rawValue) return 'assets/img/users/user-09.jpg';

        const raw = String(rawValue).trim();
        if (!raw) return 'assets/img/users/user-09.jpg';

        // Some persisted logos are wrongly prefixed as "/data:image..."
        if (raw.startsWith('/data:image/')) {
            return raw.substring(1);
        }

        if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
        if (raw.startsWith('/uploads') || raw.startsWith('uploads/')) {
            const normalized = raw.startsWith('/') ? raw : `/${raw}`;
            return `${API_BASE_URL}${normalized}`;
        }
        return raw; // assume it's already a public asset path
    };

    useEffect(() => {
        const loadCompanyLogos = async () => {
            if (!ticket) return;
            const map: Record<string, string> = {};
            const startupUsers: any[] = [];
            if (ticket?.reportedBy?.role === "STARTUP") startupUsers.push(ticket.reportedBy);
            if (ticket?.assignedTo?.role === "STARTUP") startupUsers.push(ticket.assignedTo);
            if (Array.isArray(ticket?.comments)) {
              ticket.comments.forEach((c: any) => {
                if (c?.authorId?.role === "STARTUP") startupUsers.push(c.authorId);
              });
            }
            const uniqueStartupIds: string[] = Array.from(
              new Set(startupUsers.map((u: any) => getUserId(u)).filter(Boolean))
            );
            await Promise.all(uniqueStartupIds.map(async (uid) => {
                try {
                    const res = await companyProfileService.getCompanyProfile(uid);
                    if (res?.success && res.data?.logo) {
                        map[uid] = res.data.logo;
                    }
                } catch {
                    // ignore logo fetch failure per user
                }
            }));
            setUserIdToCompanyLogo(map);
        };
        loadCompanyLogos();
    }, [ticket]);

    const changePriority = [
        { value: "High", label: "High" },
        { value: "Medium", label: "Medium" },
        { value: "Low", label: "Low" },
    ];
    const assignTo = [
        { value: "Edgar Hansel", label: "Edgar Hansel" },
        { value: "Juan Hermann", label: "Juan Hermann" },
    ];
    const ticketStatus = [
        { value: "Open", label: "Open" },
        { value: "On Hold", label: "On Hold" },
        { value: "Reopened", label: "Reopened" },
    ];

    const getStatusColor = (status?: string) => {
        switch (status) {
            case "OPEN": return "primary";
            case "IN_PROGRESS": return "warning";
            case "PENDING": return "info";
            case "RESOLVED": return "success";
            case "CLOSED": return "secondary";
            default: return "light";
        }
    };

    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case "URGENT": return "danger";
            case "HIGH": return "warning";
            case "MEDIUM": return "info";
            case "LOW": return "success";
            default: return "secondary";
        }
    };

    const formatTimeAgo = (dateString?: string) => {
        if (!dateString) return "";
        const diff = Date.now() - new Date(dateString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins} min ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} hours ago`;
        const days = Math.floor(hrs / 24);
        return `${days} days ago`;
    };

    useEffect(() => {
        const loadTicket = async () => {
            if (!id) { setError("Ticket introuvable"); setLoading(false); return; }
            try {
                setLoading(true);
                const res = await ticketService.getTicketById(id);
                if (res?.success) {
                    setTicket(res.data);
                } else {
                    setError("Erreur lors du chargement du ticket");
                }
            } catch (e: any) {
                setError(e?.message || "Erreur lors du chargement du ticket");
            } finally {
                setLoading(false);
            }
        };
        loadTicket();
    }, [id]);

    const handlePostReplyClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowReply(true);
        setTimeout(() => {
            const el = document.getElementById("reply-form");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
    };

    const submitReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !replyContent.trim()) return;
        try {
            setSubmitting(true);
            const res = await ticketService.addComment(id, { content: replyContent.trim() });
            if (res?.success) {
                setTicket(res.data);
                setReplyContent("");
                setShowReply(false);
            } else {
                setError("Erreur lors de l'ajout du commentaire");
            }
        } catch (err: any) {
            setError(err?.message || "Erreur lors de l'ajout du commentaire");
        } finally {
            setSubmitting(false);
        }
    };

    const startInlineReply = (comment: any) => {
        setActiveCommentId(comment._id || "");
        const author = comment.authorId ? `${comment.authorId.firstName} ${comment.authorId.lastName}` : "Utilisateur";
        setInlineReply(`@${author} `);
    };

    const submitInlineReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !inlineReply.trim()) return;
        try {
            setSubmitting(true);
            const res = await ticketService.addComment(id, { content: inlineReply.trim() });
            if (res?.success) {
                setTicket(res.data);
                setInlineReply("");
                setActiveCommentId(null);
            } else {
                setError("Erreur lors de la réponse");
            }
        } catch (err: any) {
            setError(err?.message || "Erreur lors de la réponse");
        } finally {
            setSubmitting(false);
        }
    };

    const [reacting, setReacting] = useState<boolean>(false);
    const toggleTicketReaction = async (type: 'LIKE' | 'LOVE') => {
        if (!id || reacting) return;
        try {
            setReacting(true);
            const res = await ticketService.reactToTicket(id, type);
            if (res?.success) setTicket(res.data);
        } finally {
            setReacting(false);
        }
    };
    const toggleCommentReaction = async (commentId: string, type: 'LIKE' | 'LOVE') => {
        if (!id || reacting) return;
        try {
            setReacting(true);
            const res = await ticketService.reactToComment(id, commentId, type);
            if (res?.success) setTicket(res.data);
        } finally {
            setReacting(false);
        }
    };

    const deleteComment = async (commentId: string) => {
        if (!id) return;
        const confirmed = window.confirm('Supprimer ce commentaire ?');
        if (!confirmed) return;
        try {
            setDeleting(commentId);
            const res = await ticketService.deleteComment(id, commentId);
            if (res?.success) setTicket(res.data);
        } catch (e: any) {
            setError(e?.message || 'Erreur lors de la suppression');
        } finally {
            setDeleting(null);
        }
    };

    const updateTicketPrivacy = async (isPublic: boolean) => {
      if (!id || privacyUpdating) return;
      if (!isAuthenticated || !isStartupOwner) {
        setError("Authentification requise");
        return;
      }
      try {
        setPrivacyUpdating(true);
        const res = await ticketService.updateTicket(id, { isPublic });
        if (res?.success) {
          setTicket((prev: any) => ({ ...prev, isPublic: res?.data?.isPublic ?? isPublic }));
        } else {
          setError(res?.message || "Erreur lors de la mise à jour de la visibilité");
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || "Erreur lors de la mise à jour de la visibilité");
      } finally {
        setPrivacyUpdating(false);
      }
    };

  return (
    <div className="page-wrapper">
        <div className="content">
        {/* Breadcrumb */}
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="mb-2">
            <h6 className="fw-medium d-flex align-items-center">
                <Link to={routes.tickets}>
                <i className="ti ti-arrow-left me-2" />
                Ticket Details
                </Link>
            </h6>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
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
        {loading ? (
            <div className="text-center p-5">Chargement...</div>
        ) : error ? (
            <div className="alert alert-danger">{error}</div>
        ) : (
        <div className="row">
            <div className="col-xl-9 col-md-8">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="text-info fw-medium">{ticket?.category || "Ticket"}</h5>
                  <div className="d-flex align-items-center">
                    <span className={"badge bg-" + getPriorityColor(ticket?.priority) + " me-3"}>
                      <i className="ti ti-circle-filled fs-5 me-1" />
                      {ticket?.priority || "-"}
                    </span>
                    {user && (user.id === ticket?.reportedBy?._id || user._id === ticket?.reportedBy?._id) && user.role === 'STARTUP' && ticket?.status !== 'RESOLVED' && (
                      <button
                        className="btn btn-sm btn-success d-inline-flex align-items-center me-2"
                        disabled={resolving}
                        onClick={async () => {
                          try {
                            setResolving(true);
                            const res = await ticketService.updateTicketStatus(ticket._id, 'RESOLVED');
                            if (res?.success) {
                              setTicket(res.data);
                            } else {
                              alert(res?.message || 'Impossible de résoudre le ticket');
                            }
                          } catch (e: any) {
                            console.error('Resolve ticket failed', e);
                            alert(e?.response?.data?.message || e?.message || 'Erreur lors de la résolution');
                          } finally {
                            setResolving(false);
                          }
                        }}
                      >
                        <i className="ti ti-check me-1" /> {resolving ? 'Resolving...' : 'Mark as Resolved'}
                      </button>
                    )}
                    {isStartupOwner && (
                      <div className="dropdown">
                        <Link
                          to="#"
                          className="dropdown-toggle px-2 py-1 btn btn-white d-inline-flex align-items-center"
                          data-bs-toggle="dropdown"
                        >
                          {privacyUpdating ? "Updating..." : (ticket?.isPublic ? "Mark as Public" : "Mark as Private")}
                        </Link>
                        <ul className="dropdown-menu  dropdown-menu-end p-2">
                          <li>
                            <Link
                              to="#"
                              className="dropdown-item rounded-1"
                              onClick={(e) => {
                                e.preventDefault();
                                updateTicketPrivacy(false);
                              }}
                            >
                              Mark as Private
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="#"
                              className="dropdown-item rounded-1"
                              onClick={(e) => {
                                e.preventDefault();
                                updateTicketPrivacy(true);
                              }}
                            >
                              Mark as Public{" "}
                            </Link>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <div className="card-body">
                  <div>
                    <div className="d-flex align-items-center justify-content-between flex-wrap border-bottom mb-3">
                      <div className="d-flex align-items-center flex-wrap">
                        <div className="mb-3">
                          <span className="badge badge-info rounded-pill mb-2">
                            Tic - {(ticket?._id ? ticket._id.slice(-3) : "---").padStart(3, '0')}
                          </span>
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="fw-semibold me-2">{ticket?.title || "-"}</h5>
                            <span className={"badge bg-outline-" + getStatusColor(ticket?.status) + " d-flex align-items-center ms-1"}>     
                              <i className="ti ti-circle-filled fs-5 me-1" />
                              {ticket?.status || "-"}
                            </span>
                          </div>
                          <div className="d-flex align-items-center flex-wrap row-gap-2">
                            <p className="d-flex align-items-center mb-0 me-2">
                              {(() => {
                                const publisher = ticket?.reportedBy;
                                const publisherId = getUserId(publisher);
                                return (
                                  <img
                                    src={resolveAvatar(publisher, userIdToCompanyLogo[publisherId])}
                                    className="avatar avatar-xs rounded-circle me-2"
                                    alt="img"
                                  />
                                );
                              })()}
                              <span className="text-dark ms-1">
                                {ticket?.companyName || (ticket?.reportedBy ? `${ticket.reportedBy.firstName || ""} ${ticket.reportedBy.lastName || ""}`.trim() : "") || "-"}
                              </span>
                            </p>
                            <p className="d-flex align-items-center mb-0 me-2">
                              <i className="ti ti-calendar-bolt me-1" />
                              Updated {formatTimeAgo(ticket?.updatedAt)}
                            </p>
                            <p className="d-flex align-items-center mb-0">
                              <i className="ti ti-message-circle-share me-1" />
                              {ticket?.comments ? ticket.comments.length : 0} Comments
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <Link to="#" className="btn btn-primary" onClick={handlePostReplyClick}>
                          <i className="ti ti-arrow-forward-up me-1" />
                          Post a Reply
                        </Link>
                      </div>
                    </div>
                    {showReply && (
                      <div id="reply-form" className="border rounded-2 p-3 mb-3 bg-white shadow-sm">
                        <form onSubmit={submitReply}>
                          <div className="mb-2">
                            <label className="form-label">Votre commentaire</label>
                            <textarea
                              className="form-control"
                              rows={4}
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Écrire un commentaire..."
                              required
                            />
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <button type="submit" className="btn btn-primary d-inline-flex align-items-center" disabled={submitting || !replyContent.trim()}>
                              <i className="ti ti-send me-1" />
                              {submitting ? "Envoi..." : "Publier"}
                            </button>
                            <button type="button" className="btn btn-white" onClick={() => setShowReply(false)} disabled={submitting}>
                              Annuler
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                    <div className="border-bottom mb-3 pb-3">
                      <div>
                        <p className="mb-3">
                          {ticket?.description || ""}
                        </p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <button type="button" className="btn btn-sm btn-light" disabled={reacting} onClick={() => toggleTicketReaction('LIKE')}>
                          👍 {ticket?.reactions?.LIKE ? ticket.reactions.LIKE.length : 0}
                        </button>
                        <button type="button" className="btn btn-sm btn-light" disabled={reacting} onClick={() => toggleTicketReaction('LOVE')}>
                          ❤️ {ticket?.reactions?.LOVE ? ticket.reactions.LOVE.length : 0}
                        </button>
                      </div>
                    </div>
                    {ticket?.comments && ticket.comments.length > 0 && (
                      <div className="mt-3">
                        {ticket.comments.map((c: any, idx: number) => (
                          <div key={c._id || idx} className="border-bottom mb-3 pb-3">
                            <div className="d-flex align-items-center mb-2">
                              <span className="avatar avatar-lg avatar-rounded me-2 flex-shrink-0">
                                <img src={resolveAvatar(c.authorId, userIdToCompanyLogo[getUserId(c.authorId)])} alt="Img" />
                              </span>
                              <div>
                                <h6 className="fw-medium mb-1">
                                  {c.authorId ? `${c.authorId.firstName} ${c.authorId.lastName}` : "Utilisateur"}
                                </h6>
                                <p className="mb-0"><i className="ti ti-calendar-bolt me-1" />{formatTimeAgo(c.createdAt)}</p>
                              </div>
                            </div>
                            <div className="mb-2">
                              <p className="mb-0">{c.content}</p>
                            </div>
                            <div className="d-flex align-items-center mt-2 gap-3">
                              <button type="button" className="d-inline-flex align-items-center text-primary fw-medium p-0 border-0 bg-transparent" onClick={() => startInlineReply(c)}>
                                <i className="ti ti-arrow-forward-up me-1" /> Reply
                              </button>
                              <div className="d-inline-flex align-items-center gap-1">
                                <button type="button" className="btn btn-xs btn-light" disabled={reacting} onClick={() => toggleCommentReaction(c._id, 'LIKE')}>
                                  👍 {c?.reactions?.LIKE ? c.reactions.LIKE.length : 0}
                                </button>
                                <button type="button" className="btn btn-xs btn-light" disabled={reacting} onClick={() => toggleCommentReaction(c._id, 'LOVE')}>
                                  ❤️ {c?.reactions?.LOVE ? c.reactions.LOVE.length : 0}
                                </button>
                              </div>
                              {isAuthenticated && user && c.authorId && (c.authorId._id === user.id || c.authorId._id === user._id) && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-white text-danger d-inline-flex align-items-center"
                                  onClick={() => deleteComment(c._id)}
                                  disabled={deleting === c._id}
                                >
                                  <i className="ti ti-trash me-1" /> {deleting === c._id ? 'Suppression...' : 'Supprimer'}
                                </button>
                              )}
                            </div>
                            {activeCommentId === (c._id || "") && (
                              <div className="mt-2 border rounded-2 p-3 bg-white">
                                <form onSubmit={submitInlineReply}>
                                  <div className="mb-2">
                                    <textarea
                                      className="form-control"
                                      rows={3}
                                      value={inlineReply}
                                      onChange={(e) => setInlineReply(e.target.value)}
                                      placeholder="Votre réponse..."
                                      required
                                    />
                                  </div>
                                  <div className="d-flex align-items-center gap-2">
                                    <button type="submit" className="btn btn-sm btn-primary d-inline-flex align-items-center" disabled={submitting || !inlineReply.trim()}>
                                      <i className="ti ti-send me-1" />
                                      {submitting ? "Envoi..." : "Répondre"}
                                    </button>
                                    <button type="button" className="btn btn-sm btn-white" onClick={() => { setActiveCommentId(null); setInlineReply(""); }} disabled={submitting}>
                                      Annuler
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-3 col-md-4">
              <div className="card">
                <div className="card-header p-3">
                  <h4>Ticket Details</h4>
                </div>
                <div className="card-body p-0">
                  <div className="border-bottom p-3">
                    <div className="mb-3">
                      <label className="form-label">Change Priority</label>
                      <CommonSelect
                        className="select"
                        options={changePriority}
                        defaultValue={changePriority[0]}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Assign To</label>
                      <CommonSelect
                        className="select"
                        options={assignTo}
                        defaultValue={assignTo[0]}
                      />
                    </div>
                    <div>
                      <label className="form-label">Ticket Status</label>
                      <CommonSelect
                        className="select"
                        options={ticketStatus}
                        defaultValue={ticketStatus[0]}
                      />
                    </div>
                  </div>
                  <div className="d-flex align-items-center border-bottom p-3">
                    <span className="avatar avatar-md me-2 flex-shrink-0">
                      <img
                        src={resolveAvatar(ticket?.reportedBy, userIdToCompanyLogo[getUserId(ticket?.reportedBy)])}
                        className="rounded-circle"
                        alt="Img"
                      />
                    </span>
                    <div>
                      <span className="fs-12">User</span>
                      <p className="text-dark">{ticket?.reportedBy ? `${ticket.reportedBy.firstName} ${ticket.reportedBy.lastName}` : "-"}</p>
                    </div>
                  </div>
                  <div className="d-flex align-items-center border-bottom p-3">
                    <span className="avatar avatar-md me-2 flex-shrink-0">
                      <img
                        src={resolveAvatar(ticket?.assignedTo, userIdToCompanyLogo[getUserId(ticket?.assignedTo)])}
                        className="rounded-circle"
                        alt="Img"
                      />
                    </span>
                    <div>
                      <span className="fs-12">Support Agent</span>
                      <p className="text-dark">{ticket?.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : "-"}</p>
                    </div>
                  </div>
                  <div className="border-bottom p-3">
                    <span className="fs-12">Category</span>
                    <p className="text-dark">{ticket?.category || "-"}</p>
                  </div>
                  <div className="border-bottom p-3">
                    <span className="fs-12">Email</span>
                    <p className="text-dark">{ticket?.contactEmail || "-"}</p>
                  </div>
                  <div className="p-3">
                    <span className="fs-12">Last Updated / Closed On</span>
                    <p className="text-dark">{ticket?.updatedAt ? new Date(ticket.updatedAt).toLocaleDateString() : "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
        <div className="footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3">
          <p className="mb-0">2014 - 2025 © SmartHR.</p>
          <p>
            Designed & Developed By{" "}
            <Link to="#" className="text-primary">
              Dreams
            </Link>
          </p>
        </div>

        {/* Modal within page */}
        <TicketListModal />
    </div>
  );
};

export default TicketDetails;
