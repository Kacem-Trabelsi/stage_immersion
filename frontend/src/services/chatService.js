import axios from 'axios';
import { io } from 'socket.io-client';

class ChatService {
  constructor() {
    this.socket = null;
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    this.token = null;
    this.connectionStatus = 'disconnected';
    this.connectionCallbacks = [];
  }

  // Initialize socket connection
  connect(token) {
    return new Promise((resolve, reject) => {
      // Disconnect existing socket if any
      if (this.socket) {
        console.log('🔌 Disconnecting existing socket before reconnecting');
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.token = token;
      
      console.log('🔌 Attempting to connect to socket at:', this.baseURL);
      console.log('🔑 Using token:', token ? 'Present' : 'Missing');
      
      this.socket = io(this.baseURL, {
        auth: { token },
        query: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3, // Reduced from 5 to 3
        reconnectionDelay: 2000, // Increased from 1000 to 2000
        timeout: 20000,
        extraHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });

      this.socket.on('connect', () => {
        console.log('✅ Chat socket connected successfully');
        console.log('🔗 Socket ID:', this.socket.id);
        this.connectionStatus = 'connected';
        this.notifyConnectionCallbacks('connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Chat socket connection error:', error);
        console.error('🔍 Error details:', {
          message: error.message,
          description: error.description,
          context: error.context,
          type: error.type
        });
        this.connectionStatus = 'error';
        this.notifyConnectionCallbacks('error', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Chat socket disconnected:', reason);
        this.connectionStatus = 'disconnected';
        this.notifyConnectionCallbacks('disconnected', reason);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Chat socket reconnected after', attemptNumber, 'attempts');
        this.connectionStatus = 'connected';
        this.notifyConnectionCallbacks('connected');
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Chat socket reconnection attempt:', attemptNumber);
        this.connectionStatus = 'reconnecting';
        this.notifyConnectionCallbacks('reconnecting', attemptNumber);
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('Chat socket reconnection error:', error);
        this.connectionStatus = 'error';
        this.notifyConnectionCallbacks('error', error);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('Chat socket reconnection failed');
        this.connectionStatus = 'failed';
        this.notifyConnectionCallbacks('failed');
      });
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // API Methods
  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  // Get all conversations
  async getConversations() {
    try {
      const response = await axios.get(`${this.baseURL}/api/chat/conversations`, {
        headers: this.getAuthHeaders()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Create or get direct conversation
  async createDirectConversation(userId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/chat/conversations/direct`,
        { userId },
        { headers: this.getAuthHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Get messages for a conversation
  async getMessages(conversationId, page = 1, limit = 50) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/chat/conversations/${conversationId}/messages`,
        {
          params: { page, limit },
          headers: this.getAuthHeaders()
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Send a message
  async sendMessage(conversationId, messageType, content, files, replyTo) {
    try {
      const formData = new FormData();
      formData.append('messageType', messageType);
      formData.append('content', JSON.stringify(content));
      
      if (replyTo) {
        formData.append('replyTo', replyTo);
      }

      if (files && files.length > 0) {
        files.forEach((file, index) => {
          formData.append(`file_${index}`, file);
        });
      }

      const response = await axios.post(
        `${this.baseURL}/api/chat/conversations/${conversationId}/messages`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Add reaction to message
  async addReaction(messageId, emoji) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/chat/messages/${messageId}/reactions`,
        { emoji },
        { headers: this.getAuthHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  // Edit message
  async editMessage(messageId, content) {
    try {
      const response = await axios.put(
        `${this.baseURL}/api/chat/messages/${messageId}`,
        { content },
        { headers: this.getAuthHeaders() }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  // Delete message
  async deleteMessage(messageId) {
    try {
      await axios.delete(
        `${this.baseURL}/api/chat/messages/${messageId}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Mark conversation as read
  async markAsRead(conversationId, messageIds) {
    try {
      await axios.post(
        `${this.baseURL}/api/chat/conversations/${conversationId}/read`,
        { messageIds },
        { headers: this.getAuthHeaders() }
      );
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  }

  // Get users for chat
  async getUsers(search = '', role) {
    try {
      const response = await axios.get(`${this.baseURL}/api/chat/users`, {
        params: { search, role },
        headers: this.getAuthHeaders()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Socket Event Handlers
  onNewMessage(callback) {
    this.socket?.on('new_message', callback);
  }

  onMessageDelivered(callback) {
    this.socket?.on('message_delivered', callback);
  }

  onMessagesRead(callback) {
    this.socket?.on('messages_read', callback);
  }

  onUserTyping(callback) {
    this.socket?.on('user_typing', callback);
  }

  onReactionUpdated(callback) {
    this.socket?.on('reaction_updated', callback);
  }

  onUserStatusUpdate(callback) {
    this.socket?.on('user_status_update', callback);
  }

  onError(callback) {
    this.socket?.on('message_error', callback);
    this.socket?.on('reaction_error', callback);
    this.socket?.on('read_error', callback);
  }

  // Socket Emitters
  joinConversation(conversationId) {
    this.socket?.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId) {
    this.socket?.emit('leave_conversation', conversationId);
  }

  startTyping(conversationId) {
    this.socket?.emit('typing_start', { conversationId });
  }

  stopTyping(conversationId) {
    this.socket?.emit('typing_stop', { conversationId });
  }

  sendSocketMessage(data) {
    this.socket?.emit('send_message', data);
  }

  addSocketReaction(messageId, emoji) {
    this.socket?.emit('add_reaction', { messageId, emoji });
  }

  markSocketAsRead(conversationId, messageIds) {
    this.socket?.emit('mark_as_read', { conversationId, messageIds });
  }

  updateStatus(status) {
    this.socket?.emit('update_status', status);
  }

  // Connection status management
  notifyConnectionCallbacks(status, data = null) {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(status, data);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  onConnectionStatusChange(callback) {
    this.connectionCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  // Utility methods
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  getSocket() {
    return this.socket;
  }
}

const chatService = new ChatService();
export default chatService;
