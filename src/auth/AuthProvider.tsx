import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import { auth, onAuthStateChanged } from '../firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  getIdToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setLoading(false);
  }), []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    getIdToken: async () => {
      if (!user) {
        throw new Error('Authentication required.');
      }

      return user.getIdToken();
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
