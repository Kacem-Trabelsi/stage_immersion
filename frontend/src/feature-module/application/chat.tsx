import React, { useEffect, useState, useRef } from "react";
import Scrollbars from "react-custom-scrollbars-2";
import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import "react-modal-video/scss/modal-video.scss";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import ChatService from "../../services/chatService";
import VoiceCallService from "../../services/voiceCallService";
import VoiceCallModal from "../../components/VoiceCallModal";
import { useAuth } from "../../contexts/AuthContext";
import { API_BASE_URL } from "../../services/apiService";
import companyProfileService from "../../services/companyProfileService";
import "../../style/scss/connection-indicator.scss";

interface User {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  role: 'STARTUP' | 'EXPERT' | 'S2T' | 'ADMIN' | 'USER' | 'MANAGER';
  phone?: string;
  country?: string;
  position?: string;
  avatar?: string;
  profilePhoto?: string;
}

interface Message {
  _id: string;
  conversationId: string;
  senderId: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    avatar?: string;
    profilePhoto?: string;
  };
  messageType: 'text' | 'file' | 'voice' | 'emoji' | 'system';
  content: {
    text?: string;
    emoji?: string;
    systemMessage?: string;
  };
  attachments: Array<{
    type: 'file' | 'voice' | 'image';
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    duration?: number;
  }>;
  createdAt: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
}

interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  participants: Array<{
    userId: {
      _id: string;
      firstName?: string;
      lastName?: string;
      email: string;
      avatar?: string;
      role: string;
      isActive: boolean;
    };
    isActive: boolean;
    lastSeenAt: string;
  }>;
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: string;
  };
  unreadCount: Array<{
    userId: string;
    count: number;
  }>;
  updatedAt: string;
}

interface ChatUser {
  user: User;
  conversation?: Conversation;
  lastMessage?: Message;
  unreadCount: number;
  isOnline: boolean;
  lastSeen: Date;
  lastMessageTime: Date;
}

interface StartupProfileMeta {
  companyName?: string;
  logo?: string;
  user?: {
    _id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
}

interface VoiceCallHistoryItem {
  _id: string;
  callerId: any;
  receiverId: any;
  status: 'ended' | 'rejected' | 'missed' | string;
  callType?: 'voice' | 'video' | string;
  duration?: number;
  createdAt: string;
}

const Chat = () => {
  const useBodyClass = (className: string) => {
    const location = useLocation();

    useEffect(() => {
      if (location.pathname === "/application/chat") {
        document.body.classList.add(className);
      } else {
        document.body.classList.remove(className);
      }
      return () => {
        document.body.classList.remove(className);
      };
    }, [location.pathname, className]);
  };
  useBodyClass("app-chat");

  const routes = all_routes;
  const { user: currentUser } = useAuth();
  const currentUserId = String(currentUser?._id || (currentUser as any)?.id || "");
  const isStartupSession = currentUser?.role === 'STARTUP';
  
  // Debug currentUser
  console.log('Chat: currentUser from useAuth:', currentUser);
  console.log('Chat: currentUser._id:', currentUser?._id);
  
  // State management
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<string>("0:00");
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  
  // Voice call states
  const [showVoiceCallModal, setShowVoiceCallModal] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [isInCall, setIsInCall] = useState(false);
  
  // UI Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [startupProfiles, setStartupProfiles] = useState<Record<string, StartupProfileMeta>>({});
  const [callHistory, setCallHistory] = useState<VoiceCallHistoryItem[]>([]);
  const [loadingCallHistory, setLoadingCallHistory] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReconnecting, setSocketReconnecting] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error" | "info">("info");
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const audioChunks = useRef<Blob[]>([]);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const getEntityId = (u: any): string => String(u?._id || u?.id || "");

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Cleanup audio elements on unmount
  useEffect(() => {
    const currentAudioRefs = audioRefs.current;
    const currentTimer = recordingTimer.current;
    return () => {
      Object.values(currentAudioRefs).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      if (currentTimer) {
        clearInterval(currentTimer);
      }
    };
  }, []);

  // Socket connection status monitoring
  useEffect(() => {
    const unsubscribe = ChatService.onConnectionStatusChange((status: string, data?: any) => {
      console.log('Socket connection status changed:', status, data);
      switch (status) {
        case 'connected':
          setSocketConnected(true);
          setSocketReconnecting(false);
          // Initialize voice call service when socket connects
          VoiceCallService.initializeSocket(ChatService.getSocket());
          break;
        case 'disconnected':
          setSocketConnected(false);
          setSocketReconnecting(false);
          break;
        case 'reconnecting':
          setSocketConnected(false);
          setSocketReconnecting(true);
          break;
        case 'error':
        case 'failed':
          setSocketConnected(false);
          setSocketReconnecting(false);
          break;
        default:
          break;
      }
    });

    // Set initial connection status
    setSocketConnected(ChatService.isConnected());
    
    // Initialize voice call service if socket is already connected
    if (ChatService.isConnected()) {
      VoiceCallService.initializeSocket(ChatService.getSocket());
    }

    return unsubscribe;
  }, []);

  // Voice call event handlers
  useEffect(() => {
    VoiceCallService.setCallHandlers({
      onIncomingCall: (call: any) => {
        console.log('Chat: Incoming call handler triggered:', call);
        setCurrentCall(call);
        setShowVoiceCallModal(true);
        setIsInCall(true);
      },
      onCallInitiated: (call: any) => {
        console.log('Chat: Call initiated handler triggered:', call);
        setCurrentCall(call);
        setShowVoiceCallModal(true);
        setIsInCall(true);
      },
      onCallAccepted: (call: any) => {
        console.log('Chat: Call accepted:', call);
        setCurrentCall(call);
        setShowVoiceCallModal(true);
        setIsInCall(true);
      },
      onCallRejected: (call: any) => {
        setCurrentCall(null);
        setShowVoiceCallModal(false);
        setIsInCall(false);
        setModalMessage('Call was rejected');
        setModalType('info');
        setTimeout(() => {
          loadCallHistory();
        }, 300);
      },
      onCallEnded: (call: any) => {
        setCurrentCall(null);
        setShowVoiceCallModal(false);
        setIsInCall(false);
        setTimeout(() => {
          loadCallHistory();
        }, 300);
      },
      onCallError: (error: string) => {
        setModalMessage(`Call error: ${error}`);
        setModalType('error');
      },
      onRemoteStream: (stream: MediaStream) => {
        console.log('Chat: Remote stream received:', stream);
        // The stream will be handled by the VoiceCallModal component
      },
      onConnectionStateChange: (state: string) => {
        console.log('Chat: WebRTC connection state changed:', state);
        if (state === 'connected') {
          setModalMessage('Appel connecté avec succès');
          setModalType('success');
        } else if (state === 'failed' || state === 'disconnected') {
          setModalMessage('Connexion audio perdue');
          setModalType('error');
        }
      }
    });

    return () => {
      VoiceCallService.disconnect();
    };
  }, []);

