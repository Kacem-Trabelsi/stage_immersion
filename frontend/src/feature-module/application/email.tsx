import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import Scrollbars from "react-custom-scrollbars-2";
import { Chips, ChipsChangeEvent } from "primereact/chips";
import { emailsAPI, API_BASE_URL } from "../../services/apiService";
import { useAuth } from "../../contexts/AuthContext";

type Role = "STARTUP" | "EXPERT" | "S2T";
type EmailFolder = "inbox" | "sent";

type EmailUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: Role;
  avatar?: string;
  profilePhoto?: string;
};

type EmailItem = {
  _id: string;
  senderId: EmailUser;
  to: EmailUser[];
  cc: EmailUser[];
  subject: string;
  body: string;
  createdAt: string;
  isRead?: boolean;
};

const Email = () => {
  const routes = all_routes;
  const { user, loading } = useAuth();
  const [show, setShow] = useState<boolean>(false);
  const [folder, setFolder] = useState<EmailFolder>("inbox");
  const [search, setSearch] = useState("");

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailsError, setEmailsError] = useState("");

  const [contacts, setContacts] = useState<EmailUser[]>([]);
  const [toChips, setToChips] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState("");

  const [selectedMail, setSelectedMail] = useState<EmailItem | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);

  const allowed = useMemo(() => {
    return user?.role === "STARTUP" || user?.role === "EXPERT" || user?.role === "S2T";
  }, [user?.role]);

  const customChip = (item: string) => (
    <div>
      <span className="tag label label-info">{item}</span>
    </div>
  );

  const formatTime = (dateLike?: string) => {
    if (!dateLike) return "";
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayName = (u?: EmailUser) => {
    if (!u) return "Unknown";
    const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return full || u.email || "Unknown";
  };

  const resolveAvatar = (u?: EmailUser) => {
    const raw = (u?.avatar || u?.profilePhoto || "").trim();
    if (!raw) return "/assets/img/users/user-49.jpg";
    if (raw.startsWith("/data:image/")) return raw.slice(1);
    if (raw.startsWith("data:")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return encodeURI(raw);
    if (raw.startsWith("/uploads/")) return encodeURI(`${API_BASE_URL}${raw}`);
    if (raw.startsWith("uploads/")) return encodeURI(`${API_BASE_URL}/${raw}`);
    if (raw.startsWith("assets/")) return `/${raw}`;
    return encodeURI(raw);
  };

  const unreadCount = useMemo(() => {
    if (folder === "inbox") {
      return emails.filter((e) => !e.isRead).length;
    }
    return inboxUnreadCount;
  }, [emails, folder, inboxUnreadCount]);

  const loadContacts = async () => {
    try {
      const res = await emailsAPI.getContacts();
      setContacts(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch {
      setContacts([]);
    }
  };

  const loadEmails = async (targetFolder: EmailFolder, q: string) => {
    setLoadingEmails(true);
    setEmailsError("");
    try {
      const res =
        targetFolder === "inbox"
          ? await emailsAPI.getInbox(q)
          : await emailsAPI.getSent(q);
      const list = Array.isArray(res?.data?.data) ? res.data.data : [];
      setEmails(list);
      setSelectedMail((prev) => {
        if (!list.length) return null;
        if (prev) {
          const stillThere = list.find((m: EmailItem) => m._id === prev._id);
          if (stillThere) return stillThere;
        }
        return list[0];
      });
    } catch (e: any) {
      setEmails([]);
      setSelectedMail(null);
      setEmailsError(e?.response?.data?.message || "Erreur de chargement des emails");
    } finally {
      setLoadingEmails(false);
    }
  };

  const refreshMailboxStats = async () => {
    try {
      const [inboxRes, sentRes] = await Promise.all([emailsAPI.getInbox(""), emailsAPI.getSent("")]);
      const inboxList: EmailItem[] = Array.isArray(inboxRes?.data?.data) ? inboxRes.data.data : [];
      const sentList: EmailItem[] = Array.isArray(sentRes?.data?.data) ? sentRes.data.data : [];
      setInboxCount(inboxList.length);
      setSentCount(sentList.length);
      setInboxUnreadCount(inboxList.filter((m) => !m.isRead).length);
    } catch {
      // silent
    }
  };

  const markReadIfNeeded = async (mail: EmailItem | null) => {
    if (!mail || folder !== "inbox" || mail.isRead) return;
    try {
      await emailsAPI.markAsRead(mail._id);
      setEmails((prev) => prev.map((m) => (m._id === mail._id ? { ...m, isRead: true } : m)));
      setSelectedMail((prev) => (prev && prev._id === mail._id ? { ...prev, isRead: true } : prev));
      setInboxUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!allowed) return;
    loadContacts();
    refreshMailboxStats();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    loadEmails(folder, search);
  }, [allowed, folder, search]);

  useEffect(() => {
    markReadIfNeeded(selectedMail);
  }, [selectedMail, folder]);

  const resetCompose = () => {
    setToChips([]);
    setSubject("");
    setBody("");
    setComposeError("");
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeError("");

    // If user typed an email but didn't press Enter,
    // PrimeReact Chips may keep it only in the input element.
    const chipsInput = document.querySelector(
      "#compose-view .p-chips input"
    ) as HTMLInputElement | null;
    const pendingInput = String(chipsInput?.value || "").trim();

    // Accept multiple input formats from chips:
    // - plain email
    // - "Name <email@domain>"
    // - comma/semicolon/space separated entries
    const normalizedInputs = [...toChips, pendingInput]
      .flatMap((chip) => String(chip || "").split(/[,;]+/))
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((raw) => {
        const match = raw.match(/<([^>]+)>/);
        return (match?.[1] || raw).trim().toLowerCase();
      });

    const uniqueInputs = Array.from(new Set(normalizedInputs));
    const toIds = contacts
      .filter((c) => {
        const email = String(c.email || "").trim().toLowerCase();
        const fullName = `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase();
        return (
          uniqueInputs.includes(email) ||
          uniqueInputs.some((val) => val === email || val.includes(email)) ||
          (fullName && uniqueInputs.includes(fullName))
        );
      })
      .map((c) => c._id);

    if (!toIds.length) {
      setComposeError("Ajoutez des destinataires valides (emails existants).");
      return;
    }
    if (!subject.trim() && !body.trim()) {
      setComposeError("Ajoutez un sujet ou un message.");
      return;
    }

    setSending(true);
    try {
      await emailsAPI.send({
        to: toIds,
        subject: subject.trim(),
        body: body.trim(),
      });
      if (chipsInput) {
        chipsInput.value = "";
      }
      setShow(false);
      resetCompose();
      setFolder("sent");
      loadEmails("sent", "");
      refreshMailboxStats();
    } catch (e: any) {
      setComposeError(e?.response?.data?.message || "Envoi echoue.");
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = async () => {
    if (!selectedMail) return;
    const answer = window.prompt("Votre reponse :");
    if (!answer || !answer.trim()) return;
    setReplyLoading(true);
    try {
      await emailsAPI.reply(selectedMail._id, { body: answer.trim() });
      loadEmails(folder, search);
      refreshMailboxStats();
    } catch (e: any) {
      window.alert(e?.response?.data?.message || "Reponse echouee.");
    } finally {
      setReplyLoading(false);
    }
  };

  if (loading) return null;
  if (!allowed) return <Navigate to={routes.unauthorized} replace />;

  return (
    <>
      <div className="page-wrapper">
        <div className="content p-0">
          <div className="d-md-flex">
            <div
              className="email-sidebar border-end border-bottom"
              style={{ width: 340, minWidth: 340 }}
            >
              <div className="active slimscroll h-100">
                <div className="slimscroll-active-sidebar">
                  <div className="p-3">
                    <div className="shadow-md bg-white rounded p-3 mb-4 border">
                      <div className="d-flex align-items-center min-w-0">
                        <Link to="#" className="avatar avatar-md flex-shrink-0 me-2">
                          <img
                            src={resolveAvatar(user as any)}
                            className="rounded-circle w-100 h-100 object-fit-cover"
                            alt="Img"
                            onError={(ev) => {
                              ev.currentTarget.src = "/assets/img/users/user-49.jpg";
                            }}
                          />
                        </Link>
                        <div className="min-w-0" style={{ maxWidth: 280, width: "100%" }}>
                          <h6 className="mb-1 text-truncate" style={{ maxWidth: 280 }}>
                            <Link to="#" className="text-dark">{`${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || "User"}</Link>
                          </h6>
                          <p className="mb-0 text-muted fs-13" style={{ maxWidth: 280, overflowWrap: "anywhere" }}>
                            {(user as any)?.email || "-"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Link
                      to="#"
                      className="btn btn-primary w-100"
                      id="compose_mail"
                      onClick={() => setShow(true)}
                    >
                      <i className="ti ti-edit me-2" />
                      Compose
                    </Link>

                    <div className="mt-4">
                      <h5 className="mb-2">Emails</h5>
                      <div className="d-block mb-4 pb-4 border-bottom email-tags">
                        <Link
                          to="#"
                          className={`d-flex align-items-center justify-content-between p-2 rounded ${folder === "inbox" ? "active" : ""}`}
                          onClick={() => setFolder("inbox")}
                        >
                          <span className="d-flex align-items-center fw-medium">
                            <i className="ti ti-inbox text-gray me-2" />
                            Inbox
                          </span>
                          <span className="badge badge-danger rounded-pill badge-xs">{inboxUnreadCount}</span>
                        </Link>
                        <Link
                          to="#"
                          className={`d-flex align-items-center justify-content-between p-2 rounded ${folder === "sent" ? "active" : ""}`}
                          onClick={() => setFolder("sent")}
                        >
                          <span className="d-flex align-items-center fw-medium">
                            <i className="ti ti-rocket text-gray me-2" />
                            Sent
                          </span>
                          <span className="badge text-gray rounded-pill">{sentCount}</span>
                        </Link>
                      </div>
                    </div>

                    <div className="bg-dark rounded text-center position-relative p-4">
                      <span className="avatar avatar-lg rounded-circle bg-white mb-2">
                        <i className="ti ti-mail text-dark" />
                      </span>
                      <h6 className="text-white mb-1">Internal Emails</h6>
                      <p className="text-white-50 mb-0 fs-12">STARTUP / EXPERT / S2T</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white flex-fill border-end border-bottom mail-notifications">
              <Scrollbars>
                <div className="slimscroll-active-sidebar">
                  <div className="p-3">
                    <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                      <div>
                        <h5 className="mb-1">{folder === "inbox" ? "Inbox" : "Sent"}</h5>
                        <div className="d-flex align-items-center">
                          <span>{folder === "inbox" ? inboxCount : sentCount} Emails</span>
                          <i className="ti ti-point-filled text-primary mx-1" />
                          <span>{inboxUnreadCount} Unread</span>
                        </div>
                      </div>
                      <div className="d-flex align-items-center">
                        <div className="position-relative input-icon me-3">
                          <span className="input-icon-addon">
                            <i className="ti ti-search" />
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search Email"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="list-group list-group-flush mails-list">
                    {loadingEmails && <div className="list-group-item p-3 text-muted">Loading emails...</div>}
                    {!loadingEmails && emailsError && <div className="list-group-item p-3 text-danger">{emailsError}</div>}
                    {!loadingEmails && !emailsError && emails.length === 0 && (
                      <div className="list-group-item p-3 text-muted">No emails found.</div>
                    )}

                    {!loadingEmails &&
                      !emailsError &&
                      emails.map((mail) => {
                        const mainUser = folder === "inbox" ? mail.senderId : mail.to?.[0];
                        const initials =
                          (displayName(mainUser).split(" ")[0]?.[0] || "U") +
                          (displayName(mainUser).split(" ")[1]?.[0] || "");
                        const active = selectedMail?._id === mail._id;
                        return (
                          <div
                            className={`list-group-item border-bottom p-3 ${active ? "bg-light" : ""}`}
                            key={mail._id}
                            role="button"
                            onClick={() => setSelectedMail(mail)}
                          >
                            <div className="d-flex align-items-center mb-2">
                              <div className="d-flex align-items-center flex-wrap row-gap-2 flex-fill">
                                <Link to="#" className="avatar bg-purple avatar-rounded me-2">
                                  {mainUser?.avatar || mainUser?.profilePhoto ? (
                                    <img
                                      src={resolveAvatar(mainUser)}
                                      className="rounded-circle w-100 h-100 object-fit-cover"
                                      alt="avatar"
                                      onError={(ev) => {
                                        ev.currentTarget.src = "/assets/img/users/user-49.jpg";
                                      }}
                                    />
                                  ) : (
                                    <span className="avatar-title">{initials.toUpperCase()}</span>
                                  )}
                                </Link>
                                <div className="flex-fill">
                                  <div className="d-flex align-items-start justify-content-between">
                                    <div>
                                      <h6 className="mb-1">
                                        <Link to="#">{displayName(mainUser)}</Link>
                                      </h6>
                                      <span className={`fw-semibold ${mail.isRead ? "" : "text-dark"}`}>
                                        {mail.subject || "(No Subject)"}
                                      </span>
                                    </div>
                                    <div className="d-flex align-items-center">
                                      <span>
                                        <i className={`ti ti-point-filled ${mail.isRead ? "text-success" : "text-danger"}`} />
                                        {formatTime(mail.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="mb-0 text-truncate">{mail.body || "-"}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </Scrollbars>
            </div>

            <div className="mail-detail bg-white border-bottom p-3 w-100">
              {!selectedMail ? (
                <div className="text-muted mt-3">Select an email to view details.</div>
              ) : (
                <div>
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2 border-bottom mb-3 pb-3">
                    <div>
                      <h5 className="mb-1">{selectedMail.subject || "(No Subject)"}</h5>
                      <small className="text-muted">{formatTime(selectedMail.createdAt)}</small>
                    </div>
                    <div className="d-flex align-items-center">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleQuickReply}
                        disabled={replyLoading}
                      >
                        {replyLoading ? "Replying..." : "Reply"}
                      </button>
                    </div>
                  </div>
                  <div className="bg-light-500 rounded p-3 mb-3">
                    <p className="mb-1">
                      <b>From:</b> {displayName(selectedMail.senderId)} ({selectedMail.senderId?.email || "-"})
                    </p>
                    <p className="mb-1">
                      <b>To:</b> {selectedMail.to?.map((u) => displayName(u)).join(", ") || "-"}
                    </p>
                    {!!selectedMail.cc?.length && (
                      <p className="mb-0">
                        <b>Cc:</b> {selectedMail.cc.map((u) => displayName(u)).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="card shadow-none">
                    <div className="card-body">
                      <p className="text-dark" style={{ whiteSpace: "pre-wrap" }}>
                        {selectedMail.body || "(Empty email body)"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="footer d-sm-flex align-items-center justify-content-between bg-white p-3">
            <p className="mb-0">2014 - 2025 © SmartHR.</p>
            <p>
              Designed &amp; Developed By{" "}
              <Link to="#" className="text-primary">
                Dreams
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div id="compose-view" className={show ? "show" : ""}>
        <div className="bg-white border-0 rounded compose-view">
          <div className="compose-header d-flex align-items-center justify-content-between bg-dark p-3">
            <h5 className="text-white">Compose New Email</h5>
            <div className="d-flex align-items-center">
              <button
                type="button"
                className="btn-close custom-btn-close bg-transparent fs-16 text-white position-static"
                id="compose-close"
                onClick={() => {
                  setShow(false);
                  setComposeError("");
                }}
              >
                <i className="ti ti-x" />
              </button>
            </div>
          </div>
          <form onSubmit={handleSend}>
            <div className="p-3 position-relative pb-2 border-bottom chip-with-image">
              <div className="tag-with-img d-flex align-items-center">
                <label className="form-label me-2">To</label>
                <Chips
                  value={toChips}
                  className="input-tags form-control border-0 h-100 w-100"
                  onChange={(e: ChipsChangeEvent) => setToChips((e.value || []) as string[])}
                  itemTemplate={customChip}
                  placeholder="Type recipient email and press Enter"
                />
              </div>
              <small className="text-muted d-block mt-1">
                Contacts disponibles: {contacts.slice(0, 4).map((c) => c.email).filter(Boolean).join(", ")}
                {contacts.length > 4 ? "..." : ""}
              </small>
            </div>
            <div className="p-3 border-bottom">
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="mb-0">
                <textarea
                  rows={7}
                  className="form-control"
                  placeholder="Compose Email"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              {!!composeError && <div className="text-danger mt-2">{composeError}</div>}
            </div>
            <div className="p-3 d-flex align-items-center justify-content-end">
              <button
                type="submit"
                className="btn btn-primary d-inline-flex align-items-center ms-2"
                disabled={sending}
              >
                {sending ? "Sending..." : "Send"} <i className="ti ti-arrow-right ms-2" />
              </button>
            </div>
          </form>
        </div>
      </div>
      {show && <div className="modal-backdrop fade show" />}
    </>
  );
};

export default Email;

