import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import { API_BASE_URL, emailsAPI } from "../../services/apiService";
import { useAuth } from "../../contexts/AuthContext";
import companyProfileService from "../../services/companyProfileService";

type NotificationFilter = "all" | "read" | "unread";
type Role = "STARTUP" | "EXPERT" | "S2T";
type NotificationSource = "email" | "chat" | "call";

type NotificationUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: Role;
  avatar?: string;
  profilePhoto?: string;
};

type StartupProfileMeta = {
  userId: string;
  companyName?: string;
  logo?: string;
};

type NotificationItem = {
  _id: string;
  source: NotificationSource;
  user?: NotificationUser;
  title: string;
  description?: string;
  createdAt?: string;
  isRead: boolean;
  targetRoute: string;
  emailId?: string;
  conversationId?: string;
  callId?: string;
};

const Notifications = () => {
  const routes = all_routes;
  const { user, loading } = useAuth();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [seenCallIds, setSeenCallIds] = useState<string[]>([]);
  const [startupProfiles, setStartupProfiles] = useState<Record<string, StartupProfileMeta>>({});

  const allowed = useMemo(
    () => user?.role === "STARTUP" || user?.role === "EXPERT" || user?.role === "S2T",
    [user?.role]
  );
  const currentUserId = String((user as any)?.id || (user as any)?._id || (user as any)?.userId || "");
  const seenCallsStorageKey = `seen_call_notifications_${currentUserId}`;

  const resolveObjectId = (value: any) => String(value?._id || value?.id || value?.userId || value || "");

  const getStartupMetaForUser = (u?: NotificationUser) => {
    const id = resolveObjectId(u);
    if (!id) return null;
    return startupProfiles[id] || null;
  };

  const resolveAvatar = (u?: NotificationUser) => {
    const startupMeta = getStartupMetaForUser(u);
    const raw = String(startupMeta?.logo || u?.avatar || u?.profilePhoto || "").trim();
    if (!raw) return "/assets/img/users/user-49.jpg";
    if (raw.startsWith("/data:image/")) return raw.slice(1);
    if (raw.startsWith("data:")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return encodeURI(raw);
    if (raw.startsWith("/uploads/")) return encodeURI(`${API_BASE_URL}${raw}`);
    if (raw.startsWith("uploads/")) return encodeURI(`${API_BASE_URL}/${raw}`);
    if (raw.startsWith("assets/")) return `/${raw}`;
    return encodeURI(raw);
  };

  const displayName = (u?: NotificationUser) => {
    const startupMeta = getStartupMetaForUser(u);
    if (startupMeta?.companyName) return startupMeta.companyName;
    if (!u) return "Unknown";
    const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return full || u.email || "Unknown";
  };

  const formatTime = (dateLike?: string) => {
    if (!dateLike) return "";
    const parsed = new Date(dateLike);
    const ts = parsed.getTime();
    if (Number.isNaN(ts)) return "";
    const diffMins = Math.floor((Date.now() - ts) / 60000);
    if (diffMins <= 0) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return parsed.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const loadSeenCalls = () => {
    try {
      if (!currentUserId) {
        setSeenCallIds([]);
        return;
      }
      const raw = localStorage.getItem(seenCallsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSeenCallIds(Array.isArray(parsed) ? parsed.map((v) => String(v)) : []);
    } catch {
      setSeenCallIds([]);
    }
  };

  const loadStartupProfiles = async () => {
    try {
      const res = await companyProfileService.getAllCompanyProfiles();
      const list = Array.isArray(res?.data) ? res.data : [];
      const nextMap: Record<string, StartupProfileMeta> = {};
      list.forEach((p: any) => {
        const uid = resolveObjectId(p?.userId);
        if (!uid) return;
        nextMap[uid] = {
          userId: uid,
          companyName: p?.companyName || "",
          logo: p?.logo || "",
        };
      });
      setStartupProfiles(nextMap);
    } catch {
      setStartupProfiles({});
    }
  };

  const persistSeenCalls = (ids: string[]) => {
    setSeenCallIds(ids);
    if (!currentUserId) return;
    localStorage.setItem(seenCallsStorageKey, JSON.stringify(ids));
  };

  const markCallSeen = (callId?: string) => {
    if (!callId) return;
    if (seenCallIds.includes(callId)) return;
    persistSeenCalls([...seenCallIds, callId]);
  };

  const markConversationAsRead = async (conversationId?: string) => {
    if (!conversationId) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(`${API_BASE_URL}/api/chat/conversations/${conversationId}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // silent
    }
  };

  const loadNotifications = async () => {
    if (!currentUserId) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setItems([]);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [inboxRes, conversationsRes, callHistoryRes, activeCallsRes] = await Promise.all([
        emailsAPI.getInbox(""),
        fetch(`${API_BASE_URL}/api/chat/conversations`, { headers }),
        fetch(`${API_BASE_URL}/api/voice-calls/history?page=1&limit=50`, { headers }),
        fetch(`${API_BASE_URL}/api/voice-calls/active`, { headers }),
      ]);

      const inboxList = Array.isArray(inboxRes?.data?.data) ? inboxRes.data.data : [];
      const emailNotifs: NotificationItem[] = inboxList.map((mail: any) => ({
        _id: `email-${mail._id}`,
        source: "email",
        user: mail?.senderId,
        title: `${displayName(mail?.senderId)} sent you an email`,
        description: mail?.subject || "(No Subject)",
        createdAt: mail?.createdAt,
        isRead: !!mail?.isRead,
        targetRoute: routes.email,
        emailId: mail?._id,
      }));

      const convJson = conversationsRes.ok ? await conversationsRes.json() : { data: [] };
      const conversations = Array.isArray(convJson?.data) ? convJson.data : [];
      const chatNotifs: NotificationItem[] = conversations
        .map((conv: any) => {
          const unreadCountEntry = Array.isArray(conv?.unreadCount)
            ? conv.unreadCount.find((entry: any) => resolveObjectId(entry?.userId) === currentUserId)
            : null;
          const unreadMessages = Number(unreadCountEntry?.count || 0);
          if (unreadMessages <= 0) return null;
          const otherParticipant = (conv?.participants || [])
            .map((p: any) => p?.userId)
            .find((u: any) => resolveObjectId(u) !== currentUserId);
          return {
            _id: `chat-${conv?._id}`,
            source: "chat" as const,
            user: otherParticipant,
            title: `${displayName(otherParticipant)} sent you ${unreadMessages} message${
              unreadMessages > 1 ? "s" : ""
            }`,
            description: conv?.lastMessage?.content || "New message received",
            createdAt: conv?.lastMessage?.timestamp || conv?.updatedAt,
            isRead: false,
            targetRoute: routes.chat,
            conversationId: conv?._id,
          };
        })
        .filter(Boolean) as NotificationItem[];

      const historyJson = callHistoryRes.ok ? await callHistoryRes.json() : { data: { calls: [] } };
      const historyCalls = Array.isArray(historyJson?.data?.calls) ? historyJson.data.calls : [];
      const historyCallNotifs: NotificationItem[] = historyCalls
        .filter((call: any) => resolveObjectId(call?.receiverId) === currentUserId)
        .map((call: any) => {
          const caller = call?.callerId;
          const status = String(call?.status || "").toLowerCase();
          const statusLabel = status === "missed" ? "Missed incoming call" : "Incoming call";
          return {
            _id: `call-history-${call?._id}`,
            source: "call" as const,
            user: caller,
            title: `${statusLabel} from ${displayName(caller)}`,
            description: call?.callType === "video" ? "Video call" : "Voice call",
            createdAt: call?.createdAt,
            isRead: seenCallIds.includes(String(call?._id)),
            targetRoute: routes.chat,
            callId: call?._id,
          };
        });

      const activeJson = activeCallsRes.ok ? await activeCallsRes.json() : { data: [] };
      const activeCalls = Array.isArray(activeJson?.data) ? activeJson.data : [];
      const activeIncomingNotifs: NotificationItem[] = activeCalls
        .filter(
          (call: any) =>
            resolveObjectId(call?.receiverId) === currentUserId &&
            ["initiated", "ringing"].includes(String(call?.status || "").toLowerCase())
        )
        .map((call: any) => ({
          _id: `call-active-${call?._id}`,
          source: "call" as const,
          user: call?.callerId,
          title: `Incoming call from ${displayName(call?.callerId)}`,
          description: call?.callType === "video" ? "Video call is ringing" : "Voice call is ringing",
          createdAt: call?.createdAt,
          isRead: seenCallIds.includes(String(call?._id)),
          targetRoute: routes.chat,
          callId: call?._id,
        }));

      const combined = [...emailNotifs, ...chatNotifs, ...historyCallNotifs, ...activeIncomingNotifs].sort(
        (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
      );
      setItems(combined);
    } catch (e: any) {
      setItems([]);
      setError(e?.response?.data?.message || "Unable to load notifications");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadSeenCalls();
  }, [currentUserId]);

  useEffect(() => {
    if (!allowed) return;
    loadStartupProfiles();
    loadNotifications();
  }, [allowed, currentUserId, seenCallIds.length]);

  const markAsRead = async (notification: NotificationItem) => {
    try {
      if (notification.source === "email" && notification.emailId) {
        await emailsAPI.markAsRead(notification.emailId);
      } else if (notification.source === "chat" && notification.conversationId) {
        await markConversationAsRead(notification.conversationId);
      } else if (notification.source === "call" && notification.callId) {
        markCallSeen(notification.callId);
      }
      setItems((prev) => prev.map((m) => (m._id === notification._id ? { ...m, isRead: true } : m)));
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    const unreadItems = items.filter((m) => !m.isRead);
    if (!unreadItems.length) return;
    try {
      await Promise.all(
        unreadItems.map(async (item) => {
          if (item.source === "email" && item.emailId) {
            await emailsAPI.markAsRead(item.emailId);
            return;
          }
          if (item.source === "chat" && item.conversationId) {
            await markConversationAsRead(item.conversationId);
            return;
          }
          if (item.source === "call" && item.callId) {
            markCallSeen(item.callId);
          }
        })
      );
      setItems((prev) => prev.map((m) => ({ ...m, isRead: true })));
    } catch {
      // silent
    }
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === "read") return items.filter((m) => !!m.isRead);
    if (activeFilter === "unread") return items.filter((m) => !m.isRead);
    return items;
  }, [items, activeFilter]);

  const counts = useMemo(() => {
    const total = items.length;
    const unread = items.filter((m) => !m.isRead).length;
    return { total, unread, read: total - unread };
  }, [items]);

  if (loading) return null;
  if (!allowed) return <Navigate to={routes.unauthorized} replace />;

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="mb-1">Notifications</h4>
            <p className="text-muted mb-0">
              Total: {counts.total} | Unread: {counts.unread} | Read: {counts.read}
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm ${activeFilter === "all" ? "btn-primary" : "btn-light"}`}
              onClick={() => setActiveFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeFilter === "unread" ? "btn-primary" : "btn-light"}`}
              onClick={() => setActiveFilter("unread")}
            >
              Unread
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeFilter === "read" ? "btn-primary" : "btn-light"}`}
              onClick={() => setActiveFilter("read")}
            >
              Read
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={markAllAsRead}>
              Mark all as read
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {loadingItems && <p className="text-muted mb-0">Loading notifications...</p>}
            {!loadingItems && error && <p className="text-danger mb-0">{error}</p>}
            {!loadingItems && !error && filteredItems.length === 0 && (
              <p className="text-muted mb-0">No notifications for this filter.</p>
            )}

            {!loadingItems &&
              !error &&
              filteredItems.map((item, idx) => (
                <div
                  key={item._id}
                  className={`d-flex align-items-start justify-content-between py-3 ${
                    idx < filteredItems.length - 1 ? "border-bottom" : ""
                  }`}
                >
                  <div className="d-flex align-items-start me-3">
                    <span className="avatar avatar-lg me-2 flex-shrink-0">
                      <img
                        src={resolveAvatar(item.user)}
                        alt="sender"
                        className="rounded-circle w-100 h-100 object-fit-cover"
                        onError={(ev) => {
                          ev.currentTarget.src = "/assets/img/users/user-49.jpg";
                        }}
                      />
                    </span>
                    <div>
                      <h6 className="mb-1">
                        {item.source === "email"
                          ? "Email"
                          : item.source === "chat"
                          ? "Message"
                          : "Call"}{" "}
                        {!item.isRead && <span className="badge bg-danger-transparent ms-1">Unread</span>}
                      </h6>
                      <p className="mb-1 text-dark">
                        <strong>{item.title}</strong>
                      </p>
                      <p className="mb-1 text-muted">
                        {(item.description || "").trim().slice(0, 160) || "No content"}
                      </p>
                      <small className="text-muted">{formatTime(item.createdAt)}</small>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {!item.isRead && (
                      <button
                        type="button"
                        className="btn btn-sm btn-light"
                        onClick={() => markAsRead(item)}
                      >
                        Mark read
                      </button>
                    )}
                    <Link to={item.targetRoute} className="btn btn-sm btn-primary">
                      Open
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
