// src/hooks/useUser.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserService from '../services/userService';

interface User {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  avatar?: string;
  department?: string;
  position?: string;
  hireDate?: string;
  salary?: number;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  skills?: string[];
  education?: {
    degree: string;
    institution: string;
    year: string;
  }[];
  experience?: {
    company: string;
    position: string;
    duration: string;
    description: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

interface UserStats {
  totalProjects: number;
  completedProjects: number;
  totalHours: number;
  averageRating: number;
  leavesTaken: number;
  leavesRemaining: number;
  attendanceRate: number;
  performanceScore: number;
}

interface UseUserReturn {
  user: User | null;
  userStats: UserStats | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

export const useUser = (): UseUserReturn => {
  const { user: authUser, isAuthenticated } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = async () => {
    if (!isAuthenticated || !authUser) {
      setUser(null);
      setUserStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user profile
      const userResponse = await UserService.getCurrentUser();
      if (userResponse.success) {
        setUser(userResponse.data);
      }

      // Get user stats if user exists
      if (userResponse.success && userResponse.data._id) {
        try {
          const statsResponse = await UserService.getUserStats(userResponse.data._id);
          if (statsResponse.success) {
            setUserStats(statsResponse.data);
          }
        } catch (statsError) {
          console.warn('Could not fetch user stats:', statsError);
          // Don't set error for stats, as it might not be implemented yet
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error fetching user data:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = () => {
    fetchUserData();
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) {
      throw new Error('No user data available');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await UserService.updateUserProfile(user._id, userData);
      if (response.success) {
        setUser(prevUser => prevUser ? { ...prevUser, ...response.data } : null);
      } else {
        throw new Error(response.message || 'Failed to update user');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error updating user:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) {
      throw new Error('No user data available');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await UserService.uploadAvatar(user._id, file);
      if (response.success) {
        setUser(prevUser => prevUser ? { ...prevUser, avatar: response.data.avatar } : null);
      } else {
        throw new Error(response.message || 'Failed to upload avatar');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error('Error uploading avatar:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fetch user data when authentication state changes
  useEffect(() => {
    fetchUserData();
  }, [isAuthenticated, authUser]);

  return {
    user,
    userStats,
    loading,
    error,
    refreshUser,
    updateUser,
    uploadAvatar
  };
}; 