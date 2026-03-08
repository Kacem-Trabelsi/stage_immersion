import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { all_routes } from "../../router/all_routes";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import ReactApexChart from "react-apexcharts";
import CircleProgressSmall from "./circleProgressSmall";
import CircleProgress from "./circleProgress";
import { Calendar } from 'primereact/calendar';
import { DatePicker } from "antd";
import CommonSelect from "../../../core/common/commonSelect";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { useCompanyProfile } from "../../../hooks/useCompanyProfile";
import { useUser } from "../../../hooks/useUser";
import ticketService from "../../../services/ticketService";
import VoiceCallService from "../../../services/voiceCallService";
import { API_BASE_URL, emailsAPI, meetingsAPI } from "../../../services/apiService";
import "./employee-dashboard.css";

type ExpertUser = {
  _id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  avatar?: string;
  profilePhoto?: string;
  country?: string;
  phone?: string;
  position?: string;
};

type DashboardNotificationSource = "email" | "chat" | "call";

type DashboardNotificationUser = {
  _id?: string;
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  profilePhoto?: string;
};

type DashboardNotificationItem = {
  _id: string;
  source: DashboardNotificationSource;
  user?: DashboardNotificationUser;
  title: string;
  description?: string;
  createdAt?: string;
  isRead: boolean;
  targetRoute: string;
};

type DashboardMeetingItem = {
  _id: string;
  title: string;
  start?: string;
  end?: string;
  description?: string;
  meetingType?: "ONLINE" | "OFFLINE";
  meetingLink?: string;
};


