import React, { useState } from 'react';
import { signIn, signUp, signInWithGoogle, sendPasswordResetEmail } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from './common/Icon';
import Button from './common/Button';
import Spinner from './common/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSwitcher from './common/LanguageSwitcher';

interface LoginProps {
  onBack: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
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
        await signUp(email, password, 'farmer');
      } else if (view === 'signIn') {
        await signIn(email, password, 'farmer');
      } else { // resetPassword
        await sendPasswordResetEmail(email);
        setSuccess('Password reset link sent! Please check your email.');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('auth/invalid-credential')) {
          setError('Invalid email or password.');
        } else if (err.message.includes('auth/email-already-in-use')) {
          setError('This email is already registered.');
        } else if (err.message.includes('auth/weak-password')) {
          setError('Password should be at least 6 characters.');
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

  const switchView = (newView: 'signIn' | 'signUp' | 'resetPassword') => {
    setError(null);
    setSuccess(null);
    setPassword('');
    setView(newView);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans text-[#2D3E33] overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-[20s] animate-pulse-slow scale-110"
        style={{ backgroundImage: 'url("/login_bg.png")' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#E8F1E9]/30 to-white/10 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center px-8 py-6">
        <button onClick={onBack} className="flex items-center space-x-2 group">
          <img src="/logo.png" alt="KisanMitra Logo" className="h-10 w-10 object-contain rounded-full shadow-sm group-hover:scale-110 transition-transform" />
          <span className="text-xl font-bold text-[#1B4332] tracking-tight">KisanMitra</span>
        </button>
        <div className="flex items-center space-x-4">
            <LanguageSwitcher variant="dark" />
        </div>
      </header>

      {/* Main Content - Improved scrollability to avoid clipping */}
      <main className="relative z-10 flex-grow grid md:grid-cols-2 container mx-auto px-8 md:px-12 items-start py-12 lg:items-center">
        {/* Left Side: Branding Text */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden md:flex flex-col space-y-6 max-w-lg pr-12"
        >
          <div className="bg-[#B7C9B1]/30 backdrop-blur-md px-4 py-1 rounded-full w-fit border border-[#B7C9B1]/20">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#1B4332] uppercase">Farmer Portal</span>
          </div>
          <h1 className="text-6xl lg:text-7xl font-bold leading-[1.05] text-[#1B4332]">
            Nurture your <br /> growth.
          </h1>
          <p className="text-lg text-[#2D3E33]/80 font-medium leading-relaxed max-w-sm">
            Access your harvest metrics, community connections, and distribution logistics in one grounded space.
          </p>
        </motion.div>

        {/* Right Side: Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="flex justify-center md:justify-end"
        >
          <div className="w-full max-w-[480px] bg-white/70 backdrop-blur-3xl rounded-[40px] p-10 md:p-14 shadow-[0_32px_64px_-16px_rgba(27,67,50,0.1)] border border-white/40">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-10 text-center md:text-left">
                  <h2 className="text-3xl font-bold text-[#1B4332] mb-3">
                    {view === 'signIn' ? translate('login.title.signIn') : view === 'signUp' ? translate('login.title.signUp') : translate('login.title.recovery')}
                  </h2>
                  <p className="text-[11px] font-bold tracking-[0.15em] text-[#2D3E33]/50 uppercase">
                    {view === 'signIn' ? translate('login.subtitle.signIn') : view === 'signUp' ? translate('login.subtitle.signUp') : translate('login.subtitle.recovery')}
                  </p>
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 text-red-600 text-[13px] font-medium p-4 rounded-2xl mb-6 border border-red-100 flex items-center space-x-3">
                    <Icon name="exclamation-circle" className="h-5 w-5 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
                {success && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-green-50 text-[#1B4332] text-[13px] font-medium p-4 rounded-2xl mb-6 border border-green-100 flex items-center space-x-3">
                    <Icon name="check-circle" className="h-5 w-5 flex-shrink-0" />
                    <span>{success}</span>
                  </motion.div>
                )}

                <form className="space-y-8" onSubmit={handleSubmit}>
                  {/* Email/Phone Field */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold tracking-[0.2em] text-[#1B4332] uppercase flex justify-between">
                      {view === 'signIn' ? translate('login.email.label') : translate('login.email.label')}
                    </label>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#1B4332]/30 group-focus-within:text-[#1B4332] transition-colors">
                        <Icon name="mail" className="h-5 w-5" />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder={view === 'signIn' ? translate('login.email.placeholder') : "you@farm.com"}
                        className="w-full bg-[#E8F1E9]/40 border-none rounded-2xl py-4 pl-14 pr-6 text-[15px] focus:ring-2 focus:ring-[#1B4332]/20 placeholder-[#1B4332]/20 text-[#1B4332] transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  {view !== 'resetPassword' && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold tracking-[0.2em] text-[#1B4332] uppercase flex justify-between">
                        {translate('login.password.label')}
                      </label>
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#1B4332]/30 group-focus-within:text-[#1B4332] transition-colors">
                          <Icon name="lock-closed" className="h-5 w-5" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          className="w-full bg-[#E8F1E9]/40 border-none rounded-2xl py-4 pl-14 pr-12 text-[15px] focus:ring-2 focus:ring-[#1B4332]/20 text-[#1B4332] transition-all"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-[#1B4332]/30 hover:text-[#1B4332] transition-colors"
                        >
                          <Icon name={showPassword ? "eye-off" : "eye"} className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Options */}
                  <div className="flex items-center justify-between px-2">
                    {view === 'signIn' ? (
                      <>
                        <label className="flex items-center space-x-3 cursor-pointer group">
                          <div className="relative">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-5 h-5 bg-[#E8F1E9]/40 rounded-md border border-[#1B4332]/10 peer-checked:bg-[#1B4332] transition-all" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100">
                              <Icon name="check" className="h-3 w-3 text-white" />
                            </div>
                          </div>
                          <span className="text-[12px] font-semibold text-[#2D3E33]/60 group-hover:text-[#1B4332] transition-colors">{translate('login.rememberMe')}</span>
                        </label>
                        <button type="button" onClick={() => switchView('resetPassword')} className="text-[12px] font-bold text-[#1B4332] hover:underline">{translate('login.forgotPassword')}</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => switchView('signIn')} className="text-[12px] font-bold text-[#1B4332] hover:underline">{translate('login.alreadyMember')}</button>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1B4332] text-white py-5 rounded-2xl font-bold tracking-[0.2em] uppercase text-sm hover:bg-[#2D6A4F] transition-all shadow-xl shadow-[#1B4332]/20 disabled:opacity-50 flex items-center justify-center relative overflow-hidden group"
                  >
                    <span className="relative z-10">{loading ? <Spinner /> : (view === 'signIn' ? translate('login.button.login') : translate('login.button.signUp'))}</span>
                    <div className="absolute inset-0 bg-[#081c15] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  </button>
                </form>

                <div className="mt-12 text-center">
                  <p className="text-[13px] font-medium text-[#2D3E33]/60">
                    {view === 'signIn' ? translate('login.newToApp') : translate('login.alreadyMember')} {' '}
                    <button 
                      onClick={() => switchView(view === 'signIn' ? 'signUp' : 'signIn')}
                      className="font-bold text-[#1B4332] hover:underline"
                    >
                      {view === 'signIn' ? translate('login.createAccount') : translate('login.signInNow')}
                    </button>
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex flex-col md:flex-row justify-between items-center px-8 py-10 opacity-50 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-2">
          <Icon name="leaf" className="h-8 w-8 text-[#1B4332]" />
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase">{translate('login.footer.copyright')}</span>
        </div>
        <div className="flex space-x-8 text-[9px] font-bold tracking-[0.2em] uppercase">
          <button className="hover:text-[#1B4332] transition-colors">{translate('login.privacy')}</button>
          <button className="hover:text-[#1B4332] transition-colors">{translate('login.terms')}</button>
          <button className="hover:text-[#1B4332] transition-colors">{translate('login.support')}</button>
        </div>
      </footer>
    </div>
  );
};

export default Login;
