import React, { useEffect, useState } from "react";
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
  const [showEmoji, setShowEmoji] = useState(false);
  const [showEmoji2, setShowEmoji2] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

        // Fetch all users for chat list
        const allUsers = await UserService.getAllUsers();
        
        // Create chat users with mock data (you can replace with real chat data later)
        const chatUsersData: ChatUser[] = allUsers.map((user: User) => ({
          user,
          unreadCount: Math.floor(Math.random() * 5),
          isOnline: Math.random() > 0.5,
          lastSeen: new Date(Date.now() - Math.random() * 86400000) // Random last seen within 24h
        }));
        
        setChatUsers(chatUsersData);
        
      } catch (error) {
        console.error('Error loading chat data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Load messages for selected user
  useEffect(() => {
    if (selectedUser) {
      loadMessagesForUser(selectedUser._id);
    }
  }, [selectedUser]);

  // Filter chat users based on search term
  const filteredChatUsers = chatUsers.filter(chatUser => 
    getUserDisplayName(chatUser.user).toLowerCase().includes(searchTerm.toLowerCase()) ||
    chatUser.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get user avatar or default
  const getUserAvatar = (user: User | null): string => {
    if (!user) return '/assets/img/profiles/avatar-29.jpg';
    
    if (user.avatar) {
      return user.avatar.startsWith('http') ? user.avatar : `http://localhost:5000${user.avatar}`;
    }
    if (user.profilePhoto) {
      return user.profilePhoto.startsWith('http') ? user.profilePhoto : `http://localhost:5000${user.profilePhoto}`;
    }
    return '/assets/img/profiles/avatar-29.jpg';
  };

  // Get user display name
  const getUserDisplayName = (user: User | null): string => {
    if (!user) return 'Select a user';
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email.split('@')[0];
  };

  // Handle user selection for chat
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    sessionStorage.setItem('selectedChatUser', JSON.stringify(user));
  };

  // Load messages for selected user
  const loadMessagesForUser = async (userId: string) => {
    // Mock messages - replace with real API call
    const mockMessages: Message[] = [
      {
        _id: '1',
        senderId: userId,
        receiverId: currentUser?.id || '',
        content: 'Hi there! How are you doing?',
        timestamp: new Date(Date.now() - 3600000),
        type: 'text'
      },
      {
        _id: '2',
        senderId: currentUser?.id || '',
        receiverId: userId,
        content: 'I\'m doing great! Thanks for asking.',
        timestamp: new Date(Date.now() - 1800000),
        type: 'text'
      },
      {
        _id: '3',
        senderId: userId,
        receiverId: currentUser?.id || '',
        content: 'That\'s wonderful to hear!',
        timestamp: new Date(Date.now() - 900000),
        type: 'text'
      }
    ];
    
    setMessages(mockMessages);
  };

  // Handle sending new message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedUser || !currentUser) return;

    const message: Message = {
      _id: Date.now().toString(),
      senderId: currentUser.id,
      receiverId: selectedUser._id,
      content: newMessage,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage("");
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
                                  </h6>
                                </div>
                                <div className="message-content">
                                  {message.content}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center p-4">
                            <p className="text-muted">No messages yet. Start the conversation!</p>
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
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                  <div className="smile-foot">
                    <div className="chat-action-btns">
                      <div className="chat-action-col">
                        <Link
                          className="action-circle"
                          to="#"
                          data-bs-toggle="dropdown"
                        >
                          <i className="ti ti-plus" />
                        </Link>
                        <div className="dropdown-menu dropdown-menu-end p-3">
                          <Link to="#" className="dropdown-item">
                            <i className="ti ti-file-text me-2" />
                            Document
                          </Link>
                          <Link to="#" className="dropdown-item">
                            <i className="ti ti-camera-selfie me-2" />
                            Camera
                          </Link>
                          <Link to="#" className="dropdown-item">
                            <i className="ti ti-photo-up me-2" />
                            Gallery
                          </Link>
                          <Link to="#" className="dropdown-item">
                            <i className="ti ti-music me-2" />
                            Audio
                          </Link>
                          <Link to="#" className="dropdown-item">
                            <i className="ti ti-map-pin-share me-2" />
                            Location
                          </Link>
                          <Link to="#" className="dropdown-item">
                            <i className="ti ti-user-check me-2" />
                            Contact
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="smile-foot-emoj">
                      <Link to="#" onClick={() => setShowEmoji(!showEmoji)}>
                        <i className="ti ti-mood-smile" />
                      </Link>
                    </div>
                    <div className="smile-foot-box">
                      <Link to="#">
                        <i className="ti ti-microphone" />
                      </Link>
                    </div>
                  </div>
                  <div className="smile-foot-text">
                    <input
                      type="text"
                      className="form-control chat_form"
                      placeholder="Type your message here..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={!selectedUser}
                    />
                  </div>
                  <div className="form-btn">
                    <button 
                      className="btn btn-primary" 
                      type="submit"
                      disabled={!selectedUser || !newMessage.trim()}
                    >
                      <i className="ti ti-send" />
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
