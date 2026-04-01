import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from './firebase';
import { ensureUserProfile, getUserProfile } from './userService';

export const signUp = async (email: string, password: string, role: 'farmer' | 'customer') => {
    const { user } = await auth.createUserWithEmailAndPassword(email, password);
    if (user) {
        await ensureUserProfile(user, role);
    }
    return user;
};

export const signIn = async (email: string, password: string, portalRole: 'farmer' | 'customer') => {
    const { user } = await auth.signInWithEmailAndPassword(email, password);
    if (user) {
        // Fetch the user's profile to verify their role against the portal they're using.
        const profile = await getUserProfile(user.uid);

        // If a profile exists with a role that doesn't match the current portal, deny login.
        // Admins are allowed to log in through any portal.
        if (profile && profile.role && profile.role !== portalRole && profile.role !== 'admin') {
            await auth.signOut(); // Immediately sign them out.
            // Throw the generic 'invalid-credential' error to avoid revealing account details.
            throw new Error('auth/invalid-credential'); 
        }
        
        // If roles match, or if the user is new/roleless, ensure the profile is up-to-date.
        await ensureUserProfile(user, portalRole);
    }
    return user;
};

export const logout = () => {
    return auth.signOut();
};

export const sendPasswordResetEmail = async (email: string): Promise<void> => {
    try {
        await auth.sendPasswordResetEmail(email);
    } catch (error) {
        // Re-throw to allow component to display user-friendly message
        throw error;
    }
};

export const signInWithGoogle = async (portalRole: 'farmer' | 'customer') => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const { user } = await auth.signInWithPopup(provider);
    if (user) {
        // Fetch the user's profile to verify their role against the portal they're using.
        const profile = await getUserProfile(user.uid);

        // If a profile exists with a role that doesn't match the current portal, deny login.
        if (profile && profile.role && profile.role !== portalRole) {
            await auth.signOut(); // Immediately sign them out.
            // Provide a more user-friendly error for the Google sign-in case.
            const otherPortal = profile.role === 'farmer' ? 'Farmer' : 'Customer';
            throw new Error(`This account is registered as a ${profile.role}. Please sign in via the ${otherPortal} Portal.`);
        }
        
        await ensureUserProfile(user, portalRole);
    }
    return user;
};



