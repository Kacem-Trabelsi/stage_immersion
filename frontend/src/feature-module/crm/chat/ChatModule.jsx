import React, { useState, useEffect, useRef, useCallback } from 'react';
import ImageWithBasePath from '../../../core/common/imageWithBasePath';
import chatService from '../../../services/chatService';
import EmojiPicker from 'emoji-picker-react';
import './ChatModule.css';

/**
 * @typedef {Object} ChatModuleProps
 * @property {boolean} isOpen
 * @property {function} onClose
 * @property {Object|null} selectedUser
 * @property {Object|null} currentUser  
 * @property {string|null|undefined} token
 */

/**
 * @param {ChatModuleProps} props
 */
const ChatModule = ({ 
  isOpen, 
  onClose, 
  selectedUser = null, 
  currentUser = null,
  token = null 
}) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchUsers, setSearchUsers] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  // Data loaders
  const loadConversations = useCallback(async () => {
    try {
      const convs = await chatService.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const users = await chatService.getUsers(searchUsers);
      setAvailableUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, [searchUsers]);

  // Event handlers
  const handleNewMessage = useCallback(({ message, conversationId }) => {
    if (activeConversation && activeConversation._id === conversationId) {
      setMessages(prev => [...prev, message]);
      if (document.hasFocus()) {
        chatService.markSocketAsRead(conversationId, [message._id]);
      }
    }
    loadConversations();
  }, [activeConversation, loadConversations]);

  const handleUserTyping = useCallback(({ userId, conversationId, isTyping }) => {
    if (activeConversation && activeConversation._id === conversationId) {
      setTypingUsers(prev => {
        if (isTyping) {
          return prev.includes(userId) ? prev : [...prev, userId];
        } else {
          return prev.filter(id => id !== userId);
        }
      });
    }
  }, [activeConversation]);

  const handleReactionUpdated = useCallback(({ messageId, reactions }) => {
    setMessages(prev => 
      prev.map(msg => 
        msg._id === messageId ? { ...msg, reactions } : msg
      )
    );
  }, []);

  const handleMessagesRead = useCallback(({ conversationId }) => {
    if (activeConversation && activeConversation._id === conversationId) {
      loadConversations();
    }
  }, [activeConversation, loadConversations]);

  const handleError = useCallback((error) => {
    console.error('Chat error:', error);
  }, []);

  // Socket setup
  const setupSocketListeners = useCallback(() => {
    chatService.onNewMessage(handleNewMessage);
    chatService.onUserTyping(handleUserTyping);
    chatService.onReactionUpdated(handleReactionUpdated);
    chatService.onMessagesRead(handleMessagesRead);
    chatService.onError(handleError);
  }, [handleNewMessage, handleUserTyping, handleReactionUpdated, handleMessagesRead, handleError]);

  // Initialize chat
  const initializeChat = useCallback(async () => {
    try {
      setIsLoading(true);
      await chatService.connect(token);
      setupSocketListeners();
      await loadConversations();
      await loadUsers();
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, setupSocketListeners, loadConversations, loadUsers]);

  const startConversationWithUser = useCallback(async (user) => {
    try {
      setIsLoading(true);
      const conversation = await chatService.createDirectConversation(user._id);
      await selectConversation(conversation);
    } catch (error) {
      console.error('Error starting conversation:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effects
  useEffect(() => {
    if (isOpen && token && currentUser) {
      initializeChat();
    }
    return () => {
      if (chatService.isConnected()) {
        chatService.disconnect();
      }
    };
  }, [isOpen, token, currentUser, initializeChat]);

  useEffect(() => {
    if (selectedUser && activeConversation === null) {
      startConversationWithUser(selectedUser);
    }
  }, [selectedUser, activeConversation, startConversationWithUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectConversation = async (conversation) => {
    try {
      setIsLoading(true);
      setActiveConversation(conversation);
      chatService.joinConversation(conversation._id);
      const { messages } = await chatService.getMessages(conversation._id);
      setMessages(messages);
      chatService.markSocketAsRead(conversation._id);
    } catch (error) {
      console.error('Error selecting conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() && attachedFiles.length === 0) return;
    if (!activeConversation) return;

    try {
      const messageType = attachedFiles.length > 0 ? 'file' : 'text';
      const content = { text: messageInput.trim() };
      
      await chatService.sendMessage(
        activeConversation._id,
        messageType,
        content,
        attachedFiles,
        replyingTo?._id
      );

      setMessageInput('');
      setAttachedFiles([]);
      setReplyingTo(null);
      setShowFilePreview(false);
      chatService.stopTyping(activeConversation._id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (value) => {
    setMessageInput(value);
    
    if (!activeConversation) return;
    
    if (!isTyping) {
      setIsTyping(true);
      chatService.startTyping(activeConversation._id);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      chatService.stopTyping(activeConversation._id);
    }, 1000);
  };

  const handleEmojiSelect = (emoji) => {
    setMessageInput(prev => prev + emoji.emoji);
    setShowEmojiPicker(false);
  };

  const addReaction = async (messageId, emoji) => {
    try {
      await chatService.addReaction(messageId, emoji);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachedFiles(files);
    if (files.length > 0) {
      setShowFilePreview(true);
    }
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    if (attachedFiles.length === 1) {
      setShowFilePreview(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const audioBlob = new Blob([e.data], { type: 'audio/wav' });
          const audioFile = new File([audioBlob], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
          setAttachedFiles([audioFile]);
          setShowFilePreview(true);
        }
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting voice recording:', error);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setMediaRecorder(null);
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOtherParticipant = (conversation) => {
    if (!conversation || !currentUser) return null;
    return conversation.participants.find(
      p => p.userId._id !== currentUser._id
    )?.userId;
  };

  const renderConversationList = () => (
    <div className="chat-conversations">
      <div className="chat-header p-3 border-bottom">
        <div className="d-flex align-items-center justify-content-between">
          <h5 className="mb-0">Messages</h5>
          <div className="d-flex align-items-center">
            <button 
              className="btn btn-sm btn-outline-primary me-2"
              onClick={() => setShowUserSearch(!showUserSearch)}
            >
              <i className="ti ti-plus" />
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              <i className="ti ti-x" />
            </button>
          </div>
        </div>
        
        {showUserSearch && (
          <div className="mt-3">
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                placeholder="Search users..."
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
              />
            </div>
            {availableUsers.length > 0 && (
              <div className="user-search-results mt-2 border rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {availableUsers.map(user => (
                  <div 
                    key={user._id}
                    className="d-flex align-items-center p-2"
                    style={{ cursor: 'pointer' }}
                    onClick={() => startConversationWithUser(user)}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <div className="avatar avatar-sm me-2">
                      <ImageWithBasePath
                        src={user.avatar || "assets/img/profiles/avatar-default.jpg"}
                        className="img-fluid rounded-circle"
                        alt={`${user.firstName} ${user.lastName}`}
                      />
                    </div>
                    <div className="flex-1">
                      <h6 className="mb-0">{user.firstName} {user.lastName}</h6>
                      <small className="text-muted">{user.role}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="conversation-list">
        {conversations.map(conversation => {
          const otherUser = getOtherParticipant(conversation);
          const unreadCount = conversation.unreadCount?.find(
            uc => uc.userId === currentUser?._id
          )?.count || 0;

          return (
            <div
              key={conversation._id}
              className={`conversation-item p-3 border-bottom ${
                activeConversation?._id === conversation._id ? 'bg-light' : ''
              }`}
              style={{ cursor: 'pointer' }}
              onClick={() => selectConversation(conversation)}
            >
              <div className="d-flex align-items-center">
                <div className="avatar avatar-md me-3 position-relative">
                  <ImageWithBasePath
                    src={otherUser?.avatar || "assets/img/profiles/avatar-default.jpg"}
                    className="img-fluid rounded-circle"
                    alt={otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : 'User'}
                  />
                  {otherUser?.isActive && (
                    <span className="position-absolute bottom-0 end-0 bg-success border border-white rounded-circle" style={{ width: '12px', height: '12px' }}></span>
                  )}
                </div>
                <div className="flex-fill">
                  <div className="d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">
                      {otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : 'Unknown User'}
                    </h6>
                    {conversation.lastMessage && (
                      <small className="text-muted">
                        {formatTime(conversation.lastMessage.timestamp)}
                      </small>
                    )}
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <p className="mb-0 text-muted small">
                      {conversation.lastMessage?.content || 'No messages yet'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="badge bg-primary rounded-pill">{unreadCount}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMessageList = () => (
    <div className="chat-messages">
      <div className="chat-header p-3 border-bottom">
        <div className="d-flex align-items-center">
          <button 
            className="btn btn-sm btn-outline-secondary me-3"
            onClick={() => setActiveConversation(null)}
          >
            <i className="ti ti-arrow-left" />
          </button>
          {activeConversation && (
            <>
              <div className="avatar avatar-sm me-2">
                <ImageWithBasePath
                  src={getOtherParticipant(activeConversation)?.avatar || "assets/img/profiles/avatar-default.jpg"}
                  className="img-fluid rounded-circle"
                  alt="User"
                />
              </div>
              <div>
                <h6 className="mb-0">
                  {(() => {
                    const otherUser = getOtherParticipant(activeConversation);
                    return otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : 'Unknown User';
                  })()}
                </h6>
                {typingUsers.length > 0 && (
                  <small className="text-primary">Typing...</small>
                )}
              </div>
            </>
          )}
          <div className="ms-auto">
            <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              <i className="ti ti-x" />
            </button>
          </div>
        </div>
      </div>

      <div className="messages-container p-3" style={{ height: '400px', overflowY: 'auto' }}>
        {messages.map(message => (
          <div
            key={message._id}
            className={`message-item mb-3 ${
              message.senderId._id === currentUser?._id ? 'text-end' : 'text-start'
            }`}
          >
            {message.replyTo && (
              <div className="reply-indicator bg-light p-2 rounded mb-1">
                <small className="text-muted">
                  Replying to: {message.replyTo.content.text}
                </small>
              </div>
            )}
            
            <div className={`message-bubble d-inline-block p-2 rounded position-relative ${
              message.senderId._id === currentUser?._id 
                ? 'bg-primary text-white' 
                : 'bg-light'
            }`} style={{ maxWidth: '70%' }}>
              {message.content.text && (
                <p className="mb-1">{message.content.text}</p>
              )}
              
              {message.content.emoji && (
                <span style={{ fontSize: '2rem' }}>{message.content.emoji}</span>
              )}
              
              {message.attachments && message.attachments.map((attachment, index) => (
                <div key={index} className="attachment mb-1">
                  {attachment.type === 'voice' ? (
                    <audio controls className="w-100">
                      <source src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.filePath}`} type={attachment.mimeType} />
                    </audio>
                  ) : attachment.type === 'image' ? (
                    <img 
                      src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${attachment.filePath}`}
                      alt={attachment.fileName}
                      className="img-fluid rounded"
                      style={{ maxHeight: '200px' }}
                    />
                  ) : (
                    <div className="file-attachment d-flex align-items-center">
                      <i className="ti ti-file me-2" />
                      <span>{attachment.fileName}</span>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="d-flex align-items-center justify-content-between">
                <small className={`text-${message.senderId._id === currentUser?._id ? 'white-50' : 'muted'}`}>
                  {formatTime(message.createdAt)}
                  {message.isEdited && ' (edited)'}
                </small>
                
                <div className="message-actions">
                  <button 
                    className="btn btn-sm p-0 me-1"
                    onClick={() => addReaction(message._id, '👍')}
                    style={{ background: 'none', border: 'none' }}
                  >
                    👍
                  </button>
                  <button 
                    className="btn btn-sm p-0"
                    onClick={() => setReplyingTo(message)}
                    style={{ background: 'none', border: 'none' }}
                  >
                    <i className="ti ti-corner-up-left" />
                  </button>
                </div>
              </div>
              
              {message.reactions && message.reactions.length > 0 && (
                <div className="reactions mt-1">
                  {message.reactions.map((reaction, index) => (
                    <span key={index} className="reaction me-1">
                      {reaction.emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {replyingTo && (
        <div className="reply-preview p-2 bg-light border-top">
          <div className="d-flex align-items-center justify-content-between">
            <small>Replying to: {replyingTo.content.text}</small>
            <button 
              className="btn btn-sm p-0"
              onClick={() => setReplyingTo(null)}
              style={{ background: 'none', border: 'none' }}
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </div>
      )}

      {showFilePreview && attachedFiles.length > 0 && (
        <div className="file-preview p-2 bg-light border-top">
          <div className="d-flex align-items-center flex-wrap">
            {attachedFiles.map((file, index) => (
              <div key={index} className="file-preview-item d-flex align-items-center me-3 mb-1">
                <i className="ti ti-file me-1" />
                <span className="small">{file.name}</span>
                <button 
                  className="btn btn-sm p-0 ms-1"
                  onClick={() => removeFile(index)}
                  style={{ background: 'none', border: 'none' }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chat-input p-3 border-top">
        <div className="input-group">
          <button 
            className="btn btn-outline-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="ti ti-paperclip" />
          </button>
          
          <button 
            className={`btn ${isRecording ? 'btn-danger' : 'btn-outline-secondary'}`}
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
          >
            <i className={`ti ${isRecording ? 'ti-square' : 'ti-microphone'}`} />
            {isRecording && <span className="ms-1">{formatRecordingTime(recordingTime)}</span>}
          </button>
          
          <textarea
            className="form-control"
            placeholder="Type a message..."
            value={messageInput}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyPress={handleKeyPress}
            rows="1"
            style={{ resize: 'none' }}
          />
          
          <button 
            className="btn btn-outline-secondary"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            😊
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={sendMessage}
            disabled={!messageInput.trim() && attachedFiles.length === 0}
          >
            <i className="ti ti-send" />
          </button>
        </div>

        {showEmojiPicker && (
          <div className="emoji-picker-container position-absolute" style={{ bottom: '70px', right: '20px', zIndex: 1000 }}>
            <EmojiPicker onEmojiClick={handleEmojiSelect} />
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          style={{ display: 'none' }}
          accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
        />
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="card border-0 shadow-lg" style={{ width: '800px', height: '600px' }}>
        <div className="card-body p-0 d-flex">
          {isLoading ? (
            <div className="d-flex align-items-center justify-content-center w-100">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : activeConversation ? (
            <div className="w-100">
              {renderMessageList()}
            </div>
          ) : (
            <div className="w-100">
              {renderConversationList()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatModule;