import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  setDataLayout,
} from "../../data/redux/themeSettingSlice";
import ImageWithBasePath from "../imageWithBasePath";
import {
  setMobileSidebar,
  toggleMiniSidebar,
} from "../../data/redux/sidebarSlice";
import { all_routes } from "../../../feature-module/router/all_routes";
import { HorizontalSidebarData } from '../../data/json/horizontalSidebar'
import { searchCompanies } from "../../../services/searchService";
import { useAuth } from "../../../contexts/AuthContext";
import companyProfileService from "../../../services/companyProfileService";
import { API_BASE_URL, emailsAPI } from "../../../services/apiService";
import "./search.css";

type NotificationUser = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  profilePhoto?: string;
};

type StartupProfileMeta = {
  userId: string;
  companyName?: string;
  logo?: string;
};

type NotificationSource = "email" | "chat" | "call";

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

const Header = () => {
  const Location = useLocation();
  const navigate = useNavigate();
  const routes = all_routes;
  const { user, signout } = useAuth();
  const resolvedProfileImage = user?.avatar || user?.profilePhoto || "";
  
  // Add state for company profile
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  
  // Debug: log user data
  useEffect(() => {
    console.log('Header - Current user:', user);
    if (user) {
      console.log('Header - User avatar:', user.avatar);
      console.log('Header - User profilePhoto:', user.profilePhoto);
      if (resolvedProfileImage) {
        const imageUrl = getProfileImageUrl(resolvedProfileImage);
        console.log('Final image URL:', imageUrl);
        console.log('Full URL with base path:', `${window.location.origin}/${imageUrl}`);
      }
    }
  }, [user, resolvedProfileImage]);

  // Fetch company profile for STARTUP users
  useEffect(() => {
    const fetchCompanyProfile = async () => {
      if (user?.role === 'STARTUP' && user?.id) {
        try {
          const response = await companyProfileService.getCompanyProfile(user.id);
          if (response.success) {
            setCompanyProfile(response.data);
            console.log('Header - Company profile loaded:', response.data);
          }
        } catch (error) {
          console.error('Error fetching company profile:', error);
        }
      }
    };

    fetchCompanyProfile();
  }, [user]);
  const [subOpen, setSubOpen] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [seenCallIds, setSeenCallIds] = useState<string[]>([]);
  const [startupProfiles, setStartupProfiles] = useState<Record<string, StartupProfileMeta>>({});
  const isNotificationsEnabled =
    user?.role === "STARTUP" || user?.role === "EXPERT" || user?.role === "S2T";
  const currentUserId = String((user as any)?.id || (user as any)?._id || (user as any)?.userId || "");
  const seenCallsStorageKey = `seen_call_notifications_${currentUserId}`;

  // Handle search input changes
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.length >= 2) {
      setIsSearching(true);
      try {
        const response = await searchCompanies(value);
        if (response.success) {
          setSearchResults(response.data);
          setShowSearchResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle search result click
  const handleSearchResultClick = (companyId: string) => {
    setShowSearchResults(false);
    setSearchTerm("");
    // Navigate to company detail page
    window.location.href = `/company-detail-dashboard/${companyId}`;
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const dispatch = useDispatch();
  const dataLayout = useSelector((state: any) => state.themeSetting.dataLayout);

  const toggleSidebar = (title: any) => {
	localStorage.setItem("menuOpened", title);
	if (title === subOpen) {
	  setSubOpen("");
	} else {
	  setSubOpen(title);
	}
  };

  const toggleSubsidebar = (subitem: any) => {
	if (subitem === subOpen) {
	  setSubOpen("");
	} else {
	  setSubOpen(subitem);
	}
  };
  const mobileSidebar = useSelector(
    (state: any) => state.sidebarSlice.mobileSidebar
  );

  const toggleMobileSidebar = () => {
    dispatch(setMobileSidebar(!mobileSidebar));
  };


  const handleToggleMiniSidebar = () => {
    if (dataLayout === "mini_layout") {
      dispatch(setDataLayout("default_layout"));
      localStorage.setItem("dataLayout", "default_layout");
    } else {
      dispatch(toggleMiniSidebar());
    }
  };




  // Handle logout
  const handleLogout = async () => {
    await signout();
    navigate(routes.login, { replace: true });
  };

  // Helper function to validate and repair data URLs
  const validateDataUrl = (dataUrl: string): string | null => {
    try {
      if (!dataUrl || typeof dataUrl !== 'string') {
        return null;
      }

      if (!dataUrl.startsWith('data:image/')) {
        console.error('Invalid data URL format:', dataUrl.substring(0, 50));
        return null;
      }

      const base64Part = dataUrl.split(',')[1];
      if (!base64Part || base64Part.length < 100) {
        console.error('Data URL seems truncated:', dataUrl.length, 'characters');
        return null;
      }

      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(base64Part)) {
        console.error('Invalid base64 in data URL');
        return null;
      }

      return dataUrl;
    } catch (error) {
      console.error('Error validating data URL:', error);
      return null;
    }
  };

  // Helper function to get correct profile image URL
  const getProfileImageUrl = (imagePath: string | undefined) => {
    // Debug: log the input
    console.log('getProfileImageUrl input:', imagePath);
    console.log('User object:', user);
    console.log('Company profile:', companyProfile);
    
    // For STARTUP users, prioritize company logo
    if (user?.role === 'STARTUP' && companyProfile?.logo) {
      console.log('Using startup logo:', companyProfile.logo);
      console.log('Logo type:', typeof companyProfile.logo);
      console.log('Logo length:', companyProfile.logo?.length);
      console.log('Logo starts with data:', companyProfile.logo?.startsWith('data:'));
      
      // If logo is base64, validate and return
      if (companyProfile.logo.startsWith('data:')) {
        console.log('Validating base64 data URL...');
        const validatedUrl = validateDataUrl(companyProfile.logo);
        if (validatedUrl) {
          console.log('Returning validated base64 data URL');
          return validatedUrl;
        } else {
          console.error('Base64 data URL validation failed, using default avatar');
          return "assets/img/profiles/avatar-12.jpg";
        }
      }
      // If logo is a file path, construct full URL
      if (companyProfile.logo.startsWith('/uploads/')) {
        const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const fullUrl = `${backendUrl}${companyProfile.logo}`;
        console.log('Backend URL for startup logo:', fullUrl);
        return fullUrl;
      }
      return companyProfile.logo;
    }
    
    // If no image path provided, return default avatar
    if (!imagePath || imagePath.trim() === '') {
      console.log('No image path, using default avatar');
      return "assets/img/profiles/avatar-12.jpg";
    }
    
    // If it's already a full URL (starts with http), return as is
    if (imagePath.startsWith('http')) {
      console.log('Full URL detected:', imagePath);
      return imagePath;
    }
    
    // For uploaded files, use the full backend URL
    if (imagePath.startsWith('/uploads/')) {
      const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const fullUrl = `${backendUrl}${imagePath}`;
      console.log('Backend URL for uploads:', fullUrl);
      return fullUrl;
    }
    
    // If it's a local path starting with /, remove the leading slash for ImageWithBasePath
    if (imagePath.startsWith('/')) {
      const pathWithoutSlash = imagePath.substring(1);
      console.log('Path with leading slash, removing it:', pathWithoutSlash);
      return pathWithoutSlash;
    }
    
    // For uploaded files, construct the full path to the backend uploads directory
    if (imagePath.includes('uploads/')) {
      // If it already contains the uploads path, use it as is
      console.log('Uploads path detected:', imagePath);
      return imagePath;
    } else {
      // If it's just a filename, assume it's in the profiles uploads directory
      const fullPath = `uploads/profiles/${imagePath}`;
      console.log('Constructed uploads path:', fullPath);
      return fullPath;
    }
  };

  const getEntityId = (value: any) =>
    String(value?._id || value?.id || value?.userId || value || "");

  const getStartupMetaForUser = (u?: NotificationUser) => {
    const id = getEntityId(u);
    if (!id) return null;
    return startupProfiles[id] || null;
  };

  const getNotificationDisplayName = (u?: NotificationUser) => {
    const startupMeta = getStartupMetaForUser(u);
    if (startupMeta?.companyName) return startupMeta.companyName;
    if (!u) return "Unknown";
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return fullName || u.email || "Unknown";
  };

  const getNotificationAvatar = (u?: NotificationUser) => {
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

  const formatNotificationTime = (dateLike?: string) => {
    if (!dateLike) return "";
    const parsed = new Date(dateLike);
    const time = parsed.getTime();
    if (Number.isNaN(time)) return "";
    const diffMs = Date.now() - time;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins <= 0) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return parsed.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resolveObjectId = (value: any) => String(value?._id || value?.id || value?.userId || value || "");

  const loadStartupProfiles = async () => {
    try {
      const res = await companyProfileService.getAllCompanyProfiles();
      const list = Array.isArray(res?.data) ? res.data : [];
      const nextMap: Record<string, StartupProfileMeta> = {};
      list.forEach((p: any) => {
        const uid = getEntityId(p?.userId);
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
    if (!isNotificationsEnabled || !currentUserId) {
      setNotificationItems([]);
      setUnreadNotificationsCount(0);
      return;
    }
    setLoadingNotifications(true);
    setNotificationsError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setNotificationItems([]);
        setUnreadNotificationsCount(0);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [inboxRes, conversationsRes, callHistoryRes, activeCallsRes] = await Promise.all([
        emailsAPI.getInbox(""),
        fetch(`${API_BASE_URL}/api/chat/conversations`, { headers }),
        fetch(`${API_BASE_URL}/api/voice-calls/history?page=1&limit=20`, { headers }),
        fetch(`${API_BASE_URL}/api/voice-calls/active`, { headers }),
      ]);

      const inboxList = Array.isArray(inboxRes?.data?.data) ? inboxRes.data.data : [];
      const emailNotifs: NotificationItem[] = inboxList.map((mail: any) => ({
        _id: `email-${mail._id}`,
        source: "email",
        user: mail?.senderId,
        title: `${getNotificationDisplayName(mail?.senderId)} sent you an email`,
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
          const senderName = getNotificationDisplayName(otherParticipant);
          return {
            _id: `chat-${conv?._id}`,
            source: "chat" as const,
            user: otherParticipant,
            title: `${senderName} sent you ${unreadMessages} message${unreadMessages > 1 ? "s" : ""}`,
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
            title: `${statusLabel} from ${getNotificationDisplayName(caller)}`,
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
          title: `Incoming call from ${getNotificationDisplayName(call?.callerId)}`,
          description: call?.callType === "video" ? "Video call is ringing" : "Voice call is ringing",
          createdAt: call?.createdAt,
          isRead: seenCallIds.includes(String(call?._id)),
          targetRoute: routes.chat,
          callId: call?._id,
        }));

      const combined = [...emailNotifs, ...chatNotifs, ...historyCallNotifs, ...activeIncomingNotifs]
        .sort((a, b) => {
          const aTime = new Date(a?.createdAt || 0).getTime();
          const bTime = new Date(b?.createdAt || 0).getTime();
          return bTime - aTime;
        });

      setNotificationItems(combined.slice(0, 8));
      setUnreadNotificationsCount(combined.filter((n) => !n.isRead).length);
    } catch (error: any) {
      setNotificationItems([]);
      setUnreadNotificationsCount(0);
      setNotificationsError(
        error?.response?.data?.message || "Unable to load notifications"
      );
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markNotificationAsRead = async (notification?: NotificationItem) => {
    if (!notification) return;
    try {
      if (notification.source === "email" && notification.emailId) {
        await emailsAPI.markAsRead(notification.emailId);
      } else if (notification.source === "chat" && notification.conversationId) {
        await markConversationAsRead(notification.conversationId);
      } else if (notification.source === "call" && notification.callId) {
        markCallSeen(notification.callId);
      }

      setNotificationItems((prev) =>
        prev.map((item) => (item._id === notification._id ? { ...item, isRead: true } : item))
      );
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const markAllNotificationsAsRead = async () => {
    const unreadItems = notificationItems.filter((item) => !item?.isRead);
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
      setNotificationItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadNotificationsCount(0);
      loadNotifications();
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadSeenCalls();
  }, [currentUserId]);

  useEffect(() => {
    if (!isNotificationsEnabled) return;
    loadStartupProfiles();
    loadNotifications();
    const intervalId = window.setInterval(() => {
      loadNotifications();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [isNotificationsEnabled, currentUserId, seenCallIds.length]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const displayName =
    user?.role === "STARTUP"
      ? companyProfile?.companyName || user?.username || "Startup"
      : user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username || user?.email?.split("@")[0] || "User";
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
        });
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch((err) => {
          });
        }
        setIsFullscreen(false);
      }
    }
  };

  return (
    <>
      {/* Header */}
      <div className="header">
			<div className="main-header">

				<div className="header-left">
					<Link to={routes.adminDashboard} className="logo">
						<ImageWithBasePath src="assets/img/logo.svg" alt="Logo"/>
					</Link>
					<Link to={routes.adminDashboard} className="dark-logo">
						<ImageWithBasePath src="assets/img/logo-white.svg" alt="Logo"/>
					</Link>
				</div>

				<Link id="mobile_btn" onClick={toggleMobileSidebar} className="mobile_btn" to="#sidebar">
					<span className="bar-icon">
						<span></span>
						<span></span>
						<span></span>
					</span>
				</Link>

				<div className="header-user">
					<div className="nav user-menu nav-list">

						<div className="me-auto d-flex align-items-center" id="header-search">
							<Link id="toggle_btn" to="#" onClick={handleToggleMiniSidebar} className="btn btn-menubar me-1">
								<i className="ti ti-arrow-bar-to-left"></i>
							</Link>
							<div className="input-group input-group-flat d-inline-flex me-1 position-relative" ref={searchRef}>
								<span className="input-icon-addon">
									<i className="ti ti-search"></i>
								</span>
								<input 
									type="text" 
									className="form-control" 
									placeholder="Search companies by name or domain..." 
									value={searchTerm}
									onChange={handleSearchChange}
									onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
								/>
								<span className="input-group-text">
									<kbd>CTRL + / </kbd>
								</span>
								
								{/* Search Results Dropdown */}
								{showSearchResults && (
									<div className="search-results-dropdown">
										<div className="search-results-header">
											<h6 className="mb-0">Search Results</h6>
											{isSearching && <small className="text-muted">Searching...</small>}
										</div>
										<div className="search-results-body">
											{searchResults.length > 0 ? (
												searchResults.map((company, index) => (
													<div 
														key={index} 
														className="search-result-item"
														onClick={() => handleSearchResultClick(company._id)}
													>
														<div className="search-result-content">
															<div className="company-name">{company.companyName}</div>
															<div className="company-details">
																<span className="founder">{company.founderName}</span>
																<span className="domain">{company.activityDomain}</span>
																<span className={`status badge bg-${company.requestStatus === 'APPROVED' ? 'success' : company.requestStatus === 'REJECTED' ? 'danger' : 'warning'}`}>
																	{company.requestStatus}
																</span>
															</div>
														</div>
														<i className="ti ti-arrow-right"></i>
													</div>
												))
											) : (
												<div className="no-results">
													<i className="ti ti-search"></i>
													<p>No companies found</p>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
							<div className="dropdown crm-dropdown">
								<Link to="#" className="btn btn-menubar me-1" data-bs-toggle="dropdown">
									<i className="ti ti-layout-grid"></i>
								</Link>
								<div className="dropdown-menu dropdown-lg dropdown-menu-start">
									<div className="card mb-0 border-0 shadow-none">
										<div className="card-header">
											<h4>CRM</h4>
										</div>
										<div className="card-body pb-1">		
											<div className="row">
												<div className="col-sm-6">							
													<Link to={routes.contactList} className="d-flex align-items-center justify-content-between p-2 crm-link mb-3">
														<span className="d-flex align-items-center me-3">
															<i className="ti ti-user-shield text-default me-2"></i>Contacts
														</span>
														<i className="ti ti-arrow-right"></i>
													</Link>							
													<Link to={routes.dealsGrid} className="d-flex align-items-center justify-content-between p-2 crm-link mb-3">
														<span className="d-flex align-items-center me-3">
															<i className="ti ti-heart-handshake text-default me-2"></i>Deals
														</span>
														<i className="ti ti-arrow-right"></i>
													</Link>								
													<Link to={routes.pipeline} className="d-flex align-items-center justify-content-between p-2 crm-link mb-3">
														<span className="d-flex align-items-center me-3">
															<i className="ti ti-timeline-event-text text-default me-2"></i>Pipeline
														</span>
														<i className="ti ti-arrow-right"></i>
													</Link>		
												</div>
												<div className="col-sm-6">							
													<Link to={routes.companiesGrid} className="d-flex align-items-center justify-content-between p-2 crm-link mb-3">
														<span className="d-flex align-items-center me-3">
															<i className="ti ti-building text-default me-2"></i>Companies
														</span>
														<i className="ti ti-arrow-right"></i>
													</Link>								
													<Link to={routes.leadsGrid} className="d-flex align-items-center justify-content-between p-2 crm-link mb-3">
														<span className="d-flex align-items-center me-3">
															<i className="ti ti-user-check text-default me-2"></i>Leads
														</span>
														<i className="ti ti-arrow-right"></i>
													</Link>								
													<Link to={routes.activity} className="d-flex align-items-center justify-content-between p-2 crm-link mb-3">
														<span className="d-flex align-items-center me-3">
															<i className="ti ti-activity text-default me-2"></i>Activities
														</span>
														<i className="ti ti-arrow-right"></i>
													</Link>		
												</div>
											</div>		
										</div>
									</div>
								</div>
							</div>
							<Link to={routes.profilesettings} className="btn btn-menubar">
								<i className="ti ti-settings-cog"></i>
							</Link>	
						</div>

						<div className="sidebar sidebar-horizontal" id="horizontal-single">
							<div className="sidebar-menu">
								<div className="main-menu">
									<ul className="nav-menu">
										<li className="menu-title">
											<span>Main</span>
										</li>
										{HorizontalSidebarData?.map((mainMenu, index) => (
											<React.Fragment key={`main-${index}`}>
												{mainMenu?.menu?.map((data, i) => (
												<li className="submenu" key={`menu-${i}`}>
													<Link to="#" className={`
														${
															data?.subMenus
																?.map((link: any) => link?.route)
																.includes(Location.pathname) 
																? "active"
																: ""
															} ${subOpen === data.menuValue ? "subdrop" : ""}`} onClick={() => toggleSidebar(data.menuValue)}>
													<i className={`ti ti-${data.icon}`}></i>
													<span>{data.menuValue}</span>
													<span className="menu-arrow"></span>
													</Link>

													{/* First-level Submenus */}
													<ul style={{ display: subOpen === data.menuValue ? "block" : "none" }}>
													{data?.subMenus?.map((subMenu:any, j) => (
														<li
														key={`submenu-${j}`}
														className={subMenu?.customSubmenuTwo ? "submenu" : ""}
														>
														<Link to={subMenu?.route || "#"} className={`${
															subMenu?.subMenusTwo
																?.map((link: any) => link?.route)
																.includes(Location.pathname) || subMenu?.route === Location.pathname
																? "active"
																: ""
															} ${subOpen === subMenu.menuValue ? "subdrop" : ""}`} onClick={() => toggleSubsidebar(subMenu.menuValue)}>
															<span>{subMenu?.menuValue}</span>
															{subMenu?.customSubmenuTwo && <span className="menu-arrow"></span>}
														</Link>

														{/* Check if `customSubmenuTwo` exists */}
														{subMenu?.customSubmenuTwo && subMenu?.subMenusTwo && (
															<ul style={{ display: subOpen === subMenu.menuValue ? "block" : "none" }}>
															{subMenu.subMenusTwo.map((subMenuTwo:any, k:number) => (
																<li key={`submenu-two-${k}`}>
																<Link className={subMenuTwo.route === Location.pathname?'active':''} to={subMenuTwo.route}>{subMenuTwo.menuValue}</Link>
																</li>
															))}
															</ul>
														)}
														</li>
													))}
													</ul>
												</li>
												))}
											</React.Fragment>
											))}
									</ul>
								</div>
							</div>
						</div>

						<div className="d-flex align-items-center">
							<div className="me-1">
								<Link to="#" onClick={toggleFullscreen} className="btn btn-menubar btnFullscreen">
									<i className="ti ti-maximize"></i>
								</Link>
							</div>
							<div className="dropdown me-1">
								<Link to="#" className="btn btn-menubar" data-bs-toggle="dropdown">
									<i className="ti ti-layout-grid-remove"></i>
								</Link>
								<div className="dropdown-menu dropdown-menu-end">
									<div className="card mb-0 border-0 shadow-none">
										<div className="card-header">
											<h4>Applications</h4>
										</div>
										<div className="card-body">											
											<Link to={routes.calendar} className="d-block pb-2">
												<span className="avatar avatar-md bg-transparent-dark me-2"><i className="ti ti-calendar text-gray-9"></i></span>Calendar
											</Link>										
											<Link to={routes.todo} className="d-block py-2">
												<span className="avatar avatar-md bg-transparent-dark me-2"><i className="ti ti-subtask text-gray-9"></i></span>To Do
											</Link>										
											{user?.role === "EXPERT" && (
												<Link to={routes.notes} className="d-block py-2">
													<span className="avatar avatar-md bg-transparent-dark me-2"><i className="ti ti-notes text-gray-9"></i></span>Notes
												</Link>
											)}										
											<Link to={routes.fileManager} className="d-block py-2">
												<span className="avatar avatar-md bg-transparent-dark me-2"><i className="ti ti-folder text-gray-9"></i></span>File Manager
											</Link>								
											<Link to={routes.kanbanView} className="d-block py-2">
												<span className="avatar avatar-md bg-transparent-dark me-2"><i className="ti ti-layout-kanban text-gray-9"></i></span>Kanban
											</Link>								
											<Link to={routes.invoice} className="d-block py-2 pb-0">
												<span className="avatar avatar-md bg-transparent-dark me-2"><i className="ti ti-file-invoice text-gray-9"></i></span>Invoices
											</Link>
										</div>
									</div>
								</div>
							</div>
							<div className="me-1">
								<Link to={routes.chat} className="btn btn-menubar position-relative">
									<i className="ti ti-brand-hipchat"></i>
									<span className="badge bg-info rounded-pill d-flex align-items-center justify-content-center header-badge">5</span>
								</Link>
							</div>
							<div className="me-1">
								<Link to={routes.email} className="btn btn-menubar">
									<i className="ti ti-mail"></i>
								</Link>
							</div>
							<div className="me-1 notification_item">
								<Link to="#" className="btn btn-menubar position-relative me-1" id="notification_popup"
									data-bs-toggle="dropdown">
									<i className="ti ti-bell"></i>
									{unreadNotificationsCount > 0 && <span className="notification-status-dot"></span>}
									{unreadNotificationsCount > 0 && (
										<span className="badge bg-danger rounded-pill d-flex align-items-center justify-content-center header-badge">
											{unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
										</span>
									)}
								</Link>
								<div className="dropdown-menu dropdown-menu-end notification-dropdown p-4">
									<div
										className="d-flex align-items-center justify-content-between border-bottom p-0 pb-3 mb-3">
										<h4 className="notification-title">Notifications ({unreadNotificationsCount})</h4>
										<div className="d-flex align-items-center">
											<Link
												to="#"
												className="text-primary fs-15 me-3 lh-1"
												onClick={(e) => {
													e.preventDefault();
													markAllNotificationsAsRead();
												}}
											>
												Mark all as read
											</Link>
											<div className="dropdown">
												<Link to="#" className="bg-white dropdown-toggle"
													data-bs-toggle="dropdown">
													<i className="ti ti-calendar-due me-1"></i>Today
												</Link>
												<ul className="dropdown-menu mt-2 p-3">
													<li>
														<Link to="#" className="dropdown-item rounded-1">
															This Week
														</Link>
													</li>
													<li>
														<Link to="#" className="dropdown-item rounded-1">
															Last Week
														</Link>
													</li>
													<li>
														<Link to="#" className="dropdown-item rounded-1">
															Last Month
														</Link>
													</li>
												</ul>
											</div>
										</div>
									</div>
									<div className="noti-content">
										<div className="d-flex flex-column">
											{loadingNotifications && (
												<div className="border-0 mb-3 pb-0">
													<p className="text-muted mb-0">Loading notifications...</p>
												</div>
											)}
											{!loadingNotifications && notificationsError && (
												<div className="border-0 mb-3 pb-0">
													<p className="text-danger mb-0">{notificationsError}</p>
												</div>
											)}
											{!loadingNotifications &&
												!notificationsError &&
												notificationItems.length === 0 && (
													<div className="border-0 mb-3 pb-0">
														<p className="text-muted mb-0">No notifications.</p>
													</div>
												)}
											{!loadingNotifications &&
												!notificationsError &&
												notificationItems.slice(0, 4).map((item, index) => (
													<div
														className={`${index < Math.min(notificationItems.length, 4) - 1 ? "border-bottom mb-3 pb-3" : "border-0 mb-3 pb-0"}`}
														key={item._id}
													>
														<Link
															to={item.targetRoute}
															onClick={() => {
																if (!item?.isRead) {
																	markNotificationAsRead(item);
																}
															}}
														>
															<div className="d-flex">
																<span className="avatar avatar-lg me-2 flex-shrink-0">
																	<img
																		src={getNotificationAvatar(item?.user)}
																		alt="Profile"
																		className="rounded-circle w-100 h-100 object-fit-cover"
																		onError={(e) => {
																			e.currentTarget.src = "/assets/img/users/user-49.jpg";
																		}}
																	/>
																</span>
																<div className="flex-grow-1">
																	<p className="mb-1">
																		<span className="text-dark fw-semibold">
																			{item.source === "email"
																				? "Email"
																				: item.source === "chat"
																				? "Message"
																				: "Call"}
																		</span>{" "}
																		{item.title}
																	</p>
																	{item.description && (
																		<p className="mb-1 text-muted text-truncate" style={{ maxWidth: 240 }}>
																			{item.description}
																		</p>
																	)}
																	<span>{formatNotificationTime(item?.createdAt)}</span>
																</div>
															</div>
														</Link>
													</div>
												))}
										</div>
									</div>
									<div className="d-flex p-0">
										<Link to="#" className="btn btn-light w-100 me-2">Cancel</Link>
										<Link to={routes.notifications} className="btn btn-primary w-100">View All</Link>
									</div>
								</div>
							</div>
							{user ? (
								<div className="dropdown profile-dropdown">
									<Link to="#" className="dropdown-toggle d-flex align-items-center" data-bs-toggle="dropdown">
										<span className="avatar avatar-sm online">
											<img
												src={getProfileImageUrl(resolvedProfileImage)}
												alt="Profile"
												className="img-fluid rounded-circle"
											/>
										</span>
									</Link>
									<div className="dropdown-menu shadow-none">
										<div className="card mb-0">
											<div className="card-header">
												<div className="d-flex align-items-center">
													<span className="avatar avatar-lg me-2 avatar-rounded">
														<img
															src={getProfileImageUrl(resolvedProfileImage)}
															alt="Profile"
														/>
													</span>
													<div>
														<h5 className="mb-0">
															{displayName}
														</h5>
														<p className="fs-12 fw-medium mb-0">
															{user.email || "No email"}
														</p>
													</div>
												</div>
											</div>
											<div className="card-body">
												<Link className="dropdown-item d-inline-flex align-items-center p-0 py-2" to={routes.profile}>
													<i className="ti ti-user-circle me-1"></i>My Profile
												</Link>
												<Link className="dropdown-item d-inline-flex align-items-center p-0 py-2" to={routes.bussinessSettings}>
													<i className="ti ti-settings me-1"></i>Settings
												</Link>
												<Link className="dropdown-item d-inline-flex align-items-center p-0 py-2" to={routes.securitysettings}>
													<i className="ti ti-status-change me-1"></i>Status
												</Link>
												{user?.role !== "STARTUP" && (
													<Link className="dropdown-item d-inline-flex align-items-center p-0 py-2" to={routes.profilesettings}>
														<i className="ti ti-circle-arrow-up me-1"></i>My Account
													</Link>
												)}
												{user?.role !== "STARTUP" && (
													<Link className="dropdown-item d-inline-flex align-items-center p-0 py-2" to={routes.knowledgebase}>
														<i className="ti ti-question-mark me-1"></i>Knowledge Base
													</Link>
												)}
											</div>
											<div className="card-footer">
												<button 
													className="dropdown-item d-inline-flex align-items-center p-0 py-2 border-0 bg-transparent" 
													onClick={handleLogout}
													style={{ cursor: 'pointer' }}
												>
													<i className="ti ti-logout me-2"></i>Logout
												</button>
											</div>
										</div>
									</div>
								</div>
							) : (
								<Link to={routes.login} className="btn btn-primary">
									<i className="ti ti-login me-2"></i>Login
								</Link>
							)}
						</div>
					</div>
				</div>

				{user && (
					<div className="dropdown mobile-user-menu">
						<Link to="#" className="nav-link dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
							<i className="fa fa-ellipsis-v"></i>
						</Link>
						<div className="dropdown-menu dropdown-menu-end">
							<Link className="dropdown-item" to={routes.profile}>My Profile</Link>
							<Link className="dropdown-item" to={routes.profilesettings}>Settings</Link>
							<button 
								className="dropdown-item border-0 bg-transparent" 
								onClick={handleLogout}
								style={{ cursor: 'pointer' }}
							>
								Logout
							</button>
						</div>
					</div>
				)}

			</div>

		</div>
      {/* /Header */}
    </>
  );
};

export default Header;
