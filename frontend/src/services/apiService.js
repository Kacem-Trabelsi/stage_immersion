// src/services/apiService.js
import axios from 'axios';

// ✅ Base API URL - Make sure this matches your backend
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ✅ Create axios instance with proper configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false // Set to true if you need cookies
});

// ✅ Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`
    });
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ✅ Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });

    // Handle specific error cases
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      // Don't redirect here - let components handle it
    }

    return Promise.reject(error);
  }
);

// ✅ Auth API methods
export const authAPI = {
  // Sign in
  signin: async (credentials) => {
    try {
      const response = await apiClient.post('/api/auth/signin', credentials);
      return response;
    } catch (error) {
      console.error('Signin API error:', error);
      throw error;
    }
  },

  // Sign up
  signup: async (userData) => {
    try {
      const response = await apiClient.post('/api/auth/signup', userData);
      return response;
    } catch (error) {
      console.error('Signup API error:', error);
      throw error;
    }
  },

  // Verify token
  verifyToken: async () => {
    try {
      const response = await apiClient.get('/api/auth/verify');
      return response;
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  },

  // Sign out
  signout: async () => {
    try {
      const response = await apiClient.post('/api/auth/signout');
      return response;
    } catch (error) {
      console.error('Signout API error:', error);
      // Don't throw error for signout - it's not critical
      return { data: { success: false } };
    }
  },

  // Forgot password
  forgotPassword: async (email) => {
    try {
      const response = await apiClient.post('/api/auth/forgot-password', { email });
      return response;
    } catch (error) {
      console.error('Forgot password API error:', error);
      throw error;
    }
  },

  // Reset password
  resetPassword: async (token, password) => {
    try {
      const response = await apiClient.post('/api/auth/reset-password', { 
        token, 
        password 
      });
      return response;
    } catch (error) {
      console.error('Reset password API error:', error);
      throw error;
    }
  },

  // Verify reset token
  verifyResetToken: async (token) => {
    try {
      const response = await apiClient.get(`/api/auth/verify-reset-token?token=${token}`);
      return response;
    } catch (error) {
      console.error('Verify reset token API error:', error);
      throw error;
    }
  },

  // Generate CAPTCHA
  generateCaptcha: async () => {
    try {
      const response = await apiClient.get('/api/auth/captcha');
      return response;
    } catch (error) {
      console.error('Generate CAPTCHA API error:', error);
      throw error;
    }
  }
};

// ✅ Other API methods can be added here
export const userAPI = {
  getProfile: async () => {
    try {
      const response = await apiClient.get('/api/user/profile');
      return response;
    } catch (error) {
      console.error('Get profile API error:', error);
      throw error;
    }
  },

  updateProfile: async (userData) => {
    try {
      const response = await apiClient.put('/api/user/profile', userData);
      return response;
    } catch (error) {
      console.error('Update profile API error:', error);
      throw error;
    }
  },
  
  updateProfileWithPhoto: async (formData) => {
    try {
      // Get the token from localStorage
      const token = localStorage.getItem('token');
      
      // Create a custom config to handle multipart/form-data while preserving Authorization header
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
          // Ensure Authorization header is included
          'Authorization': token ? `Bearer ${token}` : ''
        }
      };
      
      const response = await apiClient.put('/api/user/profile', formData, config);
      return response;
    } catch (error) {
      console.error('Update profile with photo API error:', error);
      throw error;
    }
  },

  uploadAvatar: async (userId, file) => {
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('avatar', file);
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      };
      const response = await apiClient.post(`/api/user/${userId}/avatar`, form, config);
      return response;
    } catch (error) {
      console.error('Upload avatar API error:', error);
      throw error;
    }
  },

  uploadCv: async (userId, file) => {
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('cv', file);
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      };
      const response = await apiClient.post(`/api/user/${userId}/cv`, form, config);
      return response;
    } catch (error) {
      console.error('Upload CV API error:', error);
      throw error;
    }
  },

  changePassword: async (passwordData) => {
    try {
      const response = await apiClient.put('/api/user/change-password', passwordData);
      return response;
    } catch (error) {
      console.error('Change password API error:', error);
      throw error;
    }
  },

  getSecurityOverview: async () => {
    try {
      const response = await apiClient.get('/api/user/security/overview');
      return response;
    } catch (error) {
      console.error('Get security overview API error:', error);
      throw error;
    }
  },

  changeEmail: async (emailData) => {
    try {
      const response = await apiClient.put('/api/user/change-email', emailData);
      return response;
    } catch (error) {
      console.error('Change email API error:', error);
      throw error;
    }
  },

  getDevices: async () => {
    try {
      const response = await apiClient.get('/api/user/devices');
      return response;
    } catch (error) {
      console.error('Get devices API error:', error);
      throw error;
    }
  },

  deleteAccount: async (password) => {
    try {
      const response = await apiClient.delete('/api/user/delete-account', {
        data: { password }
      });
      return response;
    } catch (error) {
      console.error('Delete account API error:', error);
      throw error;
    }
  }
};

// Events API
export const eventsAPI = {
  list: async (params = {}) => {
    try {
      const response = await apiClient.get('/api/events', { params });
      return response;
    } catch (error) {
      console.error('List events API error:', error);
      throw error;
    }
  },
  create: async (event) => {
    try {
      const response = await apiClient.post('/api/events', event);
      return response;
    } catch (error) {
      console.error('Create event API error:', error);
      throw error;
    }
  }
};

// Internal Emails API
export const emailsAPI = {
  getContacts: async () => {
    try {
      return await apiClient.get('/api/emails/contacts');
    } catch (error) {
      console.error('Get email contacts API error:', error);
      throw error;
    }
  },
  getInbox: async (search = '') => {
    try {
      return await apiClient.get('/api/emails/inbox', { params: { search } });
    } catch (error) {
      console.error('Get inbox API error:', error);
      throw error;
    }
  },
  getSent: async (search = '') => {
    try {
      return await apiClient.get('/api/emails/sent', { params: { search } });
    } catch (error) {
      console.error('Get sent API error:', error);
      throw error;
    }
  },
  markAsRead: async (emailId) => {
    try {
      return await apiClient.patch(`/api/emails/${emailId}/read`);
    } catch (error) {
      console.error('Mark email as read API error:', error);
      throw error;
    }
  },
  send: async (payload) => {
    try {
      return await apiClient.post('/api/emails/send', payload);
    } catch (error) {
      console.error('Send email API error:', error);
      throw error;
    }
  },
  reply: async (emailId, payload) => {
    try {
      return await apiClient.post(`/api/emails/${emailId}/reply`, payload);
    } catch (error) {
      console.error('Reply email API error:', error);
      throw error;
    }
  }
};

// ✅ Export the axios instance for direct use if needed
export default apiClient;