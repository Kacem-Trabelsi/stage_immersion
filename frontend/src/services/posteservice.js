// frontend/src/services/postService.js
import axios from 'axios';

// Base URL for the backend API (adjust if your backend runs on a different port)
const API_URL = 'http://localhost:5000/api/posts';

// Function to get the JWT token from localStorage (or wherever you store it)
const getAuthToken = () => {
  return localStorage.getItem('token'); // Assumes token is stored in localStorage after login
};

// Create an axios instance with default headers
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the JWT token in the Authorization header
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Service functions for each API endpoint
export const createPost = async (postData) => {
  try {
    const response = await axiosInstance.post('/addpost', postData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to create post' };
  }
};

export const getAllPosts = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch posts' };
  }
};

export const searchPosts = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/search', { params });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to search posts' };
  }
};

export const getPostById = async (postId) => {
  try {
    const response = await axiosInstance.get(`/${postId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch post' };
  }
};

export const updatePost = async (postId, postData) => {
  try {
    const response = await axiosInstance.put(`/${postId}`, postData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to update post' };
  }
};

export const deletePost = async (postId) => {
  try {
    const response = await axiosInstance.delete(`/${postId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to delete post' };
  }
};

export const addComment = async (postId, commentData) => {
  try {
    const response = await axiosInstance.post(`/${postId}/comment`, commentData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to add comment' };
  }
};

export const deleteComment = async (postId, commentId) => {
  try {
    const response = await axiosInstance.delete(`/${postId}/comment/${commentId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to delete comment' };
  }
};

export const toggleLike = async (postId) => {
  try {
    const response = await axiosInstance.post(`/${postId}/like`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to toggle like' };
  }
};

export const toggleCommentLike = async (postId, commentId) => {
  try {
    const response = await axiosInstance.post(`/${postId}/comment/${commentId}/like`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to toggle comment like' };
  }
};

export const addReply = async (postId, commentId, replyData) => {
  try {
    const response = await axiosInstance.post(`/${postId}/comment/${commentId}/reply`, replyData);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to add reply' };
  }
};

export const deleteReply = async (postId, commentId, replyId) => {
  try {
    const response = await axiosInstance.delete(`/${postId}/comment/${commentId}/reply/${replyId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to delete reply' };
  }
};

export const toggleReplyLike = async (postId, commentId, replyId) => {
  try {
    const response = await axiosInstance.post(`/${postId}/comment/${commentId}/reply/${replyId}/like`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to toggle reply like' };
  }
};

export const togglePinPost = async (postId) => {
  try {
    const response = await axiosInstance.post(`/${postId}/pin`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to toggle pin status' };
  }
};

export const registerForEvent = async (postId) => {
  try {
    const response = await axiosInstance.post(`/${postId}/register`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to register for event' };
  }
};

export const cancelEventRegistration = async (postId) => {
  try {
    console.log("Service: Canceling registration for post:", postId);
    const response = await axiosInstance.delete(`/${postId}/register`);
    console.log("Service: Cancellation response:", response.data);
    
    // Add detailed logging of the returned data structure
    if (response.data && response.data.data) {
      console.log("Service: Returned post details:", {
        id: response.data.data._id,
        hasEventDetails: !!response.data.data.eventDetails,
        participantsCount: response.data.data.eventDetails ? 
          response.data.data.eventDetails.registeredParticipants.length : 0,
        participants: response.data.data.eventDetails ? 
          response.data.data.eventDetails.registeredParticipants : []
      });
    }
    
    return response.data;
  } catch (error) {
    console.error("Service: Error canceling registration:", error);
    if (error.response) {
      console.error("Service: Server response error:", error.response.data);
      throw error.response.data || { message: 'Failed to cancel event registration' };
    }
    throw { message: 'Failed to cancel event registration: ' + error.message };
  }
};

// Helper function for uploading media files
export const uploadMedia = async (formData) => {
  try {
    const response = await axios.post(
      'http://localhost:5000/api/uploads/multiple', // Use the multiple files endpoint
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${getAuthToken()}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error.response?.data || { message: 'Failed to upload media' };
  }
};