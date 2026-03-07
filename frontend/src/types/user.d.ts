// User type definitions
export interface User {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  role: 'STARTUP' | 'EXPERT' | 'ADMIN' | 'USER' | 'MANAGER';
  phone?: string;
  country?: string;
  position?: string;
  avatar?: string;
  profilePhoto?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  signin: (credentials: any) => Promise<{ success: boolean; user?: User; message?: string }>;
  signup: (userData: any) => Promise<{ success: boolean; user?: User; message?: string }>;
  signout: () => Promise<void> | void;
  updateUser: (userData: Partial<User>) => void;
}
