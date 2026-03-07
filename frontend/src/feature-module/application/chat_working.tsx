import React, { useEffect, useState, useRef } from "react";
import Scrollbars from "react-custom-scrollbars-2";
import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import "react-modal-video/scss/modal-video.scss";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import UserService from "../../services/userService";
import { useAuth } from "../../contexts/AuthContext";

interface User {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  role: 'STARTUP' | 'ADMIN' | 'USER' | 'MANAGER';
  phone?: string;
  country?: string;
  position?: string;
  avatar?: string;
  profilePhoto?: string;
}

interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'audio';
  fileUrl?: string;
  fileName?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface ChatUser {
  user: User;
  lastMessage?: Message;
  unreadCount: number;
  isOnline: boolean;
  lastSeen: Date;
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
  
  // State management
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

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

  // Get user avatar or default
  const getUserAvatar = (user: User | null): string => {
    if (!user) return 'assets/img/profiles/avatar-29.jpg';
    
    if (user.avatar) {
      return user.avatar.startsWith('http') ? user.avatar : `http://localhost:5000${user.avatar}`;
    }
    if (user.profilePhoto) {
      return user.profilePhoto.startsWith('http') ? user.profilePhoto : `http://localhost:5000${user.profilePhoto}`;
    }
    return 'assets/img/profiles/avatar-29.jpg';
  };

  // Get user display name
  const getUserDisplayName = (user: User | null): string => {
    if (!user) return 'Select a user';
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email.split('@')[0];
  };

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
              email: 'bob.wilson@example.com',
              firstName: 'Bob',
              lastName: 'Wilson',
              username: 'bobwilson',
              role: 'ADMIN',
              phone: '+1234567892',
              country: 'UK'
            }
          ];
          
          const chatUsersData: ChatUser[] = mockUsers.map((user: User) => ({
            user,
            unreadCount: 0,
            isOnline: Math.random() > 0.5,
            lastSeen: new Date(Date.now() - Math.random() * 86400000)
          }));
          
          setChatUsers(chatUsersData);
          setLoading(false);
          return;
        }

        // Fetch all users for chat list if authenticated
        try {
          const allUsers = await UserService.getAllUsers();
          
          const chatUsersData: ChatUser[] = allUsers.map((user: User) => ({
            user,
            unreadCount: 0,
            isOnline: Math.random() > 0.5,
            lastSeen: new Date(Date.now() - Math.random() * 86400000)
          }));
          
          setChatUsers(chatUsersData);
        } catch (error) {
          console.error('Error fetching users from API, using mock data:', error);
          // Fallback to mock data if API fails
          const mockUsers: User[] = [
            {
              _id: '1',
              email: 'john.doe@example.com',
              firstName: 'John',
              lastName: 'Doe',
              username: 'johndoe',
              role: 'USER'
            }
          ];
          
          const chatUsersData: ChatUser[] = mockUsers.map((user: User) => ({
            user,
            unreadCount: 0,
            isOnline: Math.random() > 0.5,
            lastSeen: new Date(Date.now() - Math.random() * 86400000)
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
  }, []);

  // Load messages for selected user
  const loadMessagesForUser = React.useCallback(async (userId: string) => {
    // Start with empty messages - completely dynamic
    setMessages([]);
  }, []);

  // Load messages for selected user
  useEffect(() => {
    if (selectedUser) {
      loadMessagesForUser(selectedUser._id);
    }
  }, [selectedUser, loadMessagesForUser]);

  // Filter chat users based on search term
  const filteredChatUsers = chatUsers.filter(chatUser => 
    getUserDisplayName(chatUser.user).toLowerCase().includes(searchTerm.toLowerCase()) ||
    chatUser.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle user selection for chat
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    sessionStorage.setItem('selectedChatUser', JSON.stringify(user));
  };

  // Handle sending new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUser || isSending) return;

    setIsSending(true);

    const tempMessage: Message = {
      _id: Date.now().toString(),
      senderId: currentUser.id,
      receiverId: selectedUser._id,
      content: newMessage,
      timestamp: new Date(),
      type: 'text',
      status: 'sending'
    };

    // Add message with "sending" status
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage("");

    // Simulate sending delay
    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempMessage._id 
            ? { ...msg, status: 'sent' as const }
            : msg
        )
      );
      
      // Simulate delivery after a short delay
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === tempMessage._id 
              ? { ...msg, status: 'delivered' as const }
              : msg
          )
        );
        setIsSending(false);
      }, 500);
    }, 1000);
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !currentUser || isSending) return;

    setIsSending(true);

    const tempMessage: Message = {
      _id: Date.now().toString(),
      senderId: currentUser.id,
      receiverId: selectedUser._id,
      content: `Shared a file: ${file.name}`,
      timestamp: new Date(),
      type: 'file',
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      status: 'sending'
    };

    setMessages(prev => [...prev, tempMessage]);
    event.target.value = '';

    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempMessage._id 
            ? { ...msg, status: 'sent' as const }
            : msg
        )
      );
      
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === tempMessage._id 
              ? { ...msg, status: 'delivered' as const }
              : msg
          )
        );
        setIsSending(false);
      }, 500);
    }, 2000);
  };

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser || !currentUser || isSending) return;

    setIsSending(true);

    const tempMessage: Message = {
      _id: Date.now().toString(),
      senderId: currentUser.id,
      receiverId: selectedUser._id,
      content: `Shared an image: ${file.name}`,
      timestamp: new Date(),
      type: 'image',
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      status: 'sending'
    };

    setMessages(prev => [...prev, tempMessage]);
    event.target.value = '';

    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg._id === tempMessage._id 
            ? { ...msg, status: 'sent' as const }
            : msg
        )
      );
      
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg._id === tempMessage._id 
              ? { ...msg, status: 'delivered' as const }
              : msg
          )
        );
        setIsSending(false);
      }, 500);
    }, 1500);
  };

  // Handle voice recording
  const handleVoiceRecording = () => {
    if (!selectedUser || !currentUser || isSending) return;

    if (!isRecording) {
      setIsRecording(true);
      console.log('Starting voice recording...');
      
      setTimeout(() => {
        setIsRecording(false);
        setIsSending(true);
        
        const tempMessage: Message = {
          _id: Date.now().toString(),
          senderId: currentUser.id,
          receiverId: selectedUser._id,
          content: 'Voice message',
          timestamp: new Date(),
          type: 'audio',
          fileName: 'voice_recording.mp3',
          status: 'sending'
        };

        setMessages(prev => [...prev, tempMessage]);

        setTimeout(() => {
          setMessages(prev => 
            prev.map(msg => 
              msg._id === tempMessage._id 
                ? { ...msg, status: 'sent' as const }
                : msg
            )
          );
          
          setTimeout(() => {
            setMessages(prev => 
              prev.map(msg => 
                msg._id === tempMessage._id 
                  ? { ...msg, status: 'delivered' as const }
                  : msg
              )
            );
            setIsSending(false);
          }, 500);
        }, 1000);
      }, 3000);
    } else {
      setIsRecording(false);
      console.log('Stopping voice recording...');
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
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
        alert('Image URL copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      // Additional fallback: create a sharing modal or copy URL
      const shareText = `Check out this image: ${imageUrl}`;
      await navigator.clipboard.writeText(shareText);
      alert('Image link copied to clipboard!');
    }
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
  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <>
      {/* Loading Animation Styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
                                  <ImageWithBasePath
                                    src={getUserAvatar(chatUser.user)}
                                    className="rounded-circle"
                                    alt="image"
                                  />
                                </div>
                                <div className="chat-user-info">
                                  <div className="chat-user-msg">
                                    <h6>{getUserDisplayName(chatUser.user)}</h6>
                                    <p>
                                      {chatUser.isOnline ? (
                                        <span className="text-success">Online</span>
                                      ) : (
                                        <span className="text-muted">
                                          Last seen {formatLastSeen(chatUser.lastSeen)}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <div className="chat-user-time">
                                    <span className="time">
                                      {formatLastSeen(chatUser.lastSeen)}
                                    </span>
                                    {chatUser.unreadCount > 0 && (
                                      <div className="badge bg-primary rounded-pill">
                                        {chatUser.unreadCount}
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
                          <ImageWithBasePath
                            src={getUserAvatar(selectedUser)}
                            className="rounded-circle"
                            alt="image"
                          />
                        </div>
                        <div className="mt-1">
                          <h6>{getUserDisplayName(selectedUser)}</h6>
                          <p className="last-seen">
                            {selectedUser ? (
                              chatUsers.find(cu => cu.user._id === selectedUser._id)?.isOnline ? (
                                <span className="text-success">Online</span>
                              ) : (
                                <span>Last Seen at {formatLastSeen(new Date())}</span>
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
                          <Link className="btn" to="#">
                            <i className="ti ti-search" />
                          </Link>
                        </li>
                        <li className="dropdown">
                          <Link
                            to="#"
                            className="dropdown-toggle btn"
                            data-bs-toggle="dropdown"
                          >
                            <i className="ti ti-dots-vertical" />
                          </Link>
                          <div className="dropdown-menu dropdown-menu-end p-3">
                            <Link to="#" className="dropdown-item">
                              <i className="ti ti-user-check me-2" />
                              View Profile
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <i className="ti ti-users me-2" />
                              Add to Group
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <i className="ti ti-ban me-2" />
                              Block
                            </Link>
                            <Link to="#" className="dropdown-item">
                              <i className="ti ti-trash me-2" />
                              Delete
                            </Link>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="chat-body slimscroll">
                    <div className="messages">
                      {selectedUser ? (
                        messages.length > 0 ? (
                          messages.map((message) => (
                            <div
                              key={message._id}
                              className={`chats ${message.senderId === currentUser?.id ? 'chats-right' : ''}`}
                              style={{ 
                                opacity: message.status === 'sending' ? 0.7 : 1,
                                transition: 'opacity 0.3s ease'
                              }}
                            >
                              <div className="chat-avatar">
                                <ImageWithBasePath
                                  src={message.senderId === currentUser?.id ? 
                                    getUserAvatar(currentUser as any) : 
                                    getUserAvatar(selectedUser)
                                  }
                                  className="rounded-circle dreams_chat"
                                  alt="image"
                                />
                              </div>
                              <div className="chat-content">
                                <div className="chat-profile-name">
                                  <h6>
                                    {message.senderId === currentUser?.id ? 
                                      'You' : 
                                      getUserDisplayName(selectedUser)
                                    }
                                    <span>{formatTimestamp(message.timestamp)}</span>
                                    {/* Message Status Indicator */}
                                    {message.senderId === currentUser?.id && (
                                      <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                                        {message.status === 'sending' && (
                                          <i className="ti ti-clock" style={{ color: '#999' }} title="Sending..."></i>
                                        )}
                                        {message.status === 'sent' && (
                                          <i className="ti ti-check" style={{ color: '#666' }} title="Sent"></i>
                                        )}
                                        {message.status === 'delivered' && (
                                          <i className="ti ti-checks" style={{ color: '#2563eb' }} title="Delivered"></i>
                                        )}
                                        {message.status === 'read' && (
                                          <i className="ti ti-checks" style={{ color: '#10b981' }} title="Read"></i>
                                        )}
                                      </span>
                                    )}
                                  </h6>
                                </div>
                                <div className="message-content">
                                  {message.type === 'text' && message.content}
                                  {message.type === 'image' && (
                                    <div style={{ position: 'relative' }}>
                                      <img 
                                        src={message.fileUrl} 
                                        alt={message.fileName}
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
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666', flex: 1 }}>
                                          {message.fileName}
                                        </p>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                          {/* Download Button */}
                                          <button
                                            onClick={() => handleFileDownload(message.fileUrl || '', message.fileName || '')}
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
                                            onClick={() => handleImageTransfer(message.fileUrl || '', message.fileName || '')}
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
                                  {message.type === 'file' && (
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      padding: '10px', 
                                      backgroundColor: '#f0f0f0', 
                                      borderRadius: '8px',
                                      maxWidth: '250px'
                                    }}>
                                      <i className="ti ti-file-text" style={{ fontSize: '24px', marginRight: '10px', color: '#666' }}></i>
                                      <div>
                                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>{message.fileName}</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>File</p>
                                      </div>
                                    </div>
                                  )}
                                  {message.type === 'audio' && (
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      padding: '10px', 
                                      backgroundColor: '#e3f2fd', 
                                      borderRadius: '8px',
                                      maxWidth: '200px'
                                    }}>
                                      <i className="ti ti-microphone" style={{ fontSize: '24px', marginRight: '10px', color: '#2563eb' }}></i>
                                      <div>
                                        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>Voice Message</p>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Audio recording</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center p-4">
                            <div style={{ marginBottom: '20px' }}>
                              <i className="ti ti-message-circle" style={{ fontSize: '48px', color: '#ddd' }}></i>
                            </div>
                            <h5 style={{ color: '#666', marginBottom: '10px' }}>Start a conversation</h5>
                            <p className="text-muted">
                              Send a message to {getUserDisplayName(selectedUser)} to begin your chat!
                            </p>
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
                          <button type="button" className="dropdown-item" style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}>
                            <i className="ti ti-camera-selfie me-2" />
                            Camera
                          </button>
                          <button type="button" className="dropdown-item" style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}>
                            <i className="ti ti-music me-2" />
                            Audio
                          </button>
                          <button type="button" className="dropdown-item" style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}>
                            <i className="ti ti-map-pin-share me-2" />
                            Location
                          </button>
                          <button type="button" className="dropdown-item" style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}>
                            <i className="ti ti-user-check me-2" />
                            Contact
                          </button>
                        </div>
                      </div>
                    </div>
                    
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
                      <button 
                        type="button"
                        onClick={handleVoiceRecording}
                        disabled={!selectedUser || isSending}
                        style={{
                          width: '38px',
                          height: '38px',
                          backgroundColor: isRecording ? '#ff4444' : '#f8f9fa',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          cursor: (selectedUser && !isSending) ? 'pointer' : 'not-allowed',
                          color: isRecording ? '#fff' : '#666',
                          opacity: (!selectedUser || isSending) ? 0.5 : 1
                        }}
                      >
                        <i className={isRecording ? "ti ti-square" : "ti ti-microphone"} />
                      </button>
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
      {/* /Page Wrapper */}
    </>
  );
};

export default Chat;
