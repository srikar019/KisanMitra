import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth, firestore } from '../services/firebase';
import { FarmerProfile } from '../types';

interface AuthContextType {
  currentUser: firebase.User | null;
  userProfile: FarmerProfile | null;
  loading: boolean;
  isAuthenticating: boolean;
  setIsAuthenticating: React.Dispatch<React.SetStateAction<boolean>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userProfile, setUserProfile] = useState<FarmerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      // We set loading to false here for the initial auth check.
      // Profile loading happens after.
      if (!user) {
          setLoading(false);
          setUserProfile(null);
      }
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
      if (currentUser) {
          // If there's a user, listen for profile changes
          const userDocRef = firestore.collection('users').doc(currentUser.uid);
          const unsubscribeProfile = userDocRef.onSnapshot(
              (doc) => {
                  if (doc.exists) {
                      setUserProfile({ uid: doc.id, ...doc.data() } as FarmerProfile);
                  }
                  // If doc doesn't exist, ensureUserProfile should have created it,
                  // and this listener will pick up the change.
                  setLoading(false); // Auth is loaded, profile is loaded (or doesn't exist)
              },
              (error) => {
                  console.error("Error fetching user profile:", error);
                  setLoading(false); // Stop loading even on error
              }
          );
          return () => unsubscribeProfile();
      } else {
          // No user, clear profile
          setUserProfile(null);
      }
  }, [currentUser]);


  const value = {
    currentUser,
    userProfile,
    loading,
    isAuthenticating,
    setIsAuthenticating,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
