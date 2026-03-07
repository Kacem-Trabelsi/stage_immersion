// Creates a file upload service to handle uploads for news feed attachments and other files
import axios from 'axios';

// Base URL for the backend API
const API_URL = 'http://localhost:5000/api/uploads';

// Function to get the JWT token from localStorage
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Upload a single file
export const uploadFile = async (file, folder = 'posts') => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    
    const response = await axios.post(`${API_URL}/single`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to upload file' };
  }
};

// Upload multiple files
export const uploadFiles = async (files, folder = 'posts') => {
  try {
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    formData.append('folder', folder);
    
    const response = await axios.post(`${API_URL}/multiple`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to upload files' };
  }
};

// Delete a file
export const deleteFile = async (fileUrl) => {
  try {
    const response = await axios.delete(`${API_URL}`, {
      data: { fileUrl },
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to delete file' };
  }
};

// Get file metadata
export const getFileMetadata = async (fileUrl) => {
  try {
    const response = await axios.get(`${API_URL}/metadata`, {
      params: { fileUrl },
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to get file metadata' };
  }
};

export default {
  uploadFile,
  uploadFiles,
  deleteFile,
  getFileMetadata,
};