  // Sanitize message to ensure proper structure
  const sanitizeMessage = (message: any): Message => {
    console.log('Raw message from backend:', message);
    
    // Handle case where content might be a string (JSON) that needs parsing
    let content = message.content;
    console.log('Original content:', content, 'Type:', typeof content);
    
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
        console.log('Parsed content:', content);
      } catch (e) {
        // If parsing fails, treat as text content
        content = { text: content };
        console.log('Parse failed, using as text:', content);
      }
    }

    const sanitized = {
      _id: message._id || Date.now().toString(),
      conversationId: message.conversationId || '',
      senderId: {
        _id: message.senderId?._id || message.senderId || '',
        firstName: message.senderId?.firstName || '',
        lastName: message.senderId?.lastName || '',
        email: message.senderId?.email || '',
        avatar: message.senderId?.avatar || ''
      },
      messageType: message.messageType || 'text',
      content: {
        text: content?.text || (message.messageType === 'text' ? content || '' : ''),
        emoji: content?.emoji || '',
        systemMessage: content?.systemMessage || ''
      },
      attachments: message.attachments || [],
      createdAt: message.createdAt || new Date().toISOString(),
      deliveryStatus: message.deliveryStatus || 'sent',
      isEdited: message.isEdited || false,
      isDeleted: message.isDeleted || false
    };
    
    console.log('Sanitized message:', sanitized);
    return sanitized;
  };

  // Normalize lightweight conversation.lastMessage payload to Message shape
  const normalizeConversationLastMessage = (lastMessage: any, userRef: any): Message | undefined => {
    if (!lastMessage) return undefined;
    const createdAt = lastMessage?.createdAt || lastMessage?.timestamp || new Date().toISOString();
    const sender = lastMessage?.senderId && typeof lastMessage.senderId === 'object'
      ? lastMessage.senderId
      : userRef;

    const rawContent = lastMessage?.content;
    const textFromContent = typeof rawContent === 'string'
      ? rawContent
      : (rawContent?.text || lastMessage?.text || '');

    return {
      _id: String(lastMessage?._id || `conv-last-${userRef?._id || Date.now()}`),
      conversationId: String(lastMessage?.conversationId || ''),
      senderId: {
        _id: String(sender?._id || ''),
        firstName: sender?.firstName,
        lastName: sender?.lastName,
        email: sender?.email || '',
        avatar: sender?.avatar,
        profilePhoto: sender?.profilePhoto
      },
      messageType: (lastMessage?.messageType || 'text') as Message['messageType'],
      content: {
        text: textFromContent,
        emoji: rawContent?.emoji || '',
        systemMessage: rawContent?.systemMessage || ''
      },
      attachments: Array.isArray(lastMessage?.attachments) ? lastMessage.attachments : [],
      createdAt,
      deliveryStatus: (lastMessage?.deliveryStatus || 'sent') as Message['deliveryStatus'],
      isEdited: !!lastMessage?.isEdited,
      editedAt: lastMessage?.editedAt,
      isDeleted: !!lastMessage?.isDeleted
    };
  };

  // Get user avatar or default
  const getUserAvatar = (user: User | null): string => {
    const fallback = '/assets/img/profiles/avatar-29.jpg';
    if (!user) return fallback;

    const userId = getEntityId(user);
    const startupLogo =
      user.role === 'STARTUP' ? startupProfiles[userId]?.logo || '' : '';
    const raw = String(startupLogo || user.avatar || user.profilePhoto || '').trim();
    if (!raw) return fallback;

    // Guard against bad values accidentally persisted in storage/API
    if (
      raw === 'undefined' ||
      raw === 'null' ||
      raw === '[object Object]' ||
      raw.includes('function wrap()')
    ) {
      return fallback;
    }

    if (raw.startsWith('/data:image/')) return raw.substring(1);
    if (raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('blob:')) return raw;

    if (raw.startsWith('/uploads') || raw.startsWith('uploads/')) {
      const normalized = raw.startsWith('/') ? raw : `/${raw}`;
      return `${API_BASE_URL}${normalized}`;
    }
    if (raw.startsWith('/assets/')) return raw;
    if (raw.startsWith('assets/')) return `/${raw}`;

    // Fallback for plain filenames
    if (!raw.includes('/') && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(raw)) {
      return `${API_BASE_URL}/uploads/profiles/${raw}`;
    }

    // Generic absolute-like backend path
    if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;

    return fallback;
  };

  const onAvatarError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    if (target.src.includes('/assets/img/profiles/avatar-29.jpg')) return;
    target.src = '/assets/img/profiles/avatar-29.jpg';
  };

  const getCallOtherUser = (call: VoiceCallHistoryItem): User | null => {
    const me = String(currentUser?._id || currentUser?.id || "");
    const callerId = String(call?.callerId?._id || call?.callerId || "");
    const receiverId = String(call?.receiverId?._id || call?.receiverId || "");
    const other = callerId === me ? call?.receiverId : call?.callerId;
    if (!other) return null;
    return {
      _id: String(other?._id || ""),
      email: other?.email || "unknown@example.com",
      firstName: other?.firstName,
      lastName: other?.lastName,
      username: other?.username,
      role: (other?.role || 'USER') as User['role'],
      avatar: other?.avatar,
      profilePhoto: other?.profilePhoto
    };
  };

  const formatCallDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const loadCallHistory = async () => {
    try {
      setLoadingCallHistory(true);
      const res = await VoiceCallService.getCallHistory(1, 20);
      const calls = Array.isArray(res?.data?.calls) ? res.data.calls : [];
      setCallHistory(calls);
    } catch (e) {
      console.error("Failed to load call history:", e);
      setCallHistory([]);
    } finally {
      setLoadingCallHistory(false);
    }
  };

  // Get user display name
  const getUserDisplayName = (user: User | null): string => {
    if (!user) return 'Select a user';
    const userId = getEntityId(user);
    if (user.role === 'STARTUP' && startupProfiles[userId]?.companyName) {
      return startupProfiles[userId].companyName as string;
    }
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email.split('@')[0];
  };

  // Load startup profile meta (company name + logo) for chat display
  useEffect(() => {
    const loadStartupProfiles = async () => {
      try {
        const response = await companyProfileService.getAllCompanyProfiles();
        const profiles = Array.isArray(response?.data) ? response.data : [];
        const profileMap: Record<string, StartupProfileMeta> = {};
        profiles.forEach((p: any) => {
          const uid = String(p?.userId?._id || p?.userId || '');
          if (!uid) return;
          profileMap[uid] = {
            companyName: p?.companyName || '',
            logo: p?.logo || '',
            user: p?.userId
              ? {
                  _id: String(p.userId?._id || uid),
                  email: p.userId?.email || '',
                  firstName: p.userId?.firstName || '',
                  lastName: p.userId?.lastName || '',
                  role: p.userId?.role || 'STARTUP'
                }
              : undefined
          };
        });
        setStartupProfiles(profileMap);
      } catch {
        // keep chat usable even if company profile fetch fails
      }
    };
    loadStartupProfiles();
  }, []);

  // Load persisted call history for chat
  useEffect(() => {
    if (!currentUser?._id && !(currentUser as any)?.id) return;
    loadCallHistory();
  }, [currentUser?._id, (currentUser as any)?.id]);

  // Load selected user from sessionStorage and fetch data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // Load selected user from sessionStorage
        const storedUser = sessionStorage.getItem('selectedChatUser');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            setSelectedUser(userData);
          } catch (error) {
            console.error('Error parsing stored user data:', error);
          }
        }

        // Check if user is authenticated
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn('No authentication token found. Using mock data for demo.');
          // Create mock users for demo when not authenticated
          const mockUsers: User[] = [
            {
              _id: '1',
              email: 'john.doe@example.com',
              firstName: 'John',
              lastName: 'Doe',
              username: 'johndoe',
              role: 'USER',
              phone: '+1234567890',
              country: 'USA'
            },
            {
              _id: '2', 
              email: 'jane.smith@example.com',
              firstName: 'Jane',
              lastName: 'Smith',
              username: 'janesmith',
              role: 'MANAGER',
              phone: '+1234567891',
              country: 'Canada'
            },
            {
              _id: '3',
              email: 'faten.meziou@example.com',
              firstName: 'Faten',
              lastName: 'Meziou',
              username: 'fatenmeziou',
              role: 'USER',
              phone: '+1234567892',
              country: 'Tunisia'
            }
          ];
          
          const chatUsersData: ChatUser[] = mockUsers.map((user: User, index: number) => {
            // Create varied unread counts for demo
            const unreadCount = index === 0 ? 3 : index === 1 ? 0 : 2;
            const lastMessageTime = new Date(Date.now() - (index * 2 * 60 * 60 * 1000)); // Stagger times
            
            return {
              user,
              unreadCount,
              isOnline: Math.random() > 0.5,
              lastSeen: new Date(Date.now() - Math.random() * 86400000),
              lastMessageTime,
              // Add mock last message for users with unread counts
              lastMessage: unreadCount > 0 ? {
                _id: `mock-${index}`,
                conversationId: `conv-${index}`,
                senderId: {
                  _id: user._id,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  avatar: ''
                },
                messageType: 'text' as const,
                content: {
                  text: index === 0 ? 'Hey! How are you doing?' : 'Can we schedule a meeting?',
                  emoji: '',
                  systemMessage: ''
                },
                attachments: [],
                createdAt: lastMessageTime.toISOString(),
                deliveryStatus: 'delivered' as const,
                isEdited: false,
                isDeleted: false
              } : undefined
            };
          });
          
          setChatUsers(chatUsersData);
          setLoading(false);
          return;
        }

        try {
          // Initialize chat service with token
          ChatService.token = token;
          
          // Connect to socket for real-time communication
          try {
            await ChatService.connect(token);
            console.log('Socket connected successfully');
            setSocketConnected(true);
          } catch (socketError) {
            console.error('Failed to connect socket:', socketError);
            setSocketConnected(false);
            // Continue without socket connection
          }
          
          // Fetch users for chat list
          const usersResponse = await ChatService.getUsers();
          const users = usersResponse || [];
          
          // Also fetch existing conversations
          const conversationsResponse = await ChatService.getConversations();
          const userConversations = conversationsResponse || [];
          
          // Convert users to chat users format
          const chatUsersData: ChatUser[] = users.map((user: any) => {
            const existingConversation = userConversations.find((conv: Conversation) => 
              conv.type === 'direct' && 
              conv.participants.some(p => p.userId._id === user._id)
            );
            
            const unreadCount = existingConversation?.unreadCount.find(
              (uc: any) => uc.userId === currentUser?.id
            )?.count || 0;
            
            const normalizedLastMessage = normalizeConversationLastMessage(existingConversation?.lastMessage, user);
            // Get the last message time for sorting
            const lastMessageTime = normalizedLastMessage?.createdAt ||
                                  existingConversation?.updatedAt ||
                                  user.createdAt ||
                                  new Date(Date.now() - Math.random() * 86400000);
            
            return {
              user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                avatar: user.avatar
              },
              conversation: existingConversation,
              unreadCount,
              isOnline: user.isActive && Math.random() > 0.3, // Simulate online status
              lastSeen: new Date(Date.now() - Math.random() * 86400000),
              lastMessageTime: new Date(lastMessageTime),
              lastMessage: normalizedLastMessage
            };
          });

          // Sort chat users: unread messages first, then by last message time
          chatUsersData.sort((a, b) => {
            // First priority: unread messages
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
            
            // Second priority: last message time (most recent first)
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });
          
          setChatUsers(chatUsersData);
        } catch (error) {
          console.error('Error fetching chat data from API, using mock data:', error);
          // Fallback to mock data if API fails
          const mockUsers: User[] = [
            {
              _id: '1',
              email: 'faten.meziou@example.com',
              firstName: 'Faten',
              lastName: 'Meziou',
              username: 'fatenmeziou',
              role: 'USER'
            },
            {
              _id: '2',
              email: 'john.doe@example.com',
              firstName: 'John',
              lastName: 'Doe',
              username: 'johndoe',
              role: 'MANAGER'
            }
          ];
          
          const chatUsersData: ChatUser[] = mockUsers.map((user: User) => ({
            user,
            unreadCount: Math.floor(Math.random() * 3),
            isOnline: Math.random() > 0.5,
            lastSeen: new Date(Date.now() - Math.random() * 86400000),
            lastMessageTime: new Date(Date.now() - Math.random() * 86400000)
          }));
          
          setChatUsers(chatUsersData);
        }
        
      } catch (error) {
        console.error('Error loading chat data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [currentUser]);

  // Load messages for selected user
  const loadMessagesForUser = React.useCallback(async (userId: string) => {
    if (!currentUser) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // No token, show empty conversation
        setMessages([]);
        return;
      }

      // Get or create conversation
      const conversation = await ChatService.createDirectConversation(userId);
      setCurrentConversation(conversation);
      
      // Load messages for this conversation
      console.log('Loading messages for conversation:', conversation._id);
      const messagesData = await ChatService.getMessages(conversation._id);
      console.log('Raw messages data from backend:', messagesData);
      
      const formattedMessages = (messagesData.messages || []).map(sanitizeMessage);
      console.log('Formatted messages after sanitization:', formattedMessages);
      
      setMessages(formattedMessages);
      
      // Mark conversation as read
      if (formattedMessages.length > 0) {
        await ChatService.markAsRead(conversation._id);
      }
      
    } catch (error) {
      console.error('Error loading messages:', error);
      // Set empty messages on error
      setMessages([]);
    }
  }, [currentUser]);

  // Load messages for selected user
  useEffect(() => {
    if (selectedUser) {
      loadMessagesForUser(selectedUser._id);
    }
  }, [selectedUser, loadMessagesForUser]);

  useEffect(() => {
    if (!ChatService.socket) return;

    const socket = ChatService.socket;



    return () => {
    };
  }, []);


  // Filter and sort chat users based on search term
  const filteredChatUsers = React.useMemo(() => {
    const filtered = chatUsers.filter(chatUser => 
      getUserDisplayName(chatUser.user).toLowerCase().includes(searchTerm.toLowerCase()) ||
      chatUser.user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort filtered results: unread messages first, then by last message time
    return filtered.sort((a, b) => {
      // First priority: unread messages
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      
      // Second priority: last message time (most recent first)
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });
  }, [chatUsers, searchTerm]);

  const suggestedContacts = React.useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    const me = String(currentUser?._id || (currentUser as any)?.id || '');
    const baseUsers = chatUsers.map((c) => c.user);
    const startupUsersFromProfiles: User[] = Object.entries(startupProfiles)
      .map(([uid, meta]) => {
        const userId = String(meta?.user?._id || uid);
        return {
          _id: userId,
          email: meta?.user?.email || '',
          firstName: meta?.user?.firstName || '',
          lastName: meta?.user?.lastName || '',
          username: meta?.companyName || meta?.user?.email || '',
          role: 'STARTUP' as User['role'],
          avatar: meta?.logo || '',
          profilePhoto: meta?.logo || ''
        };
      });

    const mergedById = new Map<string, User>();
    [...baseUsers, ...startupUsersFromProfiles].forEach((u) => {
      if (!u?._id) return;
      const existing = mergedById.get(String(u._id));
      mergedById.set(String(u._id), {
        ...(existing || u),
        ...u
      });
    });

    return Array.from(mergedById.values())
      .filter((u) => ['EXPERT', 'STARTUP'].includes(u.role))
      .filter((u) => String(u._id) !== me)
      .filter((u) => {
        if (!q) return true;
        const name = getUserDisplayName(u).toLowerCase();
        const email = (u.email || '').toLowerCase();
        const role = (u.role || '').toLowerCase();
        return name.includes(q) || email.includes(q) || role.includes(q);
      })
      .slice(0, 20);
  }, [chatUsers, contactSearch, currentUser, selectedUser, startupProfiles]);

  // Handle user selection for chat
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    sessionStorage.setItem('selectedChatUser', JSON.stringify(user));
    
    // Mark conversation as read and update unread count
    setChatUsers(prevUsers => 
      prevUsers.map(chatUser => 
        chatUser.user._id === user._id 
          ? { ...chatUser, unreadCount: 0 }
          : chatUser
      )
    );
  };

  // Update chat user with new message
  const updateChatUserWithNewMessage = React.useCallback((message: Message, isCurrentUserSender: boolean = false) => {
    const targetUserId = isCurrentUserSender ? 
      (selectedUser?._id) : 
      message.senderId._id;
      
    if (!targetUserId) return;

    setChatUsers(prevUsers => {
      const updatedUsers = prevUsers.map(chatUser => {
        if (chatUser.user._id === targetUserId) {
          return {
            ...chatUser,
            lastMessage: message,
            lastMessageTime: new Date(message.createdAt),
            // Only increment unread count if message is from another user and not currently selected
            unreadCount: isCurrentUserSender || chatUser.user._id === selectedUser?._id ? 
              chatUser.unreadCount : 
              chatUser.unreadCount + 1
          };
        }
        return chatUser;
      });

      // Sort updated users: unread messages first, then by last message time
      return updatedUsers.sort((a, b) => {
        // First priority: unread messages
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        
        // Second priority: last message time (most recent first)
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
    });
  }, [selectedUser]);

  // Handle view profile
  const handleViewProfile = () => {
    if (!selectedUser) {
      setModalMessage('Please select a user first');
      setModalType('info');
      return;
    }
    setShowProfileModal(true);
  };

  // Handle add to group
  const handleAddToGroup = () => {
    if (!selectedUser) {
      setModalMessage('Please select a user first');
      setModalType('info');
      return;
    }
    setShowGroupModal(true);
  };

  // Handle block user
  const handleBlockUser = () => {
    if (!selectedUser) {
      setModalMessage('Please select a user first');
      setModalType('info');
      return;
    }
    setShowBlockModal(true);
  };

  // Confirm block user
  const confirmBlockUser = () => {
    if (!selectedUser) return;
    
    // Add user to blocked list
    setBlockedUsers(prev => [...prev, selectedUser]);
    
    // Remove user from chat list
    setChatUsers(prevUsers => 
      prevUsers.filter(chatUser => chatUser.user._id !== selectedUser._id)
    );
    
    // Clear selected user and messages
    setSelectedUser(null);
    setMessages([]);
    setCurrentConversation(null);
    sessionStorage.removeItem('selectedChatUser');
    
    setModalMessage(`Blocked ${getUserDisplayName(selectedUser)} successfully`);
    setModalType('success');
    setShowBlockModal(false);
  };

  // Handle unblock user
  const handleUnblockUser = (userToUnblock: User) => {
    setBlockedUsers(prev => prev.filter(user => user._id !== userToUnblock._id));
    setModalMessage(`Unblocked ${getUserDisplayName(userToUnblock)} successfully`);
    setModalType('success');
    setShowUnblockModal(false);
  };

  // Handle delete conversation
  const handleDeleteConversation = () => {
    if (!selectedUser) {
      setModalMessage('Please select a user first');
      setModalType('info');
      return;
    }
    setShowDeleteModal(true);
  };

  // Confirm delete conversation
  const confirmDeleteConversation = () => {
    if (!selectedUser) return;
    
    // Remove conversation from chat list
    setChatUsers(prevUsers => 
      prevUsers.filter(chatUser => chatUser.user._id !== selectedUser._id)
    );
    
    // Clear selected user and messages
    setSelectedUser(null);
    setMessages([]);
    setCurrentConversation(null);
    sessionStorage.removeItem('selectedChatUser');
    
    setModalMessage(`Conversation with ${getUserDisplayName(selectedUser)} deleted successfully`);
    setModalType('success');
    setShowDeleteModal(false);
  };

  // Handle search in messages
  const handleMessageSearch = () => {
    setShowMessageSearch(!showMessageSearch);
    if (!showMessageSearch) {
      setMessageSearchTerm("");
    }
  };

  // Voice call handlers
  const handleInitiateCall = async () => {
    if (!selectedUser || !currentConversation || isInCall) return;
    
    try {
      await VoiceCallService.initiateCall(
        currentConversation._id,
        selectedUser._id,
        'voice'
      );
    } catch (error) {
      console.error('Error initiating call:', error);
      setModalMessage('Failed to initiate call. Please try again.');
      setModalType('error');
    }
  };

  const handleAcceptCall = async (callId: string) => {
    try {
      console.log('Chat: handleAcceptCall called with callId:', callId);
      await VoiceCallService.acceptCall(callId);
      console.log('Chat: Call accepted successfully');
    } catch (error) {
      console.error('Error accepting call:', error);
      setModalMessage('Failed to accept call. Please try again.');
      setModalType('error');
    }
  };

  const handleRejectCall = async (callId: string) => {
    try {
      await VoiceCallService.rejectCall(callId);
    } catch (error) {
      console.error('Error rejecting call:', error);
      setModalMessage('Failed to reject call. Please try again.');
      setModalType('error');
    }
  };

  const handleEndCall = async (callId: string) => {
    try {
      await VoiceCallService.endCall(callId);
      
      // Don't close modal immediately - wait for call_ended event
      // The modal will be closed by the onCallEnded handler
      
    } catch (error) {
      console.error('Error ending call:', error);
      setModalMessage('Failed to end call. Please try again.');
      setModalType('error');
      
      // Only close modal on error
      setShowVoiceCallModal(false);
      setCurrentCall(null);
      setIsInCall(false);
    }
  };

  // Filter messages based on search term
  const filteredMessages = React.useMemo(() => {
    if (!messageSearchTerm.trim()) {
      return messages;
    }
    
    return messages.filter(message => 
      message.content?.text?.toLowerCase().includes(messageSearchTerm.toLowerCase()) ||
      message.content?.emoji?.includes(messageSearchTerm) ||
      (message.attachments && message.attachments.some(att => 
        att.fileName?.toLowerCase().includes(messageSearchTerm.toLowerCase())
      ))
    );
  }, [messages, messageSearchTerm]);

  // Highlight search terms in message text
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !text) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ 
          backgroundColor: '#fff3cd', 
          color: '#856404',
          padding: '2px 4px',
          borderRadius: '3px',
          fontWeight: 'bold'
        }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Handle sending new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUser || isSending) return;

    setIsSending(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token available - using demo mode');
        // Demo mode - create temporary message
        const tempMessage: Message = {
          _id: Date.now().toString(),
          conversationId: 'demo',
          senderId: {
            _id: currentUser.id,
            firstName: currentUser.firstName || 'You',
            lastName: currentUser.lastName || '',
            email: currentUser.email,
            avatar: currentUser.avatar
          },
          messageType: 'text',
          content: { text: newMessage },
          attachments: [],
          createdAt: new Date().toISOString(),
          deliveryStatus: 'sent',
          isEdited: false,
          isDeleted: false
        };

        setMessages(prev => [...prev, tempMessage]);
        
        // Update chat user list with new message (demo mode)
        if (selectedUser) {
          updateChatUserWithNewMessage(tempMessage, true);
        }
        
        setNewMessage("");
        setIsSending(false);
        return;
      }

      // Get or create conversation first
      let conversation = currentConversation;
      if (!conversation) {
        conversation = await ChatService.createDirectConversation(selectedUser._id);
        setCurrentConversation(conversation);
      }

      if (!conversation) {
        throw new Error('No conversation available');
      }

      // Send message via API
      console.log('Sending message with params:', {
        conversationId: conversation._id,
        messageType: 'text',
        content: { text: newMessage }
      });
      
      const sentMessage = await ChatService.sendMessage(
        conversation._id,
        'text',
        { text: newMessage }
      );
      
      console.log('Received response from backend:', sentMessage);
      
      // Add message to state with sanitization
      const sanitizedMessage = sanitizeMessage(sentMessage);
      setMessages(prev => [...prev, sanitizedMessage]);
      
      // Update chat user list with new message
      updateChatUserWithNewMessage(sanitizedMessage, true);
      
      setNewMessage("");
      
    } catch (error) {
      console.error('Error sending message:', error);
      setModalMessage('Failed to send message. Please try again.');
      setModalType('error');
    } finally {
      setIsSending(false);
    }
  };

  const sendQuickTextMessage = async (text: string) => {
    if (!text.trim() || !selectedUser || !currentUser || isSending) return;
    setIsSending(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setModalMessage('Message sending requires authentication. Please log in.');
        setModalType('info');
        return;
      }
      let conversation = currentConversation;
      if (!conversation) {
        conversation = await ChatService.createDirectConversation(selectedUser._id);
        setCurrentConversation(conversation);
      }
      if (!conversation) throw new Error('No conversation available');
      const sentMessage = await ChatService.sendMessage(conversation._id, 'text', { text });
      const sanitizedMessage = sanitizeMessage(sentMessage);
      setMessages(prev => [...prev, sanitizedMessage]);
      updateChatUserWithNewMessage(sanitizedMessage, true);
    } catch (error) {
      console.error('Error sending quick message:', error);
      setModalMessage('Failed to send message. Please try again.');
      setModalType('error');
    } finally {
      setIsSending(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !currentUser || isSending) return;

    setIsSending(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token available - file upload not supported in demo mode');
        setModalMessage('File upload requires authentication. Please log in.');
        setModalType('info');
        setIsSending(false);
        return;
      }

      // Get or create conversation first
      let conversation = currentConversation;
      if (!conversation) {
        conversation = await ChatService.createDirectConversation(selectedUser._id);
        setCurrentConversation(conversation);
      }

      if (!conversation) {
        throw new Error('No conversation available');
      }

      // Send file via API - using the correct method from ChatService
      const formData = new FormData();
      formData.append('file', file);
      
      const sentMessage = await ChatService.sendMessage(
        conversation._id, 
        'file', 
        { text: `Shared a file: ${file.name}` }, 
        [file]
      );
      
      // Add message to state with sanitization
      const sanitizedMessage = sanitizeMessage(sentMessage);
      setMessages(prev => [...prev, sanitizedMessage]);
      
      // Update chat user list with new message
      updateChatUserWithNewMessage(sanitizedMessage, true);
      
    } catch (error) {
      console.error('Error sending file:', error);
      setModalMessage('Failed to send file. Please try again.');
      setModalType('error');
    } finally {
      setIsSending(false);
      event.target.value = '';
    }
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !currentUser || isSending) return;

    setIsSending(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token available - image upload not supported in demo mode');
        setModalMessage('Image upload requires authentication. Please log in.');
        setModalType('info');
        setIsSending(false);
        return;
      }

      // Get or create conversation first
      let conversation = currentConversation;
      if (!conversation) {
        conversation = await ChatService.createDirectConversation(selectedUser._id);
        setCurrentConversation(conversation);
      }

      if (!conversation) {
        throw new Error('No conversation available');
      }

      // Send image via API
      const sentMessage = await ChatService.sendMessage(
        conversation._id, 
        'file', 
        { text: `Shared an image: ${file.name}` }, 
        [file]
      );
      
      // Add message to state with sanitization
      const sanitizedMessage = sanitizeMessage(sentMessage);
      setMessages(prev => [...prev, sanitizedMessage]);
      
      // Update chat user list with new message
      updateChatUserWithNewMessage(sanitizedMessage, true);
      
    } catch (error) {
      console.error('Error sending image:', error);
      setModalMessage('Failed to send image. Please try again.');
      setModalType('error');
    } finally {
      setIsSending(false);
      event.target.value = '';
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !currentUser || isSending) return;
    setIsSending(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setModalMessage('Audio upload requires authentication. Please log in.');
        setModalType('info');
        return;
      }
      let conversation = currentConversation;
      if (!conversation) {
        conversation = await ChatService.createDirectConversation(selectedUser._id);
        setCurrentConversation(conversation);
      }
      if (!conversation) throw new Error('No conversation available');
      const sentMessage = await ChatService.sendMessage(
        conversation._id,
        'file',
        { text: `🎵 Shared audio: ${file.name}` },
        [file]
      );
      const sanitizedMessage = sanitizeMessage(sentMessage);
      setMessages(prev => [...prev, sanitizedMessage]);
      updateChatUserWithNewMessage(sanitizedMessage, true);
    } catch (error) {
      console.error('Error sending audio:', error);
      setModalMessage('Failed to send audio. Please try again.');
      setModalType('error');
    } finally {
      setIsSending(false);
      event.target.value = '';
    }
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      setModalMessage('Geolocation is not supported in this browser.');
      setModalType('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        await sendQuickTextMessage(`📍 My location: ${mapsUrl}`);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setModalMessage('Unable to access location.');
        setModalType('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSendContact = async (contactUser: User) => {
    const roleLabel = contactUser.role || 'USER';
    const fullName = getUserDisplayName(contactUser);
    const text = `👤 Contact: ${fullName}\nRole: ${roleLabel}\nEmail: ${contactUser.email}`;
    await sendQuickTextMessage(text);
    setShowContactPicker(false);
    setContactSearch("");
  };

  // Handle voice recording
  const handleVoiceRecording = async () => {
    if (!selectedUser || !currentUser || isSending) return;

    if (!isRecording) {
      try {
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        
        audioChunks.current = [];
        setMediaRecorder(recorder);
        const startTime = Date.now();
        startRecordingTimer(startTime);
        setIsRecording(true);
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
          
          // Stop all audio tracks
          stream.getTracks().forEach(track => track.stop());
          
          // Send voice message via API if authenticated
          const token = localStorage.getItem('token');
          if (token && currentConversation) {
            try {
              setIsSending(true);
              
              // Create a File object from the blob
              const audioFile = new File([audioBlob], 'voice_recording.wav', { type: 'audio/wav' });
              
              const sentMessage = await ChatService.sendMessage(
                currentConversation._id,
                'file',
                { text: 'Voice message' },
                [audioFile]
              );
              
              const sanitizedMessage = sanitizeMessage(sentMessage);
              setMessages(prev => [...prev, sanitizedMessage]);
              
              // Update chat user list with new message
              updateChatUserWithNewMessage(sanitizedMessage, true);
            } catch (error) {
              console.error('Error sending voice message:', error);
              setModalMessage('Failed to send voice message. Please try again.');
              setModalType('error');
            } finally {
              setIsSending(false);
            }
          } else {
            // Demo mode - create temporary message
            const audioUrl = URL.createObjectURL(audioBlob);
            const tempMessage: Message = {
              _id: Date.now().toString(),
              conversationId: 'demo',
              senderId: {
                _id: currentUser.id,
                firstName: currentUser.firstName || 'You',
                lastName: currentUser.lastName || '',
                email: currentUser.email,
                avatar: currentUser.avatar
              },
              messageType: 'file',
              content: { text: 'Voice message' },
              attachments: [{
                type: 'voice',
                fileName: 'voice_recording.wav',
                filePath: audioUrl,
                fileSize: audioBlob.size,
                mimeType: 'audio/wav',
                duration: Math.floor((Date.now() - startTime) / 1000)
              }],
              createdAt: new Date().toISOString(),
              deliveryStatus: 'sent',
              isEdited: false,
              isDeleted: false
            };

            setMessages(prev => [...prev, tempMessage]);
            
            // Update chat user list with new message (demo mode)
            if (selectedUser) {
              updateChatUserWithNewMessage(tempMessage, true);
            }
          }
        };

        recorder.start();
        console.log('Starting voice recording...');
        
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setModalMessage('Microphone access denied. Please enable microphone permissions and try again.');
        setModalType('error');
        setIsRecording(false);
        stopRecordingTimer();
      }
    } else {
      // Stop recording
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      setIsRecording(false);
      stopRecordingTimer();
      setMediaRecorder(null);
      console.log('Stopping voice recording...');
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Handle key press in message input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date));
  };

  // Format last seen
  const formatLastSeen = (date: Date | string | null | undefined) => {
    if (!date) return 'Unknown';
    
    try {
      const now = new Date();
      const targetDate = new Date(date);
      
      // Check if the date is valid
      if (isNaN(targetDate.getTime())) {
        return 'Unknown';
      }
      
      const diffMs = now.getTime() - targetDate.getTime();
      
      // Check if the difference is valid
      if (isNaN(diffMs) || diffMs < 0) {
        return 'Unknown';
      }
      
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 5) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  const getChatListPreview = (chatUser: ChatUser) => {
    if (chatUser.lastMessage) {
      if (chatUser.lastMessage.messageType === 'file') {
        return `📎 ${chatUser.lastMessage.content?.text || 'Attachment'}`;
      }
      if (chatUser.lastMessage.messageType === 'emoji') {
        return chatUser.lastMessage.content?.emoji || '😊';
      }
      const text = chatUser.lastMessage.content?.text || '';
      return text || 'No message';
    }

    if (chatUser.isOnline) return 'Online';
    return isStartupSession ? 'Démarrer la conversation' : `Last seen ${formatLastSeen(chatUser.lastSeen)}`;
  };

  const getChatListTime = (chatUser: ChatUser) => {
    const raw = chatUser.lastMessage
      ? formatLastSeen(chatUser.lastMessageTime || chatUser.lastMessage.createdAt)
      : formatLastSeen(chatUser.lastSeen);

    // For startup session, hide noisy "Unknown" label in the list.
    if (isStartupSession && raw === 'Unknown') return '';
    return raw;
  };

  // Handle audio playback
  const handleAudioPlayback = (messageId: string, audioUrl?: string) => {
    // If no audio URL, show message that it's a demo
    if (!audioUrl) {
      setModalMessage('This is a demo voice message. No actual audio file available.');
      setModalType('info');
      return;
    }

    if (playingAudio === messageId) {
      // Pause current audio
      const audio = audioRefs.current[messageId];
      if (audio) {
        audio.pause();
      }
      setPlayingAudio(null);
    } else {
      // Stop any currently playing audio
      if (playingAudio) {
        const currentAudio = audioRefs.current[playingAudio];
        if (currentAudio) {
          currentAudio.pause();
        }
      }

      // Create or get audio element
      if (!audioRefs.current[messageId]) {
        audioRefs.current[messageId] = new Audio(audioUrl);
        audioRefs.current[messageId].addEventListener('ended', () => {
          setPlayingAudio(null);
        });
        audioRefs.current[messageId].addEventListener('error', (e) => {
          console.error('Audio playback error:', e);
          setPlayingAudio(null);
          setModalMessage('Error playing audio file.');
          setModalType('error');
        });
      }

      // Play new audio
      try {
        audioRefs.current[messageId].play().catch((error) => {
          console.error('Audio play failed:', error);
          setPlayingAudio(null);
          setModalMessage('Unable to play audio file.');
          setModalType('error');
        });
        setPlayingAudio(messageId);
      } catch (error) {
        console.error('Audio playback error:', error);
        setPlayingAudio(null);
      }
    }
  };

  // Handle file download
  const handleFileDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle image transfer/share
  const handleImageTransfer = async (imageUrl: string, fileName: string) => {
    try {
      if (navigator.share) {
        // Use Web Share API if available
        await navigator.share({
          title: 'Shared Image',
          text: `Sharing image: ${fileName}`,
          url: imageUrl
        });
      } else {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(imageUrl);
        setModalMessage('Image URL copied to clipboard!');
        setModalType('success');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      // Additional fallback: create a sharing modal or copy URL
      const shareText = `Check out this image: ${imageUrl}`;
      await navigator.clipboard.writeText(shareText);
      setModalMessage('Image link copied to clipboard!');
      setModalType('success');
    }
  };

  // Get recording duration for display
  const getRecordingDuration = () => {
    return recordingDuration;
  };

  // Start recording timer
  const startRecordingTimer = (startTime: number) => {
    setRecordingDuration('0:00');
    
    recordingTimer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setRecordingDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
  };

  // Stop recording timer
  const stopRecordingTimer = () => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    setRecordingDuration('0:00');
  };

  return (
    <>
      {/* Loading Animation Styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Remove theme blue contour on both sender/receiver bubbles */
        .messages .chats .chat-content,
        .messages .chats-right .chat-content {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background-image: none !important;
        }

        .messages .chats .chat-content::before,
        .messages .chats .chat-content::after,
        .messages .chats-right .chat-content::before,
        .messages .chats-right .chat-content::after {
          content: none !important;
          border: none !important;
          box-shadow: none !important;
        }

        .messages .chat-profile-name h6,
        .messages .chat-profile-name h6 span,
        .messages .message-content {
          color: #111827 !important;
        }
      `}</style>
      
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="page-header">
            <div className="row">
              <div className="col-sm-12">
                <ul className="breadcrumb">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <i className="feather-chevron-right" />
                  </li>
                  <li className="breadcrumb-item active">Chat</li>
                </ul>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          
          <div className="row">
            <div className="col-lg-12">
              <CollapseHeader />
            </div>
          </div>
          
          <div className="chat-wrapper">
            {/* Chats sidebar */}
            <div className="sidebar-group">
              <div id="chats" className="sidebar-content active slimscroll">
                <Scrollbars>
                  <div className="chat-search-header">
                    <div className="header-title d-flex align-items-center justify-content-between">
                      <h4 className="mb-3">Chats</h4>
                    </div>
                    {/* Chat Search */}
                    <div className="search-wrap">
                      <form action="#" onSubmit={(e) => e.preventDefault()}>
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search For Contacts or Messages"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                          <span className="input-group-text">
                            <i className="ti ti-search" />
                          </span>
                        </div>
                      </form>
                    </div>
                    {/* /Chat Search */}
                  </div>
                  
                  <div className="sidebar-body chat-body" id="chatsidebar">
                    {/* Left Chat Title */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="chat-title">All Chats</h5>
                    </div>
                    {/* /Left Chat Title */}
                    
                    <div className="chat-users-wrap">
                      <div className="chat-list">
                        {loading ? (
                          <div className="text-center p-3">
                            <div className="spinner-border text-primary" role="status">
                              <span className="sr-only">Loading...</span>
                            </div>
                          </div>
                        ) : filteredChatUsers.length > 0 ? (
                          filteredChatUsers.map((chatUser) => (
                            <div key={chatUser.user._id} className="d-flex align-items-center position-relative mb-2">
                              <Link 
                                to="#"
                                className={`chat-user-list flex-grow-1 ${selectedUser?._id === chatUser.user._id ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleUserSelect(chatUser.user);
                                }}
                              >
                                <div className={`avatar avatar-lg ${chatUser.isOnline ? 'online' : 'offline'} me-2`}>
                                  <img
                                    src={getUserAvatar(chatUser.user)}
                                    className="rounded-circle"
                                    alt="image"
                                    onError={onAvatarError}
                                  />
                                </div>
                                <div className="chat-user-info">
                                  <div className="chat-user-msg">
                                    <h6 style={{ 
                                      fontWeight: chatUser.unreadCount > 0 ? 'bold' : 'normal',
                                      color: chatUser.unreadCount > 0 ? '#333' : '#666'
                                    }}>
                                      {getUserDisplayName(chatUser.user)}
                                    </h6>
                                    <p style={{ 
                                      fontWeight: chatUser.unreadCount > 0 ? '500' : 'normal',
                                      color: chatUser.unreadCount > 0 ? '#555' : '#888',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '220px'
                                    }}>
                                      <span className={chatUser.isOnline && !chatUser.lastMessage ? "text-success" : "text-muted"}>
                                        {getChatListPreview(chatUser)}
                                      </span>
                                    </p>
                                  </div>
                                  <div className="chat-user-time">
                                    <span className="time" style={{ fontSize: '12px' }}>
                                      {getChatListTime(chatUser)}
                                    </span>
                                    {chatUser.unreadCount > 0 && (
                                      <div className="badge bg-primary rounded-pill" style={{
                                        fontSize: '11px',
                                        minWidth: '18px',
                                        height: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginTop: '4px'
                                      }}>
                                        {chatUser.unreadCount > 99 ? '99+' : chatUser.unreadCount}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            </div>
                          ))
                        ) : (
                          <div className="text-center p-3">
                            <p className="text-muted">
                              {searchTerm ? 'No users found matching your search.' : 'No users available.'}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-top">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="mb-0">Recent Calls</h6>
                          <button
                            type="button"
                            className="btn btn-sm btn-light"
                            onClick={loadCallHistory}
                            disabled={loadingCallHistory}
                          >
                            <i className="ti ti-refresh"></i>
                          </button>
                        </div>
                        {loadingCallHistory ? (
                          <small className="text-muted">Loading call history...</small>
                        ) : callHistory.length === 0 ? (
                          <small className="text-muted">No call history yet</small>
                        ) : (
                          <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                            {callHistory.slice(0, 8).map((call) => {
                              const otherUser = getCallOtherUser(call);
                              return (
                                <div
                                  key={call._id}
                                  className="d-flex align-items-center justify-content-between py-1"
                                >
                                  <div
                                    className="d-flex align-items-center"
                                    style={{ cursor: otherUser ? "pointer" : "default" }}
                                    onClick={() => {
                                      if (otherUser) handleUserSelect(otherUser);
                                    }}
                                  >
                                    <span className="me-2">
                                      <i
                                        className={`ti ${
                                          call.status === "missed"
                                            ? "ti-phone-off text-danger"
                                            : "ti-phone-call text-success"
                                        }`}
                                      />
                                    </span>
                                    <small className="text-truncate" style={{ maxWidth: "140px" }}>
                                      {otherUser ? getUserDisplayName(otherUser) : "Unknown user"}
                                    </small>
                                  </div>
                                  <small className="text-muted ms-2">{formatCallDuration(call.duration)}</small>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Scrollbars>
              </div>
            </div>
            {/* /Chats sidebar */}

            {/* Chat */}
            <div className="chat chat-messages" id="middle">
              <div className="slimscroll">
                <Scrollbars>
                  <div className="chat-header">
                    <div className="user-details">
                      <div className="d-lg-flex">
                        <div className="avatar avatar-lg online me-2">
                          <img
                            src={getUserAvatar(selectedUser)}
                            className="rounded-circle"
                            alt="image"
                            onError={onAvatarError}
                          />
                        </div>
                        <div className="mt-1">
                          {/* Socket Connection Status */}
                          <div className="d-flex align-items-center mb-1">
                            <div className={`connection-indicator me-2 ${socketConnected ? 'connected' : socketReconnecting ? 'reconnecting' : 'disconnected'}`}>
                              <i className={`ti ${socketConnected ? 'ti-wifi' : socketReconnecting ? 'ti-loader' : 'ti-wifi-off'}`}></i>
                            </div>
                            <small className={`text-${socketConnected ? 'success' : socketReconnecting ? 'warning' : 'danger'}`}>
                              {socketConnected ? 'Connected' : socketReconnecting ? 'Reconnecting...' : 'Disconnected'}
                            </small>
                            {!socketConnected && !socketReconnecting && (
                              <div className="d-flex gap-2">
                                <button 
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    if (token) {
                                      try {
                                        setModalMessage('Reconnecting...');
                                        setModalType('info');
                                        await ChatService.connect(token);
                                        setModalMessage('Socket reconnected successfully');
                                        setModalType('success');
                                      } catch (error) {
                                        console.error('Reconnection failed:', error);
                                        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                                        setModalMessage(`Failed to reconnect socket: ${errorMessage}`);
                                        setModalType('error');
                                      }
                                    } else {
                                      setModalMessage('No authentication token found. Please log in again.');
                                      setModalType('error');
                                    }
                                  }}
                                >
                                  <i className="ti ti-refresh"></i> Reconnect
                                </button>
                                <button 
                                  className="btn btn-sm btn-outline-info"
                                  onClick={() => {
                                    const token = localStorage.getItem('token');
                                    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
                                    const diagnosticInfo = `
Diagnostic Information:
- Backend URL: ${baseURL}
- Token: ${token ? 'Present' : 'Missing'}
- Socket Status: ${ChatService.getConnectionStatus()}
- Socket Connected: ${ChatService.isConnected()}
- Current Time: ${new Date().toISOString()}
                                    `;
                                    console.log(diagnosticInfo);
                                    setModalMessage('Diagnostic information logged to console. Please check browser console.');
                                    setModalType('info');
                                  }}
                                >
                                  <i className="ti ti-bug"></i> Debug
                                </button>
                              </div>
                            )}
                          </div>
                          <h6>{getUserDisplayName(selectedUser)}</h6>
                          <p className="last-seen">
                            {selectedUser ? (
                              chatUsers.find(cu => cu.user._id === selectedUser._id)?.isOnline ? (
                                <span className="text-success">Online</span>
                              ) : (
                                <span>Last Seen {formatLastSeen(chatUsers.find(cu => cu.user._id === selectedUser._id)?.lastSeen)}</span>
                              )
                            ) : (
                              'Select a user to start chatting'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="chat-options">
                      <ul>
                        <li>
                          <button 
                            className="btn" 
                            type="button"
                            onClick={handleMessageSearch}
                            style={{ 
                              background: showMessageSearch ? '#e3f2fd' : 'transparent',
                              color: showMessageSearch ? '#2563eb' : 'inherit'
                            }}
                          >
                            <i className="ti ti-search" />
                          </button>
                        </li>
                        {selectedUser && !isInCall && (
                          <li>
                            <button 
                              className="btn" 
                              type="button"
                              onClick={handleInitiateCall}
                              disabled={!socketConnected}
                              style={{ 
                                background: 'transparent',
                                color: socketConnected ? '#28a745' : '#6c757d',
                                cursor: socketConnected ? 'pointer' : 'not-allowed'
                              }}
                              title="Start Voice Call"
                            >
                              <i className="ti ti-phone" />
                            </button>
                          </li>
                        )}
                        <li className="dropdown">
                          <Link
                            to="#"
                            className="dropdown-toggle btn"
                            data-bs-toggle="dropdown"
                          >
                            <i className="ti ti-dots-vertical" />
                          </Link>
                          <div className="dropdown-menu dropdown-menu-end p-3">
                            <button 
                              type="button" 
                              className="dropdown-item" 
                              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                              onClick={handleViewProfile}
                            >
                              <i className="ti ti-user-check me-2" />
                              View Profile
                            </button>
                            <button 
                              type="button" 
                              className="dropdown-item" 
                              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                              onClick={handleAddToGroup}
                            >
                              <i className="ti ti-users me-2" />
                              Add to Group
                            </button>
                            <button 
                              type="button" 
                              className="dropdown-item" 
                              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                              onClick={handleBlockUser}
                            >
                              <i className="ti ti-ban me-2" />
                              Block
                            </button>
                            {blockedUsers.length > 0 && (
                              <button 
                                type="button" 
                                className="dropdown-item" 
                                style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                                onClick={() => setShowUnblockModal(true)}
                              >
                                <i className="ti ti-user-plus me-2" />
                                Unblock Users
                              </button>
                            )}
                            <button 
                              type="button" 
                              className="dropdown-item" 
                              style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                              onClick={handleDeleteConversation}
                            >
                              <i className="ti ti-trash me-2" />
                              Delete
                            </button>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Message Search Bar */}
                  {showMessageSearch && (
                    <div style={{
                      padding: '10px 15px',
                      borderBottom: '1px solid #e4e7ea',
                      backgroundColor: '#f8f9fa'
                    }}>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search in messages..."
                          value={messageSearchTerm}
                          onChange={(e) => setMessageSearchTerm(e.target.value)}
                          style={{
                            border: '1px solid #ddd',
                            borderRadius: '20px',
                            padding: '8px 15px'
                          }}
                        />
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => setMessageSearchTerm("")}
                          style={{
                            borderRadius: '0 20px 20px 0',
                            border: '1px solid #ddd',
                            marginLeft: '-1px'
                          }}
                        >
                          <i className="ti ti-x" />
                        </button>
                      </div>
                      {messageSearchTerm && (
                        <small className="text-muted mt-1 d-block">
                          Found {filteredMessages.length} message(s)
                        </small>
                      )}
                    </div>
                  )}
                  
                  <div className="chat-body slimscroll">
                    <div className="messages">
                      {selectedUser ? (
                        filteredMessages.length > 0 ? (
                          filteredMessages.filter(message => message && message._id).map((message) => {
                            const isOwnMessage = String(message.senderId._id) === currentUserId;
                            return (
                            <div
                              key={message._id}
                              className={`chats ${isOwnMessage ? 'chats-right' : ''}`}
                            >
                              <div className="chat-avatar">
                                <img
                                  src={isOwnMessage
                                    ? getUserAvatar(currentUser as any)
                                    : getUserAvatar({
                                        _id: message.senderId._id,
                                        email: message.senderId.email,
                                        firstName: message.senderId.firstName,
                                        lastName: message.senderId.lastName,
                                        avatar: message.senderId.avatar,
                                        profilePhoto: message.senderId.profilePhoto,
                                        role: (chatUsers.find(cu => cu.user._id === message.senderId._id)?.user?.role || 'USER') as User['role']
                                      } as User)
                                  }
                                  className="rounded-circle dreams_chat"
                                  alt="image"
                                  onError={onAvatarError}
                                />
                              </div>
                              <div
                                className="chat-content"
                                style={{
                                  backgroundColor: '#f3f4f6',
                                  color: '#111827',
                                  border: 'none',
                                  outline: 'none',
                                  boxShadow: 'none'
                                }}
                              >
                                <div className="chat-profile-name">
                                  <h6 style={{ color: '#111827' }}>
                                    {isOwnMessage ? 
                                      'You' : 
                                      getUserDisplayName({
                                        _id: message.senderId._id,
                                        email: message.senderId.email,
                                        firstName: message.senderId.firstName,
                                        lastName: message.senderId.lastName,
                                        role: (chatUsers.find(cu => cu.user._id === message.senderId._id)?.user?.role || 'USER') as User['role']
                                      } as User)
                                    }
                                    <span style={{ color: '#6b7280' }}>
                                      {formatTimestamp(new Date(message.createdAt))}
                                    </span>
                                    {/* Message Status Indicator */}
                                    {isOwnMessage && (
                                      <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                                        {message.deliveryStatus === 'sent' && (
                                          <i className="ti ti-check" style={{ color: '#6b7280' }} title="Sent"></i>
                                        )}
                                        {message.deliveryStatus === 'delivered' && (
                                          <i className="ti ti-checks" style={{ color: '#2563eb' }} title="Delivered"></i>
                                        )}
                                        {message.deliveryStatus === 'read' && (
                                          <i className="ti ti-checks" style={{ color: '#10b981' }} title="Read"></i>
                                        )}
                                      </span>
                                    )}
                                  </h6>
                                </div>
                                <div className="message-content" style={{ color: '#111827', opacity: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {message.messageType === 'text' && (
                                    messageSearchTerm ? 
                                      highlightSearchTerm(message.content?.text || 'Message content unavailable', messageSearchTerm) :
                                      (message.content?.text || 'Message content unavailable')
                                  )}
                                  {message.messageType === 'emoji' && message.content?.emoji}
                                  {message.messageType === 'file' && (
                                    messageSearchTerm ?
                                      highlightSearchTerm(
                                        message.content?.text || 
                                        (message.attachments && message.attachments.length > 0 ? 
                                          `Shared ${message.attachments[0].type}: ${message.attachments[0].fileName}` : 
                                          'Shared a file'
                                        ),
                                        messageSearchTerm
                                      ) :
                                      (message.content?.text || 
                                        (message.attachments && message.attachments.length > 0 ? 
                                          `Shared ${message.attachments[0].type}: ${message.attachments[0].fileName}` : 
                                          'Shared a file'
                                        )
                                      )
                                  )}
                                  {message.attachments && message.attachments.length > 0 && message.attachments.map((attachment, index) => (
                                    <div key={index}>
                                      {attachment.type === 'image' && (
                                        <div style={{ position: 'relative' }}>
                                          <img 
                                            src={`http://localhost:5000${attachment.filePath}`}
                                            alt={attachment.fileName}
                                            style={{ 
                                              maxWidth: '200px', 
                                              maxHeight: '200px', 
                                              borderRadius: '8px',
                                              display: 'block'
                                            }}
                                          />
                                          <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            marginTop: '5px'
                                          }}>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#4b5563', flex: 1 }}>
                                              {attachment.fileName}
                                            </p>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                              {/* Download Button */}
                                              <button
                                                onClick={() => handleFileDownload(`http://localhost:5000${attachment.filePath}`, attachment.fileName)}
                                                style={{
                                                  background: 'rgba(37, 99, 235, 0.1)',
                                                  border: '1px solid rgba(37, 99, 235, 0.2)',
                                                  borderRadius: '4px',
                                                  padding: '4px 8px',
                                                  cursor: 'pointer',
                                                  color: '#2563eb',
                                                  fontSize: '12px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '3px'
                                                }}
                                                title="Download image"
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.2)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'}
                                              >
                                                <i className="ti ti-download" style={{ fontSize: '14px' }}></i>
                                                <span>Download</span>
                                              </button>
                                              
                                              {/* Transfer/Share Button */}
                                              <button
                                                onClick={() => handleImageTransfer(`http://localhost:5000${attachment.filePath}`, attachment.fileName)}
                                                style={{
                                                  background: 'rgba(16, 185, 129, 0.1)',
                                                  border: '1px solid rgba(16, 185, 129, 0.2)',
                                                  borderRadius: '4px',
                                                  padding: '4px 8px',
                                                  cursor: 'pointer',
                                                  color: '#10b981',
                                                  fontSize: '12px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '3px'
                                                }}
                                                title="Share image"
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                                              >
                                                <i className="ti ti-share" style={{ fontSize: '14px' }}></i>
                                                <span>Share</span>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {attachment.type === 'file' && (
                                        <div style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'space-between',
                                          padding: '10px', 
                                          backgroundColor: '#f0f0f0', 
                                          borderRadius: '8px',
                                          maxWidth: '250px'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <i className="ti ti-file-text" style={{ fontSize: '24px', marginRight: '10px', color: '#374151' }}></i>
                                            <div>
                                              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>{attachment.fileName}</p>
                                              <p style={{ margin: 0, fontSize: '12px', color: '#4b5563' }}>File ({(attachment.fileSize / 1024).toFixed(1)} KB)</p>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleFileDownload(`http://localhost:5000${attachment.filePath}`, attachment.fileName)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              padding: '5px',
                                              borderRadius: '4px',
                                              color: '#2563eb'
                                            }}
                                            title="Download file"
                                          >
                                            <i className="ti ti-download" style={{ fontSize: '18px' }}></i>
                                          </button>
                                        </div>
                                      )}
                                      {attachment.type === 'voice' && (
                                        <div style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          padding: '10px', 
                                          backgroundColor: '#e3f2fd', 
                                          borderRadius: '8px',
                                          maxWidth: '200px'
                                        }}>
                                          <button
                                            onClick={() => handleAudioPlayback(message._id, `http://localhost:5000${attachment.filePath}`)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              marginRight: '10px',
                                              color: '#2563eb',
                                              fontSize: '24px'
                                            }}
                                            title={playingAudio === message._id ? 'Pause' : 'Play'}
                                          >
                                            <i className={playingAudio === message._id ? "ti ti-player-pause" : "ti ti-player-play"}></i>
                                          </button>
                                          <div>
                                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>Voice Message</p>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                                              {attachment.duration ? `${Math.floor(attachment.duration / 60)}:${(attachment.duration % 60).toString().padStart(2, '0')}` : 'Audio recording'}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                          })
                        ) : (
                          <div className="text-center p-4">
                            {messageSearchTerm ? (
                              // No search results
                              <>
                                <div style={{ marginBottom: '20px' }}>
                                  <i className="ti ti-search-off" style={{ fontSize: '48px', color: '#ddd' }}></i>
                                </div>
                                <h5 style={{ color: '#666', marginBottom: '10px' }}>No messages found</h5>
                                <p className="text-muted">
                                  No messages match your search for "{messageSearchTerm}"
                                </p>
                                <button 
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => setMessageSearchTerm("")}
                                >
                                  Clear search
                                </button>
                              </>
                            ) : (
                              // No messages at all
                              <>
                                <div style={{ marginBottom: '20px' }}>
                                  <i className="ti ti-message-circle" style={{ fontSize: '48px', color: '#ddd' }}></i>
                                </div>
                                <h5 style={{ color: '#666', marginBottom: '10px' }}>Start a conversation</h5>
                                <p className="text-muted">
                                  Send a message to {getUserDisplayName(selectedUser)} to begin your chat!
                                </p>
                              </>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="text-center p-4">
                          <p className="text-muted">Select a user to start chatting</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Scrollbars>
              </div>
              
              {/* Chat Footer */}
              <div className="chat-footer">
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '15px',
                  backgroundColor: '#fff',
                  borderTop: '1px solid #e4e7ea'
                }}>
                  <div className="smile-foot" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    
                    
                    {/* Emoji Button */}
                    <div className="smile-foot-emoj" style={{ position: 'relative' }}>
                      <button 
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                        disabled={isSending}
                        style={{
                          width: '38px',
                          height: '38px',
                          backgroundColor: showEmojiPicker ? '#e3f2fd' : '#f8f9fa',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          cursor: isSending ? 'not-allowed' : 'pointer',
                          color: showEmojiPicker ? '#2563eb' : '#666',
                          opacity: isSending ? 0.5 : 1
                        }}
                      >
                        <i className="ti ti-mood-smile" />
                      </button>
                      
                      {/* Simple Emoji Picker */}
                      {showEmojiPicker && !isSending && (
                        <div 
                          ref={emojiPickerRef}
                          style={{
                            position: 'absolute',
                            bottom: '50px',
                            left: '0',
                            backgroundColor: '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            padding: '10px',
                            zIndex: 1000,
                            minWidth: '200px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px' }}>
                            {['😀', '😊', '😂', '🥰', '😍', '🤔', '😎', '👍', '👏', '🎉', '❤️', '💯'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleEmojiSelect(emoji)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  fontSize: '20px',
                                  cursor: 'pointer',
                                  padding: '5px',
                                  borderRadius: '4px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Voice Recording Button */}
                    <div className="smile-foot-box">
                      {isRecording ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: '#ff4444',
                          borderRadius: '20px',
                          padding: '8px 12px',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: 'bold'
                        }}>
                          <i className="ti ti-microphone" style={{ marginRight: '8px' }}></i>
                          Recording... {getRecordingDuration()}
                          <button 
                            type="button"
                            onClick={handleVoiceRecording}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              marginLeft: '8px',
                              padding: '2px',
                              borderRadius: '2px'
                            }}
                            title="Stop recording"
                          >
                            <i className="ti ti-square" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={handleVoiceRecording}
                          disabled={!selectedUser || isSending}
                          style={{
                            width: '38px',
                            height: '38px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: (selectedUser && !isSending) ? 'pointer' : 'not-allowed',
                            color: '#666',
                            opacity: (!selectedUser || isSending) ? 0.5 : 1
                          }}
                          title="Record voice message"
                        >
                          <i className="ti ti-microphone" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="chat-action-btns">
                      <div className="chat-action-col">
                        <button
                          type="button"
                          className="action-circle"
                          data-bs-toggle="dropdown"
                          disabled={isSending}
                          style={{
                            width: '38px',
                            height: '38px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: 'none',
                            cursor: isSending ? 'not-allowed' : 'pointer',
                            color: '#666',
                            opacity: isSending ? 0.5 : 1
                          }}
                        >
                          <i className="ti ti-plus" />
                        </button>
                        <div className="dropdown-menu dropdown-menu-end p-3">
                          <label className="dropdown-item" style={{ cursor: 'pointer' }}>
                            <i className="ti ti-file-text me-2" />
                            Document
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.txt"
                              onChange={handleFileUpload}
                              style={{ display: 'none' }}
                              disabled={isSending}
                            />
                          </label>
                          <label className="dropdown-item" style={{ cursor: 'pointer' }}>
                            <i className="ti ti-photo-up me-2" />
                            Gallery
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              style={{ display: 'none' }}
                              disabled={isSending}
                            />
                          </label>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={!selectedUser || isSending}
                          >
                            <i className="ti ti-camera-selfie me-2" />
                            Camera
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                            onClick={() => audioInputRef.current?.click()}
                            disabled={!selectedUser || isSending}
                          >
                            <i className="ti ti-music me-2" />
                            Audio
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                            onClick={() => handleShareLocation()}
                            disabled={!selectedUser || isSending}
                          >
                            <i className="ti ti-map-pin-share me-2" />
                            Location
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
                            onClick={() => setShowContactPicker(true)}
                            disabled={!selectedUser || isSending}
                          >
                            <i className="ti ti-user-check me-2" />
                            Contact
                          </button>
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                            disabled={isSending}
                          />
                          <input
                            ref={audioInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioUpload}
                            style={{ display: 'none' }}
                            disabled={isSending}
                          />
                        </div>
                      </div>
                    </div>
                  
                  <div className="smile-foot-text" style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="form-control chat_form"
                      placeholder={isSending ? "Sending..." : "Type your message here..."}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={!selectedUser || isSending}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '25px',
                        padding: '10px 15px',
                        width: '100%',
                        opacity: isSending ? 0.7 : 1
                      }}
                    />
                  </div>
                  
                  <div className="form-btn">
                    <button 
                      className="btn btn-primary" 
                      type="submit"
                      disabled={!selectedUser || !newMessage.trim() || isSending}
                      style={{
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        backgroundColor: (!selectedUser || !newMessage.trim() || isSending) ? '#ccc' : '#2563eb',
                        cursor: (!selectedUser || !newMessage.trim() || isSending) ? 'not-allowed' : 'pointer'
                      }}
                      title={isSending ? 'Sending...' : 'Send message'}
                    >
                      {isSending ? (
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid #fff',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                      ) : (
                        <i className="ti ti-send" />
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            {/* /Chat */}
          </div>
        </div>
      </div>
      
      {/* Profile Modal */}
      {showProfileModal && selectedUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">User Profile</h5>
                <button type="button" className="btn-close" onClick={() => setShowProfileModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="text-center mb-3">
                  <img 
                    src={getUserAvatar(selectedUser)} 
                    alt="Profile" 
                    className="rounded-circle" 
                    style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                    onError={onAvatarError}
                  />
                </div>
                <div className="row">
                  <div className="col-12 mb-2">
                    <strong>👤 Name:</strong> {getUserDisplayName(selectedUser)}
                  </div>
                  <div className="col-12 mb-2">
                    <strong>📧 Email:</strong> {selectedUser.email}
                  </div>
                  <div className="col-12 mb-2">
                    <strong>🏷️ Role:</strong> {selectedUser.role}
                  </div>
                  {selectedUser.phone && (
                    <div className="col-12 mb-2">
                      <strong>📞 Phone:</strong> {selectedUser.phone}
                    </div>
                  )}
                  {selectedUser.country && (
                    <div className="col-12 mb-2">
                      <strong>🌍 Country:</strong> {selectedUser.country}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && selectedUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add to Group</h5>
                <button type="button" className="btn-close" onClick={() => setShowGroupModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Add <strong>{getUserDisplayName(selectedUser)}</strong> to group:</p>
                <div className="list-group">
                  {['Development Team', 'Marketing Team', 'HR Team', 'Management'].map((group, index) => (
                    <button 
                      key={index}
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        setModalMessage(`✅ Added ${getUserDisplayName(selectedUser)} to ${group}`);
                        setModalType('success');
                        setShowGroupModal(false);
                      }}
                    >
                      {group}
                    </button>
                  ))}
                  <button 
                    className="list-group-item list-group-item-action text-primary"
                    onClick={() => {
                      const groupName = prompt('Enter new group name:');
                      if (groupName && groupName.trim()) {
                        setModalMessage(`✅ Created new group "${groupName.trim()}" and added ${getUserDisplayName(selectedUser)}`);
                        setModalType('success');
                        setShowGroupModal(false);
                      }
                    }}
                  >
                    <i className="ti ti-plus me-2"></i>Create New Group...
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {showBlockModal && selectedUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Block User</h5>
                <button type="button" className="btn-close" onClick={() => setShowBlockModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to block <strong>{getUserDisplayName(selectedUser)}</strong>?</p>
                <div className="alert alert-warning">
                  <strong>This action will:</strong>
                  <ul className="mb-0 mt-2">
                    <li>Hide their messages from your chat list</li>
                    <li>Prevent them from sending you new messages</li>
                    <li>Remove this conversation from your active chats</li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBlockModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmBlockUser}>
                  Block User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Users Modal */}
      {showUnblockModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Blocked Users</h5>
                <button type="button" className="btn-close" onClick={() => setShowUnblockModal(false)}></button>
              </div>
              <div className="modal-body">
                {blockedUsers.length > 0 ? (
                  <div className="list-group">
                    {blockedUsers.map((user) => (
                      <div key={user._id} className="list-group-item d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center">
                          <img 
                            src={getUserAvatar(user)} 
                            alt="Profile" 
                            className="rounded-circle me-3" 
                            style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                            onError={onAvatarError}
                          />
                          <div>
                            <strong>{getUserDisplayName(user)}</strong>
                            <br />
                            <small className="text-muted">{user.email}</small>
                          </div>
                        </div>
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleUnblockUser(user)}
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">No blocked users</p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUnblockModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Share Contact</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowContactPicker(false);
                    setContactSearch("");
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Search EXPERT or STARTUP profile"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
                {suggestedContacts.length === 0 ? (
                  <p className="text-muted mb-0">No suggested contacts found.</p>
                ) : (
                  <div className="list-group">
                    {suggestedContacts.map((u) => (
                      <button
                        key={u._id}
                        type="button"
                        className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
                        onClick={() => handleSendContact(u)}
                      >
                        <span className="d-flex align-items-center">
                          <img
                            src={getUserAvatar(u)}
                            alt="contact"
                            className="rounded-circle me-2"
                            style={{ width: "30px", height: "30px", objectFit: "cover" }}
                            onError={onAvatarError}
                          />
                          {getUserDisplayName(u)}
                        </span>
                        <span className="badge bg-light text-dark">{u.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowContactPicker(false);
                    setContactSearch("");
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Conversation</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete your conversation with <strong>{getUserDisplayName(selectedUser)}</strong>?</p>
                <div className="alert alert-danger">
                  <strong>Warning:</strong>
                  <ul className="mb-0 mt-2">
                    <li>This will permanently delete all messages in this conversation</li>
                    <li>The conversation will be removed from your chat list</li>
                    <li>This action cannot be undone!</li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDeleteConversation}>
                  Delete Conversation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error/Info Toast */}
      {modalMessage && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
          <div className={`alert alert-${modalType === 'success' ? 'success' : modalType === 'error' ? 'danger' : 'info'} alert-dismissible fade show`}>
            {modalMessage}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setModalMessage("")}
            ></button>
          </div>
        </div>
      )}

      {/* Voice Call Modal */}
      {showVoiceCallModal && currentCall && (
        <VoiceCallModal
          show={showVoiceCallModal}
          onHide={() => setShowVoiceCallModal(false)}
          call={currentCall}
          currentUserId={currentUser?._id || ''}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onEnd={handleEndCall}
        />
      )}

      {/* /Page Wrapper */}
    </>
  );
};

export default Chat;