const EmployeeDashboard = () => {
  const routes = all_routes;
  const { user, userStats, loading: userLoading, error: userError } = useUser();
  const { companyProfile } = useCompanyProfile(user?._id);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [nextPublishedEvent, setNextPublishedEvent] = useState<any | null>(null);
  const [nextEventLoading, setNextEventLoading] = useState(false);
  const [countdownNow, setCountdownNow] = useState<number>(Date.now());
  const [startupExperts, setStartupExperts] = useState<ExpertUser[]>([]);
  const [loadingStartupExperts, setLoadingStartupExperts] = useState(false);
  const [startupExpertsError, setStartupExpertsError] = useState("");
  const [dashboardNotifications, setDashboardNotifications] = useState<DashboardNotificationItem[]>([]);
  const [loadingDashboardNotifications, setLoadingDashboardNotifications] = useState(false);
  const [meetingSchedule, setMeetingSchedule] = useState<DashboardMeetingItem[]>([]);
  const [meetingFilter, setMeetingFilter] = useState<"today" | "month" | "year">("today");
  const [dashboardMetrics, setDashboardMetrics] = useState({
    ticketsTotal: 0,
    ticketsOpen: 0,
    ticketsInProgress: 0,
    ticketsResolved: 0,
    ticketsPrivate: 0,
    ticketsPublic: 0,
    conversationsTotal: 0,
    callsTotal: 0,
    callsMissed: 0,
    callsRejected: 0,
    callsEnded: 0,
    monthlyCategories: [] as string[],
    monthlyActivity: [] as number[],
  });

  const [date, setDate] = useState(new Date('2024'));

  const profileCompletion = useMemo(() => {
    if (!companyProfile) return 0;
    const fields = [
      companyProfile.companyName,
      companyProfile.founderName,
      companyProfile.email,
      companyProfile.phone,
      companyProfile.activityDomain,
      companyProfile.activitySubDomain,
      companyProfile.projectProgress,
      companyProfile.staffRange,
      companyProfile.address,
      companyProfile.logo,
      companyProfile.website,
      companyProfile.longDescription,
      companyProfile.businessPlanSummary,
      companyProfile.targetMarket,
      companyProfile.staffPositions,
    ];
    const completed = fields.filter((f) => typeof f === "string" ? f.trim() : !!f).length;
    return Math.round((completed / fields.length) * 100);
  }, [companyProfile]);

  const isStartupSession = user?.role === "STARTUP";

  const startupLogoUrl = useMemo(() => {
    const rawLogo = typeof companyProfile?.logo === "string" ? companyProfile.logo.trim() : "";
    if (!rawLogo) return "";
    if (rawLogo.startsWith("data:image/")) return rawLogo;
    if (rawLogo.startsWith("/data:image/")) return rawLogo.slice(1);
    if (rawLogo.startsWith("http://") || rawLogo.startsWith("https://")) return rawLogo;
    if (rawLogo.startsWith("/uploads/")) return `${API_BASE_URL}${rawLogo}`;
    if (rawLogo.startsWith("uploads/")) return `${API_BASE_URL}/${rawLogo}`;
    if (rawLogo.startsWith("/assets/") || rawLogo.startsWith("assets/")) return rawLogo.startsWith("/") ? rawLogo : `/${rawLogo}`;
    return `${API_BASE_URL}/uploads/${rawLogo}`;
  }, [companyProfile?.logo]);

  const startupDisplayName = useMemo(() => {
    const companyName = typeof companyProfile?.companyName === "string" ? companyProfile.companyName.trim() : "";
    if (companyName) return companyName;
    if (user?.firstName || user?.lastName) return `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
    return "Startup";
  }, [companyProfile?.companyName, user?.firstName, user?.lastName]);

  const globalScore = useMemo(() => {
    const resolutionRate = dashboardMetrics.ticketsTotal
      ? (dashboardMetrics.ticketsResolved / dashboardMetrics.ticketsTotal) * 100
      : 0;
    const engagementRate = Math.min(
      100,
      dashboardMetrics.conversationsTotal * 10 + dashboardMetrics.callsTotal * 5
    );
    return Math.round(resolutionRate * 0.5 + profileCompletion * 0.3 + engagementRate * 0.2);
  }, [dashboardMetrics, profileCompletion]);

  const activityDelta = useMemo(() => {
    const arr = dashboardMetrics.monthlyActivity;
    if (arr.length < 2) return 0;
    const current = arr[arr.length - 1] || 0;
    const previous = arr[arr.length - 2] || 0;
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }, [dashboardMetrics.monthlyActivity]);

  useEffect(() => {
    const buildLastMonths = (count: number) => {
      const keys: string[] = [];
      const labels: string[] = [];
      const now = new Date();
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        keys.push(key);
        labels.push(d.toLocaleString("en-US", { month: "short" }));
      }
      return { keys, labels };
    };

    const monthBucket = (dateLike: any) => {
      if (!dateLike) return "";
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const fetchDashboardMetrics = async () => {
      if (!user || user.role !== "STARTUP") return;
      setDashboardLoading(true);
      try {
        const [ticketsRes, callsRes, conversationsRes] = await Promise.allSettled([
          ticketService.getAllTickets({ page: 1, limit: 200 }),
          VoiceCallService.getCallHistory(1, 100),
          (async () => {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
                "Content-Type": "application/json",
              },
            });
            return res.json();
          })(),
        ]);

        const ticketsPayload =
          ticketsRes.status === "fulfilled" ? ticketsRes.value : {};
        const callsPayload =
          callsRes.status === "fulfilled" ? callsRes.value : {};
        const conversationsPayload =
          conversationsRes.status === "fulfilled" ? conversationsRes.value : {};

        const tickets: any[] = Array.isArray((ticketsPayload as any)?.data?.tickets)
          ? (ticketsPayload as any).data.tickets
          : Array.isArray((ticketsPayload as any)?.tickets)
          ? (ticketsPayload as any).tickets
          : [];
        const calls: any[] = Array.isArray((callsPayload as any)?.data?.calls)
          ? (callsPayload as any).data.calls
          : [];
        const conversations: any[] = Array.isArray((conversationsPayload as any)?.data)
          ? (conversationsPayload as any).data
          : [];

        const { keys, labels } = buildLastMonths(7);
        const monthlyMap = new Map<string, number>(keys.map((k) => [k, 0]));

        tickets.forEach((t) => {
          const key = monthBucket(t?.createdAt);
          if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
        });
        calls.forEach((c) => {
          const key = monthBucket(c?.createdAt);
          if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
        });
        conversations.forEach((c) => {
          const key = monthBucket(c?.updatedAt || c?.createdAt);
          if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
        });

        setDashboardMetrics({
          ticketsTotal: tickets.length,
          ticketsOpen: tickets.filter((t) => t?.status === "OPEN").length,
          ticketsInProgress: tickets.filter((t) => t?.status === "IN_PROGRESS" || t?.status === "PENDING").length,
          ticketsResolved: tickets.filter((t) => t?.status === "RESOLVED").length,
          ticketsPrivate: tickets.filter((t) => t?.isPublic === false).length,
          ticketsPublic: tickets.filter((t) => t?.isPublic === true).length,
          conversationsTotal: conversations.length,
          callsTotal: calls.length,
          callsMissed: calls.filter((c) => c?.status === "missed").length,
          callsRejected: calls.filter((c) => c?.status === "rejected").length,
          callsEnded: calls.filter((c) => c?.status === "ended").length,
          monthlyCategories: labels,
          monthlyActivity: keys.map((k) => monthlyMap.get(k) || 0),
        });
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboardMetrics();
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "STARTUP") {
      setNextPublishedEvent(null);
      return;
    }

    const fetchNextPublishedEvent = async () => {
      setNextEventLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/api/events?all=true&upcoming=true`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        });
        const payload = await response.json();
        const events = Array.isArray(payload?.data) ? payload.data : [];
        setNextPublishedEvent(events[0] || null);
      } catch (error) {
        setNextPublishedEvent(null);
      } finally {
        setNextEventLoading(false);
      }
    };

    fetchNextPublishedEvent();
  }, [user]);

  useEffect(() => {
    const fetchMeetingSchedule = async () => {
      if (!user || user.role !== "STARTUP") {
        setMeetingSchedule([]);
        return;
      }
      try {
        const res = await meetingsAPI.list({ upcoming: true, period: "year" });
        const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
        setMeetingSchedule(
          rows.map((m: any) => ({
            _id: String(m?._id),
            title: String(m?.title || "Meeting"),
            start: m?.start,
            end: m?.end,
            description: m?.description || "",
            meetingType: String(m?.meetingType || "OFFLINE").toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE",
            meetingLink: m?.meetingLink || "",
          }))
        );
      } catch {
        setMeetingSchedule([]);
      }
    };

    fetchMeetingSchedule();
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "STARTUP") {
      setStartupExperts([]);
      setStartupExpertsError("");
      return;
    }

    const fetchStartupExperts = async () => {
      setLoadingStartupExperts(true);
      setStartupExpertsError("");
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/api/chat/users?role=EXPERT`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        });
        const payload = await response.json();
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.message || "Failed to fetch experts");
        }
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setStartupExperts(list);
      } catch (e: any) {
        setStartupExpertsError(e?.message || "Failed to fetch experts");
        setStartupExperts([]);
      } finally {
        setLoadingStartupExperts(false);
      }
    };

    fetchStartupExperts();
  }, [user]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const nextEventDate = useMemo(() => {
    if (!nextPublishedEvent?.start) return null;
    const d = new Date(nextPublishedEvent.start);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [nextPublishedEvent]);

  const nextEventCountdown = useMemo(() => {
    if (!nextEventDate) return null;
    const diffMs = nextEventDate.getTime() - countdownNow;
    if (diffMs <= 0) {
      return { text: "En cours ou imminent", days: 0, hours: 0, minutes: 0 };
    }
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    return { text: `${days}j ${hours}h ${minutes}m`, days, hours, minutes };
  }, [nextEventDate, countdownNow]);

  const nextEventUrgencyPercent = useMemo(() => {
    if (!nextEventDate) return 0;
    const diffMs = nextEventDate.getTime() - countdownNow;
    if (diffMs <= 0) return 100;
    const horizonMs = 1000 * 60 * 60 * 24 * 14;
    const bounded = Math.min(diffMs, horizonMs);
    return Math.max(5, Math.round(((horizonMs - bounded) / horizonMs) * 100));
  }, [nextEventDate, countdownNow]);

  const nextEventDateLabel = useMemo(() => {
    if (!nextEventDate) return "Aucun événement à venir";
    return nextEventDate.toLocaleString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [nextEventDate]);

  const getExpertAvatarUrl = (expert: ExpertUser) => {
    const image = (expert?.avatar || expert?.profilePhoto || "").trim();
    if (!image) return "/assets/img/users/user-49.jpg";
    if (image.startsWith("/data:image/")) return image.slice(1);
    if (image.startsWith("data:") || image.startsWith("http://") || image.startsWith("https://")) return image;
    if (image.startsWith("/uploads/")) return `${API_BASE_URL}${image}`;
    if (image.startsWith("uploads/")) return `${API_BASE_URL}/${image}`;
    if (image.startsWith("/assets/")) return image;
    if (image.startsWith("assets/")) return `/${image}`;
    return `${API_BASE_URL}/uploads/${image}`;
  };

  const getExpertDisplayName = (expert: ExpertUser) => {
    if (expert?.firstName || expert?.lastName) {
      return `${expert?.firstName || ""} ${expert?.lastName || ""}`.trim();
    }
    return expert?.email?.split("@")[0] || "Expert";
  };

  const startupCreatedDate = useMemo(() => {
    const rawDate = (companyProfile as any)?.createdAt || (user as any)?.createdAt;
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [companyProfile, user]);

  const startupBirthdayLabel = useMemo(() => {
    if (!startupCreatedDate) return "Date de creation non disponible";
    return startupCreatedDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [startupCreatedDate]);

  const startupAgeLabel = useMemo(() => {
    if (!startupCreatedDate) return "Age startup indisponible";
    const diffMs = Date.now() - startupCreatedDate.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years} an${years > 1 ? "s" : ""} d'activite`;
    }
    return `${days} jours d'activite`;
  }, [startupCreatedDate]);

  const getEntityId = (value: any) => String(value?._id || value?.id || value?.userId || value || "");

  const getNotificationUserName = (u?: DashboardNotificationUser) => {
    if (!u) return "Unknown";
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return fullName || u.email || "Unknown";
  };

  const getNotificationAvatar = (u?: DashboardNotificationUser) => {
    const raw = String(u?.avatar || u?.profilePhoto || "").trim();
    if (!raw) return "/assets/img/users/user-49.jpg";
    if (raw.startsWith("/data:image/")) return raw.slice(1);
    if (raw.startsWith("data:")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/uploads/")) return `${API_BASE_URL}${raw}`;
    if (raw.startsWith("uploads/")) return `${API_BASE_URL}/${raw}`;
    if (raw.startsWith("/assets/")) return raw;
    if (raw.startsWith("assets/")) return `/${raw}`;
    return raw;
  };

  const formatDashboardNotificationTime = (dateLike?: string) => {
    if (!dateLike) return "";
    const parsed = new Date(dateLike);
    if (Number.isNaN(parsed.getTime())) return "";
    const diffMins = Math.floor((Date.now() - parsed.getTime()) / 60000);
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

  useEffect(() => {
    const fetchDashboardNotifications = async () => {
      if (!isStartupSession || !user) {
        setDashboardNotifications([]);
        return;
      }

      const currentUserId = String((user as any)?.id || (user as any)?._id || (user as any)?.userId || "");
      if (!currentUserId) {
        setDashboardNotifications([]);
        return;
      }

      setLoadingDashboardNotifications(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setDashboardNotifications([]);
          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        const [inboxRes, conversationsRes, callHistoryRes] = await Promise.all([
          emailsAPI.getInbox(""),
          fetch(`${API_BASE_URL}/api/chat/conversations`, { headers }),
          fetch(`${API_BASE_URL}/api/voice-calls/history?page=1&limit=20`, { headers }),
        ]);

        const inboxList = Array.isArray(inboxRes?.data?.data) ? inboxRes.data.data : [];
        const emailNotifs: DashboardNotificationItem[] = inboxList.map((mail: any) => ({
          _id: `email-${mail?._id}`,
          source: "email",
          user: mail?.senderId,
          title: `${getNotificationUserName(mail?.senderId)} sent you an email`,
          description: mail?.subject || "(No Subject)",
          createdAt: mail?.createdAt,
          isRead: !!mail?.isRead,
          targetRoute: routes.email,
        }));

        const convJson = conversationsRes.ok ? await conversationsRes.json() : { data: [] };
        const conversations = Array.isArray(convJson?.data) ? convJson.data : [];
        const chatNotifs: DashboardNotificationItem[] = conversations
          .map((conv: any) => {
            const unreadCountEntry = Array.isArray(conv?.unreadCount)
              ? conv.unreadCount.find((entry: any) => getEntityId(entry?.userId) === currentUserId)
              : null;
            const unreadMessages = Number(unreadCountEntry?.count || 0);
            if (unreadMessages <= 0) return null;
            const otherParticipant = (conv?.participants || [])
              .map((p: any) => p?.userId)
              .find((u: any) => getEntityId(u) !== currentUserId);
            return {
              _id: `chat-${conv?._id}`,
              source: "chat" as const,
              user: otherParticipant,
              title: `${getNotificationUserName(otherParticipant)} sent you ${unreadMessages} message${
                unreadMessages > 1 ? "s" : ""
              }`,
              description: conv?.lastMessage?.content || "New message received",
              createdAt: conv?.lastMessage?.timestamp || conv?.updatedAt,
              isRead: false,
              targetRoute: routes.chat,
            };
          })
          .filter(Boolean) as DashboardNotificationItem[];

        const historyJson = callHistoryRes.ok ? await callHistoryRes.json() : { data: { calls: [] } };
        const historyCalls = Array.isArray(historyJson?.data?.calls) ? historyJson.data.calls : [];
        const callNotifs: DashboardNotificationItem[] = historyCalls
          .filter((call: any) => getEntityId(call?.receiverId) === currentUserId)
          .map((call: any) => {
            const caller = call?.callerId;
            const status = String(call?.status || "").toLowerCase();
            const titlePrefix = status === "missed" ? "Missed call from" : "Incoming call from";
            return {
              _id: `call-${call?._id}`,
              source: "call" as const,
              user: caller,
              title: `${titlePrefix} ${getNotificationUserName(caller)}`,
              description: call?.callType === "video" ? "Video call" : "Voice call",
              createdAt: call?.createdAt,
              isRead: status !== "missed",
              targetRoute: routes.callHistory,
            };
          });

        const merged = [...emailNotifs, ...chatNotifs, ...callNotifs]
          .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
          .slice(0, 5);

        setDashboardNotifications(merged);
      } catch {
        setDashboardNotifications([]);
      } finally {
        setLoadingDashboardNotifications(false);
      }
    };

    fetchDashboardNotifications();
  }, [isStartupSession, routes.callHistory, routes.chat, routes.email, user]);

  const startupHealthSignals = useMemo(() => {
    const ticketsTotal = Math.max(1, dashboardMetrics.ticketsTotal);
    const resolvedRate = Math.round((dashboardMetrics.ticketsResolved / ticketsTotal) * 100);
    const publicRate = Math.round((dashboardMetrics.ticketsPublic / ticketsTotal) * 100);
    const privateLoad = Math.round((dashboardMetrics.ticketsPrivate / ticketsTotal) * 100);
    const engagement = Math.min(100, dashboardMetrics.conversationsTotal * 12 + dashboardMetrics.callsTotal * 8);
    const completion = profileCompletion;

    const getTrendMeta = (value: number, target: number, lowerIsBetter = false) => {
      const diff = lowerIsBetter ? target - value : value - target;
      if (diff >= 8) {
        return { label: `+${diff}%`, badgeClass: "bg-success-transparent text-success", icon: "ti ti-trending-up" };
      }
      if (diff <= -8) {
        return { label: `${diff}%`, badgeClass: "bg-danger-transparent text-danger", icon: "ti ti-trending-down" };
      }
      return { label: "Stable", badgeClass: "bg-secondary-transparent text-muted", icon: "ti ti-minus" };
    };

    return [
      {
        label: "Profile completion",
        updated: `${completion}%`,
        value: completion,
        color: "border-primary",
        iconClass: "ti ti-id-badge-2 text-primary",
        trend: getTrendMeta(completion, 70),
      },
      {
        label: "Resolution efficiency",
        updated: `${resolvedRate}%`,
        value: resolvedRate,
        color: "border-success",
        iconClass: "ti ti-circle-check text-success",
        trend: getTrendMeta(resolvedRate, 60),
      },
      {
        label: "Public visibility",
        updated: `${publicRate}%`,
        value: publicRate,
        color: "border-info",
        iconClass: "ti ti-world text-info",
        trend: getTrendMeta(publicRate, 50),
      },
      {
        label: "Private ticket load",
        updated: `${privateLoad}%`,
        value: privateLoad,
        color: "border-warning",
        iconClass: "ti ti-lock text-warning",
        trend: getTrendMeta(privateLoad, 25, true),
      },
      {
        label: "Engagement level",
        updated: `${engagement}%`,
        value: engagement,
        color: "border-dark",
        iconClass: "ti ti-message-dots text-dark",
        trend: getTrendMeta(engagement, 55),
      },
    ];
  }, [dashboardMetrics, profileCompletion]);

  const startupInitiatives = useMemo(() => {
    const ticketsTotal = Math.max(1, dashboardMetrics.ticketsTotal);
    const resolvedRate = Math.round((dashboardMetrics.ticketsResolved / ticketsTotal) * 100);
    const publicRate = Math.round((dashboardMetrics.ticketsPublic / ticketsTotal) * 100);
    const engagementBase = Math.max(1, dashboardMetrics.conversationsTotal + dashboardMetrics.callsTotal);
    const callsRate = Math.round((dashboardMetrics.callsTotal / engagementBase) * 100);

    return [
      {
        title: "Ticket Resolution Sprint",
        subtitle: `${dashboardMetrics.ticketsResolved}/${dashboardMetrics.ticketsTotal} resolved`,
        percent: resolvedRate,
        tone: resolvedRate >= 60 ? "bg-success" : resolvedRate >= 35 ? "bg-warning" : "bg-danger",
      },
      {
        title: "Public Support Visibility",
        subtitle: `${dashboardMetrics.ticketsPublic} public tickets`,
        percent: publicRate,
        tone: publicRate >= 60 ? "bg-success" : publicRate >= 35 ? "bg-warning" : "bg-danger",
      },
      {
        title: "Engagement Coverage",
        subtitle: `${dashboardMetrics.conversationsTotal} chats / ${dashboardMetrics.callsTotal} calls`,
        percent: callsRate,
        tone: callsRate >= 45 ? "bg-info" : "bg-primary",
      },
    ];
  }, [dashboardMetrics]);

  const startupActionQueue = useMemo(() => {
    return [
      {
        title: "Resolve pending support tickets",
        detail: `${dashboardMetrics.ticketsOpen + dashboardMetrics.ticketsInProgress} tickets still active`,
        state: dashboardMetrics.ticketsOpen + dashboardMetrics.ticketsInProgress > 0 ? "high" : "done",
      },
      {
        title: "Publish or update next milestone",
        detail: nextPublishedEvent?.title ? `Next: ${nextPublishedEvent.title}` : "No upcoming milestone in calendar",
        state: nextPublishedEvent ? "planned" : "high",
      },
      {
        title: "Increase expert collaboration",
        detail: `${dashboardMetrics.conversationsTotal} conversations, ${dashboardMetrics.callsTotal} calls`,
        state: dashboardMetrics.conversationsTotal > 0 || dashboardMetrics.callsTotal > 0 ? "planned" : "medium",
      },
      {
        title: "Complete startup profile",
        detail: `Current completion: ${profileCompletion}%`,
        state: profileCompletion >= 80 ? "done" : profileCompletion >= 50 ? "medium" : "high",
      },
    ];
  }, [dashboardMetrics, nextPublishedEvent, profileCompletion]);

  const filteredMeetingSchedule = useMemo(() => {
    const now = new Date();
    const isSameDay = (d: Date) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const filtered = meetingSchedule.filter((meeting) => {
      const d = meeting?.start ? new Date(meeting.start) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      if (meetingFilter === "today") return isSameDay(d);
      if (meetingFilter === "month") {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      return d.getFullYear() === now.getFullYear();
    });

    return filtered
      .sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime())
      .slice(0, 6);
  }, [meetingFilter, meetingSchedule]);

  const formatMeetingTime = (dateLike?: string) => {
    if (!dateLike) return "";
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const meetingDotClass = (idx: number) => {
    const colors = ["text-primary", "text-secondary", "text-warning", "text-success", "text-info", "text-danger"];
    return colors[idx % colors.length];
  };

  //New Chart
  const leavesChart = useMemo<any>(() => {
    const seriesData = [
      dashboardMetrics.ticketsOpen,
      dashboardMetrics.ticketsInProgress,
      dashboardMetrics.ticketsResolved,
      dashboardMetrics.ticketsPrivate,
      dashboardMetrics.conversationsTotal,
    ];
    const safeSeries = seriesData.every((v) => v === 0) ? [1, 0, 0, 0, 0] : seriesData;
    return {
    chart: {
      height: 165,
      type: 'donut',
      toolbar: {
        show: false,
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '50%'
      },
    },
    dataLabels: {
      enabled: false
    },

    series: safeSeries,
    colors: ['#F26522', '#FFC107', '#E70D0D', '#03C95A', '#0C4B5E'],
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 200
        },
        legend: {
          show: false
        }
      }
    }],
    legend: {
      show: false
    }
  }}, [dashboardMetrics]);

  const performance_chart2 = useMemo<any>(() => ({
    series: [{
      name: "Startup activity",
      data: dashboardMetrics.monthlyActivity.length > 0 ? dashboardMetrics.monthlyActivity : [0, 0, 0, 0, 0, 0, 0]
    }],
    chart: {
      height: 288,
      type: 'area',
      zoom: {
        enabled: false
      }
    },
    colors: ['#03C95A'],
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'straight'
    },
    title: {
      text: '',
      align: 'left'
    },
    xaxis: {
      categories: dashboardMetrics.monthlyCategories.length > 0
        ? dashboardMetrics.monthlyCategories
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    },
    yaxis: {
      min: 0,
      max: Math.max(10, ...dashboardMetrics.monthlyActivity, 10),
      tickAmount: 5,
      labels: {
        formatter: (val: number) => {
          return `${Math.round(val)}`
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left'
    }
  }), [dashboardMetrics.monthlyActivity, dashboardMetrics.monthlyCategories]);

  const employeename = [
    { value: "Select", label: "Select" },
    { value: "Anthony Lewis", label: "Anthony Lewis" },
    { value: "Brian Villalobos", label: "Brian Villalobos" },
    { value: "Harvey Smith", label: "Harvey Smith" },
  ];
  const leaveType = [
    { value: "Select", label: "Select" },
    { value: "Medical Leave", label: "Medical Leave" },
    { value: "Casual Leave", label: "Casual Leave" },
    { value: "Annual Leave", label: "Annual Leave" },
  ];

  const getModalContainer = () => {
    const modalElement = document.getElementById('modal-datepicker');
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };




  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Employee Dashboard</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Dashboard</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Employee Dashboard
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
              <div className="input-icon w-120 position-relative mb-2">
                <span className="input-icon-addon">
                  <i className="ti ti-calendar text-gray-9" />
                </span>
                <Calendar value={date} onChange={(e: any) => setDate(e.value)} view="year" dateFormat="yy" className="Calendar-form" />
              </div>
              <div className="ms-2 head-icons">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}
          <div className="alert bg-secondary-transparent alert-dismissible fade show mb-4">
            Your Leave Request on"24th April 2024"has been Approved!!!
            <button
              type="button"
              className="btn-close fs-14"
              data-bs-dismiss="alert"
              aria-label="Close"
            >
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="row">
            <div className="col-xl-4 d-flex">
              <div className="card position-relative flex-fill user-profile-card">
                <div className="card-header bg-dark">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-lg avatar-rounded border border-white border-2 flex-shrink-0 me-2">
                      {userLoading ? (
                        <div className="d-flex align-items-center justify-content-center bg-light rounded-circle" style={{ width: '60px', height: '60px' }}>
                          <div className="spinner-border spinner-border-sm text-white" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        </div>
                      ) : isStartupSession && startupLogoUrl ? (
                        <img
                          src={startupLogoUrl}
                          alt="Startup Logo"
                          className="img-fluid rounded-circle w-100 h-100 object-fit-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/assets/img/users/user-01.jpg";
                          }}
                        />
                      ) : user?.avatar ? (
                        <ImageWithBasePath src={user.avatar} alt="User Avatar" />
                      ) : (
                        <ImageWithBasePath src="assets/img/users/user-01.jpg" alt="Default Avatar" />
                      )}
                    </span>
                    <div>
                      <h5 className="text-white mb-1">
                        {userLoading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-8"></span>
                          </div>
                        ) : isStartupSession ? (
                          startupDisplayName
                        ) : user ? (
                          `${user.firstName} ${user.lastName}`
                        ) : (
                          'User Not Found'
                        )}
                      </h5>
                      <div className="d-flex align-items-center">
                        <div className="text-white fs-12 mb-0">
                          {userLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-6"></span>
                            </div>
                          ) : isStartupSession ? (
                            companyProfile?.activityDomain || "Activity not set"
                          ) : user?.position ? (
                            user.position
                          ) : (
                            'Position Not Set'
                          )}
                        </div>
                        <span className="mx-1">
                          <i className="ti ti-point-filled text-primary" />
                        </span>
                        <div className="fs-12">
                          {userLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-4"></span>
                            </div>
                          ) : isStartupSession ? (
                            companyProfile?.projectProgress || "Progress not set"
                          ) : user?.department ? (
                            user.department
                          ) : (
                            'Department Not Set'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={isStartupSession ? routes.profile : "#"}
                    className="btn btn-icon btn-sm text-white rounded-circle edit-top"
                    title="Edit Profile"
                  >
                    <i className="ti ti-edit" />
                  </Link>
                </div>
                <div className="card-body">
                  {isStartupSession ? (
                    <>
                      <div className="mb-3">
                        <span className="d-block mb-1 fs-13">Founder</span>
                        <div className="text-gray-9">{companyProfile?.founderName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Not set"}</div>
                      </div>
                      <div className="mb-3">
                        <span className="d-block mb-1 fs-13">Contact Email</span>
                        <div className="text-gray-9">{companyProfile?.email || user?.email || "Not available"}</div>
                      </div>
                      <div className="mb-3">
                        <span className="d-block mb-1 fs-13">Profile Completion</span>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <small className="text-gray-7">Startup profile quality</small>
                          <small className="fw-semibold text-dark">{profileCompletion}%</small>
                        </div>
                        <div className="progress" style={{ height: "8px" }}>
                          <div
                            className={`progress-bar ${profileCompletion >= 70 ? "bg-success" : profileCompletion >= 40 ? "bg-warning" : "bg-danger"}`}
                            role="progressbar"
                            style={{ width: `${profileCompletion}%` }}
                            aria-valuenow={profileCompletion}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <div className="border rounded p-2">
                            <span className="d-block fs-11 text-gray-6">Tickets</span>
                            <span className="fw-semibold text-dark">{dashboardMetrics.ticketsTotal}</span>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="border rounded p-2">
                            <span className="d-block fs-11 text-gray-6">Resolved</span>
                            <span className="fw-semibold text-dark">{dashboardMetrics.ticketsResolved}</span>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="border rounded p-2">
                            <span className="d-block fs-11 text-gray-6">Chats</span>
                            <span className="fw-semibold text-dark">{dashboardMetrics.conversationsTotal}</span>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="border rounded p-2">
                            <span className="d-block fs-11 text-gray-6">Calls</span>
                            <span className="fw-semibold text-dark">{dashboardMetrics.callsTotal}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-light rounded p-2 mb-3">
                        <span className="d-block fs-12 text-gray-6 mb-1">Next calendar event</span>
                        <div className="fw-medium text-dark text-truncate">{nextPublishedEvent?.title || "No upcoming event"}</div>
                        <small className="text-gray-7 d-block">{nextEventDateLabel}</small>
                      </div>
                      <div className="d-flex gap-2">
                        <Link to={routes.profile} className="btn btn-outline-primary btn-sm w-50">
                          Startup Profile
                        </Link>
                        <Link to={routes.calendar} className="btn btn-primary btn-sm w-50">
                          Open Calendar
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-3">
                        <span className="d-block mb-1 fs-13">Phone Number</span>
                        <div className="text-gray-9">
                          {userLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-6"></span>
                            </div>
                          ) : user?.phone ? (
                            user.phone
                          ) : (
                            'Phone Not Set'
                          )}
                        </div>
                      </div>
                      <div className="mb-3">
                        <span className="d-block mb-1 fs-13">Email Address</span>
                        <div className="text-gray-9">
                          {userLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-8"></span>
                            </div>
                          ) : user?.email ? (
                            user.email
                          ) : (
                            'Email Not Available'
                          )}
                        </div>
                      </div>
                      <div className="mb-3">
                        <span className="d-block mb-1 fs-13">Department</span>
                        <div className="text-gray-9">
                          {userLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-5"></span>
                            </div>
                          ) : user?.department ? (
                            user.department
                          ) : (
                            'Department Not Set'
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="d-block mb-1 fs-13">Joined on</span>
                        <div className="text-gray-9">
                          {userLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-4"></span>
                            </div>
                          ) : user?.hireDate ? (
                            new Date(user.hireDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          ) : (
                            'Date Not Set'
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {userError && (
                    <div className="alert alert-danger mt-3" role="alert">
                      <i className="ti ti-alert-circle me-2"></i>
                      Error loading user data: {userError}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Startup Operations Overview</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        2024
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2024
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2023
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2022
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row align-items-center">
                    <div className="col-md-6">
                      <div className="mb-4">
                        <div className="mb-3">
                          <p className="d-flex align-items-center">
                            <i className="ti ti-circle-filled fs-8 text-dark me-1" />
                            <span className="text-gray-9 fw-semibold me-1">
                              {dashboardMetrics.ticketsOpen}
                            </span>
                            Open Tickets
                          </p>
                        </div>
                        <div className="mb-3">
                          <p className="d-flex align-items-center">
                            <i className="ti ti-circle-filled fs-8 text-success me-1" />
                            <span className="text-gray-9 fw-semibold me-1">{dashboardMetrics.ticketsInProgress}</span>
                            In Progress / Pending
                          </p>
                        </div>
                        <div className="mb-3">
                          <p className="d-flex align-items-center">
                            <i className="ti ti-circle-filled fs-8 text-primary me-1" />
                            <span className="text-gray-9 fw-semibold me-1">
                              {dashboardMetrics.ticketsResolved}
                            </span>
                            Resolved Tickets
                          </p>
                        </div>
                        <div className="mb-3">
                          <p className="d-flex align-items-center">
                            <i className="ti ti-circle-filled fs-8 text-danger me-1" />
                            <span className="text-gray-9 fw-semibold me-1">{dashboardMetrics.ticketsPrivate}</span>
                            Private Tickets
                          </p>
                        </div>
                        <div>
                          <p className="d-flex align-items-center">
                            <i className="ti ti-circle-filled fs-8 text-warning me-1" />
                            <span className="text-gray-9 fw-semibold me-1">{dashboardMetrics.conversationsTotal}</span>
                            Chat Conversations
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-4 d-flex justify-content-md-end">
                        <ReactApexChart
                          id="leaves_chart"
                          options={leavesChart}
                          series={leavesChart.series}
                          type="donut"
                          height={165}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="form-check mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="todo1"
                        />
                        <label className="form-check-label" htmlFor="todo1">
                          Startup profile completion: <span className="text-gray-9">{profileCompletion}%</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-3 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Startup KPI Snapshot</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        2024
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2024
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2023
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2022
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row align-items-center">
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="d-block mb-1">Total Tickets</span>
                        <h4>
                          {dashboardLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-2"></span>
                            </div>
                          ) : (
                            dashboardMetrics.ticketsTotal
                          )}
                        </h4>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="d-block mb-1">Resolved</span>
                        <h4>
                          {dashboardLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-2"></span>
                            </div>
                          ) : (
                            dashboardMetrics.ticketsResolved
                          )}
                        </h4>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="d-block mb-1">Public</span>
                        <h4>
                          {dashboardLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-2"></span>
                            </div>
                          ) : (
                            dashboardMetrics.ticketsPublic
                          )}
                        </h4>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="d-block mb-1">Private</span>
                        <h4>
                          {dashboardLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-3"></span>
                            </div>
                          ) : (
                            dashboardMetrics.ticketsPrivate
                          )}
                        </h4>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="d-block mb-1">Conversations</span>
                        <h4>
                          {dashboardLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-3"></span>
                            </div>
                          ) : (
                            dashboardMetrics.conversationsTotal
                          )}
                        </h4>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="d-block mb-1">Calls</span>
                        <h4>
                          {dashboardLoading ? (
                            <div className="placeholder-glow">
                              <span className="placeholder col-3"></span>
                            </div>
                          ) : (
                            dashboardMetrics.callsTotal
                          )}
                        </h4>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div>
                        <Link
                          to="#"
                          className="btn btn-dark w-100"
                          data-bs-toggle="modal" data-inert={true}
                          data-bs-target="#add_leaves"
                        >
                          Open Ticket Workspace
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill border-primary attendance-bg">
                <div className="card-body">
                  <div className="mb-4 text-center">
                    <h6 className="fw-medium text-gray-5 mb-1">Prochain événement Calendar</h6>
                    <h4>{nextEventLoading ? "Chargement..." : nextEventDateLabel}</h4>
                  </div>
                  <CircleProgress
                    value={nextEventUrgencyPercent}
                    title="Temps restant"
                    subtitle={nextEventCountdown?.text || "--"}
                  />
                  <div className="text-center">
                    <div className="badge badge-dark badge-md mb-3">
                      {nextPublishedEvent?.title || "Aucun événement publié"}
                    </div>
                    <h6 className="fw-medium d-flex align-items-center justify-content-center mb-4">
                      <i className="ti ti-map-pin text-primary me-1" />
                      {nextPublishedEvent?.location || "Lieu non spécifié"}
                    </h6>
                    <Link to={routes.calendar} className="btn btn-primary w-100">
                      Voir Calendar
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-8 d-flex">
              <div className="row flex-fill">
                <div className="col-xl-3 col-md-6">
                  <div className="card">
                    <div className="card-body">
                      <div className="border-bottom mb-3 pb-2">
                        <span className="avatar avatar-sm bg-primary mb-2">
                          <i className="ti ti-clock-stop" />
                        </span>
                        <h2 className="mb-2">
                          8.36 / <span className="fs-20 text-gray-5"> 9</span>
                        </h2>
                        <p className="fw-medium text-truncate">Total Hours Today</p>
                      </div>
                      <div>
                        <p className="d-flex align-items-center fs-13">
                          <span className="avatar avatar-xs rounded-circle bg-success flex-shrink-0 me-2">
                            <i className="ti ti-arrow-up fs-12" />
                          </span>
                          <span>5% This Week</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-xl-3 col-md-6">
                  <div className="card">
                    <div className="card-body">
                      <div className="border-bottom mb-3 pb-2">
                        <span className="avatar avatar-sm bg-dark mb-2">
                          <i className="ti ti-clock-up" />
                        </span>
                        <h2 className="mb-2">
                          10 / <span className="fs-20 text-gray-5"> 40</span>
                        </h2>
                        <p className="fw-medium text-truncate">Total Hours Week</p>
                      </div>
                      <div>
                        <p className="d-flex align-items-center fs-13">
                          <span className="avatar avatar-xs rounded-circle bg-success flex-shrink-0 me-2">
                            <i className="ti ti-arrow-up fs-12" />
                          </span>
                          <span>7% Last Week</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-xl-3 col-md-6">
                  <div className="card">
                    <div className="card-body">
                      <div className="border-bottom mb-3 pb-2">
                        <span className="avatar avatar-sm bg-info mb-2">
                          <i className="ti ti-calendar-up" />
                        </span>
                        <h2 className="mb-2">
                          75 / <span className="fs-20 text-gray-5"> 98</span>
                        </h2>
                        <p className="fw-medium text-truncate">Total Hours Month</p>
                      </div>
                      <div>
                        <p className="d-flex align-items-center fs-13 text-truncate">
                          <span className="avatar avatar-xs rounded-circle bg-danger flex-shrink-0 me-2">
                            <i className="ti ti-arrow-down fs-12" />
                          </span>
                          <span>8% Last Month</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-xl-3 col-md-6">
                  <div className="card">
                    <div className="card-body">
                      <div className="border-bottom mb-3 pb-2">
                        <span className="avatar avatar-sm bg-pink mb-2">
                          <i className="ti ti-calendar-star" />
                        </span>
                        <h2 className="mb-2">
                          16 / <span className="fs-20 text-gray-5"> 28</span>
                        </h2>
                        <p className="fw-medium text-truncate">
                          Overtime this Month
                        </p>
                      </div>
                      <div>
                        <p className="d-flex align-items-center fs-13 text-truncate">
                          <span className="avatar avatar-xs rounded-circle bg-danger flex-shrink-0 me-2">
                            <i className="ti ti-arrow-down fs-12" />
                          </span>
                          <span>6% Last Month</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-12">
                  <div className="card">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-xl-3">
                          <div className="mb-4">
                            <p className="d-flex align-items-center mb-1">
                              <i className="ti ti-point-filled text-dark-transparent me-1" />
                              Total Working hours
                            </p>
                            <h3>12h 36m</h3>
                          </div>
                        </div>
                        <div className="col-xl-3">
                          <div className="mb-4">
                            <p className="d-flex align-items-center mb-1">
                              <i className="ti ti-point-filled text-success me-1" />
                              Productive Hours
                            </p>
                            <h3>08h 36m</h3>
                          </div>
                        </div>
                        <div className="col-xl-3">
                          <div className="mb-4">
                            <p className="d-flex align-items-center mb-1">
                              <i className="ti ti-point-filled text-warning me-1" />
                              Break hours
                            </p>
                            <h3>22m 15s</h3>
                          </div>
                        </div>
                        <div className="col-xl-3">
                          <div className="mb-4">
                            <p className="d-flex align-items-center mb-1">
                              <i className="ti ti-point-filled text-info me-1" />
                              Overtime
                            </p>
                            <h3>02h 15m</h3>
                          </div>
                        </div>
                      </div>
                      <div className="row">
                        <div className="col-md-12">
                          <div
                            className="progress bg-transparent-dark mb-3"
                            style={{ height: 24 }}
                          >
                            <div
                              className="progress-bar bg-white rounded"
                              role="progressbar"
                              style={{ width: "18%" }}
                            />
                            <div
                              className="progress-bar bg-success rounded me-2"
                              role="progressbar"
                              style={{ width: "18%" }}
                            />
                            <div
                              className="progress-bar bg-warning rounded me-2"
                              role="progressbar"
                              style={{ width: "5%" }}
                            />
                            <div
                              className="progress-bar bg-success rounded me-2"
                              role="progressbar"
                              style={{ width: "28%" }}
                            />
                            <div
                              className="progress-bar bg-warning rounded me-2"
                              role="progressbar"
                              style={{ width: "17%" }}
                            />
                            <div
                              className="progress-bar bg-success rounded me-2"
                              role="progressbar"
                              style={{ width: "22%" }}
                            />
                            <div
                              className="progress-bar bg-warning rounded me-2"
                              role="progressbar"
                              style={{ width: "5%" }}
                            />
                            <div
                              className="progress-bar bg-info rounded me-2"
                              role="progressbar"
                              style={{ width: "3%" }}
                            />
                            <div
                              className="progress-bar bg-info rounded"
                              role="progressbar"
                              style={{ width: "2%" }}
                            />
                            <div
                              className="progress-bar bg-white rounded"
                              role="progressbar"
                              style={{ width: "18%" }}
                            />
                          </div>
                        </div>
                        <div className="co-md-12">
                          <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                            <span className="fs-10">06:00</span>
                            <span className="fs-10">07:00</span>
                            <span className="fs-10">08:00</span>
                            <span className="fs-10">09:00</span>
                            <span className="fs-10">10:00</span>
                            <span className="fs-10">11:00</span>
                            <span className="fs-10">12:00</span>
                            <span className="fs-10">01:00</span>
                            <span className="fs-10">02:00</span>
                            <span className="fs-10">03:00</span>
                            <span className="fs-10">04:00</span>
                            <span className="fs-10">05:00</span>
                            <span className="fs-10">06:00</span>
                            <span className="fs-10">07:00</span>
                            <span className="fs-10">08:00</span>
                            <span className="fs-10">09:00</span>
                            <span className="fs-10">10:00</span>
                            <span className="fs-10">11:00</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isStartupSession && (
            <div className="row">
              <div className="col-xl-6 d-flex">
                <div className="card flex-fill">
                  <div className="card-header">
                    <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                      <h5>Startup Initiatives</h5>
                      <span className="badge bg-primary-transparent">Dynamic</span>
                    </div>
                  </div>
                  <div className="card-body">
                    {startupInitiatives.map((item) => (
                      <div className="border rounded p-3 mb-3" key={item.title}>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="mb-0">{item.title}</h6>
                          <span className="fw-semibold">{item.percent}%</span>
                        </div>
                        <p className="text-gray-7 mb-2 fs-13">{item.subtitle}</p>
                        <div className="progress" style={{ height: 8 }}>
                          <div className={`progress-bar ${item.tone}`} role="progressbar" style={{ width: `${item.percent}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="d-flex gap-2">
                      <Link to={routes.tickets} className="btn btn-outline-primary btn-sm w-50">
                        Open Tickets
                      </Link>
                      <Link to={routes.chat} className="btn btn-primary btn-sm w-50">
                        Open Chat
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-xl-6 d-flex">
                <div className="card flex-fill">
                  <div className="card-header">
                    <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                      <h5>Startup Action Queue</h5>
                      <Link to={routes.calendar} className="btn btn-white border btn-sm">
                        Calendar
                      </Link>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="list-group list-group-flush">
                      {startupActionQueue.map((task) => {
                        const badgeClass =
                          task.state === "done"
                            ? "badge-soft-success"
                            : task.state === "planned"
                            ? "bg-transparent-purple"
                            : task.state === "medium"
                            ? "bg-soft-pink"
                            : "badge-secondary-transparent";
                        const badgeText =
                          task.state === "done"
                            ? "Done"
                            : task.state === "planned"
                            ? "Planned"
                            : task.state === "medium"
                            ? "Medium"
                            : "High";
                        return (
                          <div className="list-group-item border rounded mb-3 p-3" key={task.title}>
                            <div className="d-flex align-items-start justify-content-between gap-3">
                              <div>
                                <h6 className="mb-1">{task.title}</h6>
                                <p className="mb-0 text-gray-7 fs-13">{task.detail}</p>
                              </div>
                              <span className={`badge d-inline-flex align-items-center ${badgeClass}`}>{badgeText}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="bg-light rounded p-2">
                      <small className="text-gray-7 d-block">Next event countdown</small>
                      <span className="fw-semibold">{nextEventCountdown?.text || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isStartupSession && (
          <div className="row">
            <div className="col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Projects</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border-0 dropdown-toggle border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        Ongoing Projects
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            All Projects
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            Ongoing Projects
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card mb-4 shadow-none mb-md-0">
                        <div className="card-body">
                          <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6>Office Management</h6>
                            <div className="dropdown">
                              <Link
                                to="#"
                                className="d-inline-flex align-items-center"
                                data-bs-toggle="dropdown"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <ul className="dropdown-menu dropdown-menu-end p-3">
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                    data-bs-toggle="modal" data-inert={true}
                                    data-bs-target="#edit_task"
                                  >
                                    <i className="ti ti-edit me-2" />
                                    Edit
                                  </Link>
                                </li>
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                    data-bs-toggle="modal" data-inert={true}
                                    data-bs-target="#delete_modal"
                                  >
                                    <i className="ti ti-trash me-2" />
                                    Delete
                                  </Link>
                                </li>
                              </ul>
                            </div>
                          </div>
                          <div>
                            <div className="d-flex align-items-center mb-3">
                              <Link to="#" className="avatar">
                                <ImageWithBasePath
                                  src="assets/img/users/user-32.jpg"
                                  className="img-fluid rounded-circle"
                                  alt="img"
                                />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-normal">
                                  <Link to="#">Anthony Lewis</Link>
                                </h6>
                                <span className="fs-13 d-block">
                                  Project Leader
                                </span>
                              </div>
                            </div>
                            <div className="d-flex align-items-center mb-3">
                              <Link
                                to="#"
                                className="avatar bg-soft-primary rounded-circle"
                              >
                                <i className="ti ti-calendar text-primary fs-16" />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-normal">14/01/2024</h6>
                                <span className="fs-13 d-block">Deadline</span>
                              </div>
                            </div>
                            <div className="d-flex align-items-center justify-content-between bg-transparent-light border border-dashed rounded p-2 mb-3">
                              <div className="d-flex align-items-center">
                                <span className="avatar avatar-sm bg-success-transparent rounded-circle me-1">
                                  <i className="ti ti-checklist fs-16" />
                                </span>
                                <p>
                                  Tasks : <span className="text-gray-9">6 </span>{" "}
                                  /10
                                </p>
                              </div>
                              <div className="avatar-list-stacked avatar-group-sm">
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-06.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-07.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-08.jpg"
                                    alt="img"
                                  />
                                </span>
                                <Link
                                  className="avatar bg-primary avatar-rounded text-fixed-white fs-12 fw-medium"
                                  to="#"
                                >
                                  +2
                                </Link>
                              </div>
                            </div>
                            <div className="bg-soft-secondary p-2 rounded d-flex align-items-center justify-content-between">
                              <p className="text-secondary mb-0 text-truncate">
                                Time Spent
                              </p>
                              <h5 className="text-secondary text-truncate">
                                65/120 <span className="fs-14 fw-normal">Hrs</span>
                              </h5>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card shadow-none mb-0">
                        <div className="card-body">
                          <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6>Office Management</h6>
                            <div className="dropdown">
                              <Link
                                to="#"
                                className="d-inline-flex align-items-center"
                                data-bs-toggle="dropdown"
                              >
                                <i className="ti ti-dots-vertical" />
                              </Link>
                              <ul className="dropdown-menu dropdown-menu-end p-3">
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                    data-bs-toggle="modal" data-inert={true}
                                    data-bs-target="#edit_task"
                                  >
                                    <i className="ti ti-edit me-2" />
                                    Edit
                                  </Link>
                                </li>
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                    data-bs-toggle="modal" data-inert={true}
                                    data-bs-target="#delete_modal"
                                  >
                                    <i className="ti ti-trash me-2" />
                                    Delete
                                  </Link>
                                </li>
                              </ul>
                            </div>
                          </div>
                          <div>
                            <div className="d-flex align-items-center mb-3">
                              <Link to="#" className="avatar">
                                <ImageWithBasePath
                                  src="assets/img/users/user-33.jpg"
                                  className="img-fluid rounded-circle"
                                  alt="img"
                                />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-normal">
                                  <Link to="#">Anthony Lewis</Link>
                                </h6>
                                <span className="fs-13 d-block">
                                  Project Leader
                                </span>
                              </div>
                            </div>
                            <div className="d-flex align-items-center mb-3">
                              <Link
                                to="#"
                                className="avatar bg-soft-primary rounded-circle"
                              >
                                <i className="ti ti-calendar text-primary fs-16" />
                              </Link>
                              <div className="ms-2">
                                <h6 className="fw-normal">14/01/2024</h6>
                                <span className="fs-13 d-block">Deadline</span>
                              </div>
                            </div>
                            <div className="d-flex align-items-center justify-content-between bg-transparent-light border border-dashed rounded p-2 mb-3">
                              <div className="d-flex align-items-center">
                                <span className="avatar avatar-sm bg-success-transparent rounded-circle me-1">
                                  <i className="ti ti-checklist fs-16" />
                                </span>
                                <p>
                                  Tasks : <span className="text-gray-9">6 </span>{" "}
                                  /10
                                </p>
                              </div>
                              <div className="avatar-list-stacked avatar-group-sm">
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-06.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-07.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-08.jpg"
                                    alt="img"
                                  />
                                </span>
                                <Link
                                  className="avatar bg-primary avatar-rounded text-fixed-white fs-12 fw-medium"
                                  to="#"
                                >
                                  +2
                                </Link>
                              </div>
                            </div>
                            <div className="bg-soft-secondary p-2 rounded d-flex align-items-center justify-content-between">
                              <p className="text-secondary mb-0 text-truncate">
                                Time Spent
                              </p>
                              <h5 className="text-secondary text-truncate">
                                65/120 <span className="fs-14 fw-normal">Hrs</span>
                              </h5>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Tasks</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border-0 dropdown-toggle border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        All Projects
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            All Projects
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            Ongoing Projects
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="list-group list-group-flush">
                    <div className="list-group-item border rounded mb-3 p-2">
                      <div className="row align-items-center row-gap-3">
                        <div className="col-md-8">
                          <div className="todo-inbox-check d-flex align-items-center">
                            <span>
                              <i className="ti ti-grid-dots me-2" />
                            </span>
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" />
                            </div>
                            <span className="me-2 d-flex align-items-center rating-select">
                              <i className="ti ti-star-filled filled" />
                            </span>
                            <div className="strike-info">
                              <h4 className="fs-14 text-truncate">
                                Patient appointment booking
                              </h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-md-end flex-wrap row-gap-3">
                            <span className="badge bg-soft-pink d-inline-flex align-items-center me-2">
                              <i className="fas fa-circle fs-6 me-1" />
                              Onhold
                            </span>
                            <div className="d-flex align-items-center">
                              <div className="avatar-list-stacked avatar-group-sm">
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-13.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-14.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-15.jpg"
                                    alt="img"
                                  />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="list-group-item border rounded mb-3 p-2">
                      <div className="row align-items-center row-gap-3">
                        <div className="col-md-8">
                          <div className="todo-inbox-check d-flex align-items-center">
                            <span>
                              <i className="ti ti-grid-dots me-2" />
                            </span>
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" />
                            </div>
                            <span className="me-2 rating-select d-flex align-items-center">
                              <i className="ti ti-star" />
                            </span>
                            <div className="strike-info">
                              <h4 className="fs-14 text-truncate">
                                Appointment booking with payment
                              </h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-md-end flex-wrap row-gap-3">
                            <span className="badge bg-transparent-purple d-flex align-items-center me-2">
                              <i className="fas fa-circle fs-6 me-1" />
                              Inprogress
                            </span>
                            <div className="d-flex align-items-center">
                              <div className="avatar-list-stacked avatar-group-sm">
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-20.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-21.jpg"
                                    alt="img"
                                  />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="list-group-item border rounded mb-3 p-2">
                      <div className="row align-items-center row-gap-3">
                        <div className="col-md-8">
                          <div className="todo-inbox-check d-flex align-items-center">
                            <span>
                              <i className="ti ti-grid-dots me-2" />
                            </span>
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" />
                            </div>
                            <span className="me-2 rating-select d-flex align-items-center">
                              <i className="ti ti-star" />
                            </span>
                            <div className="strike-info">
                              <h4 className="fs-14 text-truncate">
                                Patient and Doctor video conferencing
                              </h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-md-end flex-wrap row-gap-3">
                            <span className="badge badge-soft-success align-items-center me-2">
                              <i className="fas fa-circle fs-6 me-1" />
                              Completed
                            </span>
                            <div className="d-flex align-items-center">
                              <div className="avatar-list-stacked avatar-group-sm">
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-28.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-29.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-24.jpg"
                                    alt="img"
                                  />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="list-group-item border rounded mb-3 p-2">
                      <div className="row align-items-center row-gap-3">
                        <div className="col-md-8">
                          <div className="todo-inbox-check d-flex align-items-center todo-strike-content">
                            <span>
                              <i className="ti ti-grid-dots me-2" />
                            </span>
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                              // defaultChecked=""
                              />
                            </div>
                            <span className="me-2 rating-select d-flex align-items-center">
                              <i className="ti ti-star" />
                            </span>
                            <div className="strike-info">
                              <h4 className="fs-14 text-truncate">
                                Private chat module
                              </h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-md-end flex-wrap row-gap-3">
                            <span className="badge badge-secondary-transparent d-flex align-items-center me-2">
                              <i className="fas fa-circle fs-6 me-1" />
                              Pending
                            </span>
                            <div className="d-flex align-items-center">
                              <div className="avatar-list-stacked avatar-group-sm">
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-23.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-24.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-25.jpg"
                                    alt="img"
                                  />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="list-group-item border rounded p-2">
                      <div className="row align-items-center row-gap-3">
                        <div className="col-md-8">
                          <div className="todo-inbox-check d-flex align-items-center">
                            <span>
                              <i className="ti ti-grid-dots me-2" />
                            </span>
                            <div className="form-check">
                              <input className="form-check-input" type="checkbox" />
                            </div>
                            <span className="me-2 rating-select d-flex align-items-center">
                              <i className="ti ti-star" />
                            </span>
                            <div className="strike-info">
                              <h4 className="fs-14 text-truncate">
                                Go-Live and Post-Implementation Support
                              </h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-md-end flex-wrap row-gap-3">
                            <span className="badge bg-transparent-purple d-flex align-items-center me-2">
                              <i className="fas fa-circle fs-6 me-1" />
                              Inprogress
                            </span>
                            <div className="d-flex align-items-center">
                              <div className="avatar-list-stacked avatar-group-sm">
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-28.jpg"
                                    alt="img"
                                  />
                                </span>
                                <span className="avatar avatar-rounded">
                                  <ImageWithBasePath
                                    className="border border-white"
                                    src="assets/img/profiles/avatar-29.jpg"
                                    alt="img"
                                  />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
          <div className="row">
            <div className="col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Global Startup Activity</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        2024
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2024
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2023
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2022
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div>
                    <div className="bg-light d-flex align-items-center rounded p-2">
                      <h3 className="me-2">
                        {dashboardLoading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-3"></span>
                          </div>
                        ) : (
                          `${globalScore}%`
                        )}
                      </h3>
                      <span className="badge badge-outline-success bg-success-transparent rounded-pill me-1">
                        {dashboardLoading ? (
                          <div className="placeholder-glow">
                            <span className="placeholder col-2"></span>
                          </div>
                        ) : (
                          `${activityDelta >= 0 ? "+" : ""}${activityDelta}%`
                        )}
                      </span>
                      <span>vs previous month activity</span>
                    </div>
                    <ReactApexChart
                      id="performance_chart2"
                      options={performance_chart2}
                      series={performance_chart2.series}
                      type="area"
                      height={288}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>{isStartupSession ? "Startup Health Signals" : "My Skills"}</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        2024
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2024
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2023
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="#"
                            className="dropdown-item rounded-1"
                          >
                            2022
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {isStartupSession ? (
                    <div>
                      {startupHealthSignals.map((signal, index) => (
                        <div
                          key={signal.label}
                          className={`border border-dashed bg-transparent-light rounded p-2 ${index < startupHealthSignals.length - 1 ? "mb-2" : ""}`}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                              <span className={`d-block border border-2 h-12 ${signal.color} rounded-5 me-2`} />
                              <div>
                                <h6 className="fw-medium mb-1 d-flex align-items-center">
                                  <i className={`${signal.iconClass} me-1`} />
                                  {signal.label}
                                </h6>
                                <p className="mb-0">Current: {signal.updated}</p>
                                <small className={`badge ${signal.trend.badgeClass} mt-1`}>
                                  <i className={`${signal.trend.icon} me-1`} />
                                  {signal.trend.label}
                                </small>
                              </div>
                            </div>
                            <CircleProgressSmall value={signal.value} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="border border-dashed bg-transparent-light rounded p-2 mb-2">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <span className="d-block border border-2 h-12 border-primary rounded-5 me-2" />
                            <div>
                              <h6 className="fw-medium mb-1">Figma</h6>
                              <p>Updated : 15 May 2025</p>
                            </div>
                          </div>
                          <CircleProgressSmall value={95} />
                        </div>
                      </div>
                      <div className="border border-dashed bg-transparent-light rounded p-2 mb-2">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <span className="d-block border border-2 h-12 border-success rounded-5 me-2" />
                            <div>
                              <h6 className="fw-medium mb-1">HTML</h6>
                              <p>Updated : 12 May 2025</p>
                            </div>
                          </div>
                          <CircleProgressSmall value={85} />
                        </div>
                      </div>
                      <div className="border border-dashed bg-transparent-light rounded p-2 mb-2">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <span className="d-block border border-2 h-12 border-purple rounded-5 me-2" />
                            <div>
                              <h6 className="fw-medium mb-1">CSS</h6>
                              <p>Updated : 12 May 2025</p>
                            </div>
                          </div>
                          <CircleProgressSmall value={70} />
                        </div>
                      </div>
                      <div className="border border-dashed bg-transparent-light rounded p-2 mb-2">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <span className="d-block border border-2 h-12 border-info rounded-5 me-2" />
                            <div>
                              <h6 className="fw-medium mb-1">Wordpress</h6>
                              <p>Updated : 15 May 2025</p>
                            </div>
                          </div>
                          <CircleProgressSmall value={61} />
                        </div>
                      </div>
                      <div className="border border-dashed bg-transparent-light rounded p-2">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <span className="d-block border border-2 h-12 border-dark rounded-5 me-2" />
                            <div>
                              <h6 className="fw-medium mb-1">Javascript</h6>
                              <p>Updated : 13 May 2025</p>
                            </div>
                          </div>
                          <CircleProgressSmall value={58} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-xl-3 d-flex">
              <div className="flex-fill">
                <div className="card card-bg-5 bg-dark mb-3">
                  <div className="card-body">
                    <div className="text-center">
                      <h5 className="text-white mb-4">{isStartupSession ? "Startup Birthday" : "Team Birthday"}</h5>
                      <span className="avatar avatar-xl avatar-rounded mb-2">
                        {isStartupSession && startupLogoUrl ? (
                          <img
                            src={startupLogoUrl}
                            alt="Startup Logo"
                            className="img-fluid rounded-circle w-100 h-100 object-fit-cover"
                            onError={(e) => {
                              e.currentTarget.src = "/assets/img/users/user-35.jpg";
                            }}
                          />
                        ) : (
                          <ImageWithBasePath src="assets/img/users/user-35.jpg" alt="Img" />
                        )}
                      </span>
                      <div className="mb-3">
                        <h6 className="text-white fw-medium mb-1">{isStartupSession ? startupDisplayName : "Andrew Jermia"}</h6>
                        <p>{isStartupSession ? `Created on ${startupBirthdayLabel}` : "IOS Developer"}</p>
                      </div>
                      <Link to={isStartupSession ? routes.profile : "#"} className="btn btn-sm btn-primary">
                        {isStartupSession ? "View Startup Profile" : "Send Wishes"}
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card bg-secondary mb-3">
                  <div className="card-body d-flex align-items-center justify-content-between p-3">
                    <div>
                      <h5 className="text-white mb-1">{isStartupSession ? "Startup Journey" : "Leave Policy"}</h5>
                      <p className="text-white">{isStartupSession ? startupAgeLabel : "Last Updated : Today"}</p>
                    </div>
                    <Link to={isStartupSession ? routes.profile : "#"} className="btn btn-white btn-sm px-3">
                      {isStartupSession ? "Profile" : "View All"}
                    </Link>
                  </div>
                </div>
                <div className="card bg-warning">
                  <div className="card-body d-flex align-items-center justify-content-between p-3">
                    <div>
                      <h5 className="mb-1">{isStartupSession ? "Next Calendar Event" : "Next Holiday"}</h5>
                      <p className="text-gray-9">{isStartupSession ? nextEventDateLabel : "Diwali, 15 Sep 2025"}</p>
                    </div>
                    <Link to={isStartupSession ? routes.calendar : "holidays.html"} className="btn btn-white btn-sm px-3">
                      {isStartupSession ? "Open" : "View All"}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap">
                    <h5>{isStartupSession ? "Experts" : "Team Members"}</h5>
                    <div>
                      <Link to={isStartupSession ? routes.expertsList : "#"} className="btn btn-light btn-sm">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {isStartupSession ? (
                    <>
                      {loadingStartupExperts && (
                        <div className="text-center py-3 text-muted">Loading experts...</div>
                      )}
                      {!loadingStartupExperts && startupExpertsError && (
                        <div className="alert alert-danger py-2 mb-0">{startupExpertsError}</div>
                      )}
                      {!loadingStartupExperts && !startupExpertsError && startupExperts.length === 0 && (
                        <div className="text-center py-3 text-muted">No experts available.</div>
                      )}
                      {!loadingStartupExperts && !startupExpertsError && startupExperts.slice(0, 6).map((expert, index) => (
                        <div
                          className={`d-flex align-items-center justify-content-between ${index < Math.min(startupExperts.length, 6) - 1 ? "mb-4" : ""}`}
                          key={expert._id}
                        >
                          <div className="d-flex align-items-center">
                            <Link
                              to={routes.expertProfile.replace(":expertId", expert._id)}
                              className="avatar flex-shrink-0"
                            >
                              <img
                                src={getExpertAvatarUrl(expert)}
                                className="rounded-circle border border-2 w-100 h-100 object-fit-cover"
                                alt="expert"
                                onError={(e) => {
                                  e.currentTarget.src = "/assets/img/users/user-49.jpg";
                                }}
                              />
                            </Link>
                            <div className="ms-2">
                              <h6 className="fs-14 fw-medium text-truncate mb-1">
                                <Link to={routes.expertProfile.replace(":expertId", expert._id)}>
                                  {getExpertDisplayName(expert)}
                                </Link>
                              </h6>
                              <p className="fs-13">{expert.position || expert.country || "Expert"}</p>
                            </div>
                          </div>
                          <div className="d-flex align-items-center">
                            <a
                              href={expert.phone ? `tel:${expert.phone}` : "#"}
                              className={`btn btn-light btn-icon btn-sm me-2${expert.phone ? "" : " disabled"}`}
                              aria-disabled={!expert.phone}
                              onClick={(e) => {
                                if (!expert.phone) e.preventDefault();
                              }}
                            >
                              <i className="ti ti-phone fs-16" />
                            </a>
                            <a
                              href={expert.email ? `mailto:${expert.email}` : "#"}
                              className={`btn btn-light btn-icon btn-sm me-2${expert.email ? "" : " disabled"}`}
                              aria-disabled={!expert.email}
                              onClick={(e) => {
                                if (!expert.email) e.preventDefault();
                              }}
                            >
                              <i className="ti ti-mail-bolt fs-16" />
                            </a>
                            <Link
                              to={routes.chat}
                              className="btn btn-light btn-icon btn-sm"
                              onClick={() => {
                                sessionStorage.setItem("selectedChatUser", JSON.stringify(expert));
                              }}
                            >
                              <i className="ti ti-brand-hipchat fs-16" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link
                        to="#"
                        className="avatar flex-shrink-0"
                      >
                        <ImageWithBasePath
                          src="assets/img/users/user-27.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Alexander Jermai</Link>
                        </h6>
                        <p className="fs-13">UI/UX Designer</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-phone fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link
                        to="#"
                        className="avatar flex-shrink-0"
                      >
                        <ImageWithBasePath
                          src="assets/img/users/user-42.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Doglas Martini</Link>
                        </h6>
                        <p className="fs-13">Product Designer</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-phone fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#"
                        className="avatar flex-shrink-0"
                      >
                        <ImageWithBasePath
                          src="assets/img/users/user-43.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Daniel Esbella</Link>
                        </h6>
                        <p className="fs-13">Project Manager</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-phone fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#"
                        className="avatar flex-shrink-0"
                      >
                        <ImageWithBasePath
                          src="assets/img/users/user-11.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Daniel Esbella</Link>
                        </h6>
                        <p className="fs-13">Team Lead</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-phone fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#"
                        className="avatar flex-shrink-0"
                      >
                        <ImageWithBasePath
                          src="assets/img/users/user-44.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Stephan Peralt</Link>
                        </h6>
                        <p className="fs-13">Team Lead</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-phone fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <Link to="#"
                        className="avatar flex-shrink-0"
                      >
                        <ImageWithBasePath
                          src="assets/img/users/user-54.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Andrew Jermia</Link>
                        </h6>
                        <p className="fs-13">Project Lead</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-phone fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm me-2">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap">
                    <h5>Notifications</h5>
                    <div>
                      <Link to={routes.notifications} className="btn btn-light btn-sm">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {loadingDashboardNotifications ? (
                    <p className="text-muted mb-0">Loading notifications...</p>
                  ) : dashboardNotifications.length === 0 ? (
                    <p className="text-muted mb-0">No notifications yet.</p>
                  ) : (
                    dashboardNotifications.map((item, idx) => (
                      <div
                        className={`d-flex align-items-start ${idx < dashboardNotifications.length - 1 ? "mb-4" : ""}`}
                        key={item._id}
                      >
                        <Link to={item.targetRoute} className="avatar flex-shrink-0">
                          <img
                            src={getNotificationAvatar(item.user)}
                            className="rounded-circle border border-2"
                            alt="notification-user"
                            onError={(ev) => {
                              ev.currentTarget.src = "/assets/img/users/user-49.jpg";
                            }}
                          />
                        </Link>
                        <div className="ms-2 flex-fill">
                          <div className="d-flex align-items-start justify-content-between gap-2">
                            <h6 className="fs-14 fw-medium text-truncate mb-1">{item.title}</h6>
                            {!item.isRead && (
                              <span className="badge bg-primary-transparent text-primary flex-shrink-0">New</span>
                            )}
                          </div>
                          <p className="fs-13 mb-1">{formatDashboardNotificationTime(item.createdAt)}</p>
                          {!!item.description && (
                            <p className="fs-12 text-muted mb-0 text-truncate">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Meetings Schedule</h5>
                    <div className="dropdown">
                      <Link to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        {meetingFilter === "today" ? "Today" : meetingFilter === "month" ? "This Month" : "This Year"}
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <button
                            type="button"
                            className="dropdown-item rounded-1"
                            onClick={() => setMeetingFilter("today")}
                          >
                            Today
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className="dropdown-item rounded-1"
                            onClick={() => setMeetingFilter("month")}
                          >
                            This Month
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className="dropdown-item rounded-1"
                            onClick={() => setMeetingFilter("year")}
                          >
                            This Year
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body schedule-timeline">
                  {nextEventLoading ? (
                    <p className="text-muted mb-0">Loading meetings...</p>
                  ) : filteredMeetingSchedule.length === 0 ? (
                    <div>
                      <p className="text-muted mb-2">No meetings for this period.</p>
                      <Link to={routes.meetingsPlanner} className="btn btn-primary btn-sm">
                        Plan a meeting
                      </Link>
                    </div>
                  ) : (
                    <>
                      {filteredMeetingSchedule.map((meeting, idx) => (
                        <div className="d-flex align-items-start" key={meeting._id}>
                          <div className="d-flex align-items-center active-time">
                            <span>{formatMeetingTime(meeting.start)}</span>
                            <span>
                              <i className={`ti ti-point-filled ${meetingDotClass(idx)} fs-20`} />
                            </span>
                          </div>
                          <div
                            className={`flex-fill ps-3 timeline-flow ${
                              idx < filteredMeetingSchedule.length - 1 ? "pb-4" : ""
                            }`}
                          >
                            <div className="bg-light p-2 rounded">
                              <p className="fw-medium text-gray-9 mb-1">{meeting.title}</p>
                              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                <span>{meeting.meetingType === "ONLINE" ? "Online Meeting" : "Offline Meeting"}</span>
                                {meeting.meetingLink && (
                                  <a
                                    href={meeting.meetingLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-outline-primary btn-sm"
                                  >
                                    Join
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="mt-3">
                        <Link to={routes.meetingsPlanner} className="btn btn-light btn-sm">
                          Open meetings planner
                        </Link>
                      </div>
                    </>
                  )}
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
      <>
        {/* Add Leaves */}
        <div className="modal fade" id="add_leaves">
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Leave</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form>
                <div className="modal-body pb-0">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Employee Name</label>
                        <CommonSelect
                          className="select"
                          options={employeename}
                          defaultValue={employeename[0]}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Leave Type</label>
                        <CommonSelect
                          className="select"
                          options={leaveType}
                          defaultValue={leaveType[0]}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">From </label>
                        <div className="input-icon-end position-relative">
                          <DatePicker
                            className="form-control datetimepicker"
                            format={{
                              format: "DD-MM-YYYY",
                              type: "mask",
                            }}
                            getPopupContainer={getModalContainer}
                            placeholder="DD-MM-YYYY"
                          />
                          <span className="input-icon-addon">
                            <i className="ti ti-calendar text-gray-7" />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">To </label>
                        <div className="input-icon-end position-relative">
                          <DatePicker
                            className="form-control datetimepicker"
                            format={{
                              format: "DD-MM-YYYY",
                              type: "mask",
                            }}
                            getPopupContainer={getModalContainer}
                            placeholder="DD-MM-YYYY"
                          />
                          <span className="input-icon-addon">
                            <i className="ti ti-calendar text-gray-7" />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">No of Days</label>
                        <input type="text" className="form-control" />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Remaining Days</label>
                        <input type="text" className="form-control" />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Reason</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          defaultValue={""}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Leaves
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Add Leaves */}
      </>
    </>


  );
};

export default EmployeeDashboard;



