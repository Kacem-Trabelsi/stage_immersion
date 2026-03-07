// src/services/searchService.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance with proper configuration
const searchClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor to add auth token
searchClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Search request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Search companies by name or activity domain
export const searchCompanies = async (searchTerm) => {
  try {
    const response = await searchClient.get(`/api/company-profile/search?q=${encodeURIComponent(searchTerm)}`);
    return response.data;
  } catch (error) {
    console.error('Search companies error:', error);
    throw error;
  }
};

// Search companies with filters
export const searchCompaniesWithFilters = async (searchTerm, filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (searchTerm) params.append('q', searchTerm);
    
    // Add filters
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    
    const response = await searchClient.get(`/api/company-profile/search?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Search companies with filters error:', error);
    throw error;
  }
};

const searchService = {
  searchCompanies,
  searchCompaniesWithFilters
};

export default searchService; 