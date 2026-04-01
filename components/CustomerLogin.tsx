import React, { useState } from 'react';
import { signIn, signUp, signInWithGoogle, sendPasswordResetEmail } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Spinner from './common/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSwitcher from './common/LanguageSwitcher';

interface CustomerLoginProps {
    onBack: () => void;
}

const CustomerLogin: React.FC<CustomerLoginProps> = ({ onBack }) => {
  const { setIsAuthenticating } = useAuth();
  const { translate } = useLanguage();
  const [view, setView] = useState<'signIn' | 'signUp' | 'resetPassword'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    setIsAuthenticating(view !== 'resetPassword');
    try {
      if (view === 'signUp') {
        await signUp(email, password, 'customer');
      } else if (view === 'signIn') {
        await signIn(email, password, 'customer');
      } else if (view === 'resetPassword') {
        await sendPasswordResetEmail(email);
        setSuccess('Password reset link sent! Please check your email.');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('auth/invalid-credential')) {
             setError('Invalid email or password.');
        } else if (err.message.includes('auth/email-already-in-use')) {
             setError('This email is already registered.');
        } else {
             setError(err.message);
        }
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    setIsAuthenticating(true);
    try {
      await signInWithGoogle('customer');
    } catch (err) {
       if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during Google Sign-In.');
      }
    } finally {
        setLoading(false);
        setIsAuthenticating(false);
    }
  };

  const switchView = (newView: 'signIn' | 'signUp' | 'resetPassword') => {
      setError(null);
      setSuccess(null);
      setPassword('');
      setView(newView);
  }

  return (
    <div className="bg-[#fafaea] text-[#1b1c13] font-['Work_Sans'] antialiased overflow-hidden h-screen w-full flex flex-col lg:flex-row relative">
      <style>{`
        .bg-nature-split {
            background-image: linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(https://lh3.googleusercontent.com/aida-public/AB6AXuDCsp-iBknmSOndEa5xt3pMch7GgqloKcftvV3iE73WKNag_kgJd3EASw0JG3PcPzpANZLOI0eep7ewNMluB8IQd650F0YCys7Q6pPaeDHMO1smlS7WfTKJjesCGrJ0xO5eEUaxJJG-0BuXa-1jDMWUZKfH-p2c-7jLVu81F_vkobHEIkRf8RyUYxXzPbjB4CPBKqHSNt13ihwXthBiuv8-aYIMCLrbkudhoBtNT8NkCsUIKwDF7R2FX-wrhXOumLUkie2Ag_dLaRI);
            background-size: cover;
            background-position: center;
        }
      `}</style>
      
      {/* Left Side: Nature Quote */}
      <section className="hidden lg:flex w-1/2 bg-nature-split relative items-center justify-center p-20 shadow-[-20px_0_40px_-20px_rgba(0,0,0,0.5)_inset] z-10 h-full">
        {/* logo inside section - Clickable to go back */}
        <button 
          onClick={onBack}
          className="absolute top-12 left-12 flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-all z-20"
        >
           <img src="/logo.png" className="h-10 w-10 rounded-full shadow-lg group-hover:scale-105 transition-transform" alt="Logo" />
           <span className="text-2xl font-bold text-white font-['Epilogue'] tracking-tight drop-shadow-md">KisanMitra</span>
        </button>
        
        <div className="relative z-10 max-w-[500px] text-center">
            <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white text-[72px] font-['Epilogue'] font-extrabold leading-[1.05] tracking-tight drop-shadow-2xl"
            >
              {translate('login.harvestHealth')}
            </motion.h2>
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: 64 }} 
              className="mt-12 h-1.5 bg-white/60 mx-auto rounded-full"
            />
        </div>
      </section>

      {/* Right Side: Login Content */}
      <section className="w-full lg:w-1/2 bg-white flex flex-col relative h-full">
        <button onClick={onBack} className="lg:hidden flex items-center gap-2 px-8 py-8 shrink-0 group active:scale-95 transition-transform">
          <img src="/logo.png" className="h-8 w-8 rounded-full shadow-sm group-hover:scale-105 transition-transform" alt="Logo" />
          <span className="text-xl font-bold text-[#0f5238] font-['Epilogue'] tracking-tight">KisanMitra</span>
        </button>

        <div className="flex-grow overflow-y-auto px-8 lg:px-16 flex flex-col pt-10 lg:pt-20 pb-32">
          <div className="w-full max-w-md mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.3 }}>
                <div className="mb-10">
                  <span className="text-[#0f5238] font-extrabold tracking-[0.2em] text-[10px] uppercase mb-4 block opacity-40">{translate('login.customerAccess')}</span>
                  <h1 className="text-[48px] font-['Epilogue'] font-extrabold tracking-tighter text-[#1b1c13] mb-4 leading-[1.1]">
                    {view === 'signIn' ? translate('login.title.signIn') : view === 'signUp' ? translate('login.title.signUp') : translate('login.title.recovery')}
                  </h1>
                </div>

                {error && <div className="bg-red-50 text-red-600 text-sm p-5 rounded-2xl mb-6 border border-red-100 flex items-center gap-4"><span className="material-symbols-outlined">error</span><b>{error}</b></div>}
                {success && <div className="bg-green-50 text-[#0f5238] text-sm p-5 rounded-2xl mb-6 border border-green-100 flex items-center gap-4"><span className="material-symbols-outlined">check_circle</span><b>{success}</b></div>}

                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-extrabold text-[#1b1c13]/40 uppercase tracking-widest ml-1">{translate('login.email.label')}</label>
                    <input id="email" type="email" placeholder={translate('login.email.placeholder')} required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#f2f4e8]/60 border border-[#bfc9c1]/20 rounded-2xl px-6 py-5 text-[#1b1c13] outline-none focus:bg-white" />
                  </div>
                  {view !== 'resetPassword' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="block text-[11px] font-extrabold text-[#1b1c13]/40 uppercase tracking-widest">{translate('login.password.label')}</label>
                        <button type="button" onClick={() => switchView('resetPassword')} className="text-[10px] font-extrabold text-[#0f5238] uppercase">{translate('login.forgotPassword')}</button>
                      </div>
                      <div className="relative">
                        <input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#f2f4e8]/60 border border-[#bfc9c1]/20 rounded-2xl px-6 py-5 text-[#1b1c13] outline-none focus:bg-white" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-[#1b1c13]/25"><span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span></button>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="w-full bg-[#1b4332] text-white font-extrabold py-5 rounded-2xl flex items-center justify-center gap-3">
                    {loading ? <Spinner /> : translate('login.button.continue')}
                  </button>
                </form>

                {view !== 'resetPassword' && (
                  <>
                    <div className="mt-12 relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#1b1c13]/5"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-extrabold text-[#1b1c13]/20"><span className="bg-white px-8">{translate('login.orContinueWith')}</span></div>
                    </div>
                    <button onClick={handleGoogleSignIn} disabled={loading} className="w-full mt-8 flex items-center justify-center gap-4 bg-white border border-[#1b1c13]/10 py-5 rounded-2xl hover:bg-[#f2f4e8]/30 transition-all font-extrabold text-sm shadow-sm hover:shadow-md">
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
                      {translate('login.googleAuth')}
                    </button>
                  </>
                )}

                <div className="mt-12 pt-10 border-t border-[#1b1c13]/5 flex flex-col items-center">
                  <p className="text-[#1b1c13]/40 text-sm font-bold mb-4">
                    {view === 'signUp' ? translate('login.alreadyMember') : translate('login.customerMemberPrompt')}
                  </p>
                  <button 
                    onClick={() => switchView(view === 'signUp' ? 'signIn' : 'signUp')}
                    className="px-10 py-4 bg-[#f2f4e8] text-[#1b4332] font-extrabold rounded-full hover:bg-white border border-[#1b4332]/10 transition-all duration-300 hover:shadow-lg active:scale-95"
                  >
                    {view === 'signUp' ? translate('login.customerSignInPortal') : translate('login.createAccount')}
                  </button>
                </div>
                <div className="lg:hidden mt-8 flex justify-center">
                   <LanguageSwitcher variant="dark" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Floating Footer inside right side */}
        <footer className="absolute bottom-0 w-full px-12 py-10 bg-gradient-to-t from-white via-white/95 to-transparent flex flex-col md:flex-row justify-between items-center text-[11px] font-black text-[#1b4332]/30 uppercase tracking-widest gap-6">
           <div className="flex gap-10">
              <button className="hover:text-[#1b4332] transition-colors underline underline-offset-8 decoration-[#1b4332]/10">{translate('login.privacy')}</button>
              <button className="hover:text-[#1b4332] transition-colors">{translate('login.terms')}</button>
              <button className="hover:text-[#1b4332] transition-colors">{translate('login.support')}</button>
           </div>
           <div>{translate('login.footer.copyright')}</div>
        </footer>
      </section>
    </div>
  );
};

export default CustomerLogin;
