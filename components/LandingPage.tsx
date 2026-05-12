import React, { useState, useMemo } from 'react';
import { motion, useTime, useTransform } from 'framer-motion';
import Icon from './common/Icon';
import Footer from './Footer';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './common/LanguageSwitcher';

interface LandingPageProps {
  onNavigateToFarmer: () => void;
  onNavigateToCustomer: () => void;
}

const AetheraHero: React.FC<LandingPageProps> = ({ onNavigateToFarmer, onNavigateToCustomer }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col font-sans text-gray-600 selection:bg-black selection:text-white">
      {/* Navigation Shell */}
      <nav className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-7xl rounded-full px-8 py-4 bg-white/70 backdrop-blur-xl flex justify-between items-center z-50 shadow-[0_40px_80px_-10px_rgba(0,0,0,0.04)]">
        <div className="font-headline text-3xl font-bold tracking-tighter text-black flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-full" />
          KisanMitra
        </div>
        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          <a className="text-black font-bold text-[10px] uppercase tracking-widest" href="#">Home</a>
          <a className="text-gray-500 font-medium text-[10px] uppercase tracking-widest hover:text-black transition-colors duration-300" href="#features">Features</a>
          <a className="text-gray-500 font-medium text-[10px] uppercase tracking-widest hover:text-black transition-colors duration-300" href="#customer-features">Market</a>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateToCustomer}
            className="text-black font-sans font-medium text-sm px-4 py-2 rounded-full hover:bg-black/5 active:scale-95 transition-all duration-300"
          >
            Customer Portal
          </button>
          <button
            onClick={onNavigateToFarmer}
            className="bg-black text-white font-sans text-sm px-6 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Farmer Login
          </button>
        </div>
      </nav>

      {/* Video Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-gray-100">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/landingpage.mp4" type="video/mp4" />
        </video>
        {/* A tiny bit of lightness to make black text readable, but no harsh gradients covering the image */}
        <div className="absolute inset-0 bg-white/40 pointer-events-none"></div>
      </div>

      {/* Hero Content Section */}
      <main className="relative z-10 flex-grow flex items-center justify-center pt-24 pb-12 px-6 top-24">
        <div className="max-w-6xl w-full flex flex-col items-center text-center">
          <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl text-black leading-[0.95] tracking-[-0.03em] animate-fade-rise">
            Empowering <span className="text-gray-600 italic">farmers,</span><br />
            we nourish <span className="text-gray-600 italic">the world.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-gray-600 text-lg md:text-xl font-light leading-relaxed animate-fade-rise-delay">
            Skip the middleman and connect directly built for the future.
            We provide local farmers with cutting-edge crop insights and buyers with fair-priced, fresh produce.
          </p>
          <div className="mt-12 animate-fade-rise-delay-2">
            <button
              onClick={onNavigateToFarmer}
              className="group relative px-10 py-5 bg-black text-white rounded-full overflow-hidden transition-transform duration-300 hover:scale-[1.03] active:scale-95 shadow-xl"
            >
              <span className="relative z-10 font-sans text-lg tracking-wide">Begin Journey</span>
              <div className="absolute inset-0 bg-gradient-to-tr from-black to-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </button>
          </div>

          {/* Secondary Visual Anchor */}
          <div className="mt-24 flex items-center gap-4 animate-fade-rise-delay-2 opacity-40">
            <div className="h-[1px] w-12 bg-gray-400"></div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-medium text-black">Est. MMXXIV</span>
            <div className="h-[1px] w-12 bg-gray-400"></div>
          </div>
        </div>
      </main>

      {/* Decorative Scroll Indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-50 animate-bounce z-10">
        <span className="text-[9px] uppercase tracking-widest font-bold text-black">Explore</span>
        <span className="material-symbols-outlined text-black text-sm">expand_more</span>
      </div>
    </div>
  );
};

interface Tool {
  id: number;
  label: string;
  icon: string;
  description: string;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToFarmer, onNavigateToCustomer }) => {
  const { translate } = useLanguage();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);

  const time = useTime();
  // Complete a full rotation every 40 seconds for a gentle effect
  const rotation = useTransform(time, [0, 40000], [0, 360], { clamp: false });

  const farmerTools: Tool[] = useMemo(() => [
    { id: 1, label: translate('landing.tool.weather.label'), icon: 'cloud', description: translate('landing.tool.weather.desc') },
    { id: 2, label: translate('landing.tool.yield.label'), icon: 'chart-bar', description: translate('landing.tool.yield.desc') },
    { id: 3, label: translate('landing.tool.swap.label'), icon: 'arrows-right-left', description: translate('landing.tool.swap.desc') },
    { id: 4, label: translate('landing.tool.community.label'), icon: 'users', description: translate('landing.tool.community.desc') },
    { id: 5, label: translate('landing.tool.marketplace.label'), icon: 'shopping-bag', description: translate('landing.tool.marketplace.desc') },
    { id: 6, label: translate('landing.tool.profit.label'), icon: 'calculator', description: translate('landing.tool.profit.desc') },
    { id: 7, label: translate('landing.tool.marketPrice.label'), icon: 'trending-up', description: translate('landing.tool.marketPrice.desc') },
    { id: 8, label: translate('landing.tool.health.label'), icon: 'shield-check', description: translate('landing.tool.health.desc') },
  ], [translate]);

  const customerFeatures: Tool[] = useMemo(() => [
    { id: 1, label: translate('landing.customer.marketplace.label'), icon: 'shopping-bag', description: translate('landing.customer.marketplace.desc') },
    { id: 2, label: translate('landing.customer.recipe.label'), icon: 'book-open', description: translate('landing.customer.recipe.desc') },
    { id: 3, label: translate('landing.customer.subscriptions.label'), icon: 'collection', description: translate('landing.customer.subscriptions.desc') },
    { id: 4, label: translate('landing.customer.broker.label'), icon: 'tag', description: translate('landing.customer.broker.desc') },
  ], [translate]);

  return (
    <div className="bg-[#f9f9f9] text-gray-800 font-sans">
      <AetheraHero onNavigateToFarmer={onNavigateToFarmer} onNavigateToCustomer={onNavigateToCustomer} />

      {/* Farmer Features Section */}
      {/* Farmer Features Section */}
      <section
        id="features"
        className="relative py-20 px-4 overflow-hidden"
        style={{
          backgroundImage: "url('/lush_farm.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center center'
        }}
      >
        {/* Cinematic dark overlay to ensure text readability over the natural photography */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden="true"></div>
        <div className="relative z-20 max-w-6xl mx-auto py-14">
          <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-tight drop-shadow-lg">
              {translate('landing.farmerFeatures.title')}
            </h1>
            <p className="mt-3 text-sm md:text-base text-gray-200 max-w-2xl mx-auto font-light leading-relaxed">
              {translate('landing.farmerFeatures.subtitle')}
            </p>
          </header>

          <main className="flex items-center justify-center">
            <div className="relative w-full max-w-[800px] h-[750px] mx-auto">
              {/* Static Seed Icon */}
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
              >
                <div className="w-36 h-36 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400/30 to-yellow-300/25 border border-emerald-200/30 backdrop-blur-md shadow-[0_8px_40px_rgba(34,197,94,0.12)]">
                  <svg width="84" height="84" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <radialGradient id="seedGrad" cx="50%" cy="30%" r="60%">
                        <stop offset="0%" stopColor="#fff7cc" />
                        <stop offset="50%" stopColor="#ffe27a" />
                        <stop offset="100%" stopColor="#ffb347" />
                      </radialGradient>
                    </defs>
                    <circle cx="32" cy="32" r="30" fill="rgba(30,58,138,0.06)" />
                    <path d="M32 12C40 20 44 30 32 44C20 30 24 20 32 12Z" fill="url(#seedGrad)" stroke="#ffd87a" strokeOpacity="0.95" strokeWidth="1.2" />
                  </svg>
                </div>
              </div>

              {/* Container for orbiting buttons */}
              <motion.div
                className="absolute inset-0"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: "circOut", delay: 0.5 }}
              >
                {farmerTools.map((tool, i) => {
                  const angleInDegrees = (i / farmerTools.length) * 360 - 90; // -90 to start at the top
                  const radius = 280; // Radius for the feature wheel

                  // Create a motion value for this specific item's angle, which changes over time
                  const rotatedAngle = useTransform(rotation, (currentRotation) => currentRotation + angleInDegrees);

                  // Transform the angle into x and y coordinates
                  const x = useTransform(rotatedAngle, (angle) => radius * Math.cos(angle * Math.PI / 180));
                  const y = useTransform(rotatedAngle, (angle) => radius * Math.sin(angle * Math.PI / 180));

                  return (
                    <motion.div
                      key={tool.id}
                      className="absolute left-1/2 top-1/2"
                      style={{ x, y }}
                    >
                      <motion.button
                        onClick={() => setSelectedTool(tool)}
                        onMouseEnter={() => setHoveredTool(tool)}
                        onMouseLeave={() => setHoveredTool(null)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center text-center backdrop-blur-md bg-white/10 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/20 hover:shadow-[0_8px_40px_rgba(34,197,94,0.2)]"
                        style={{ translateX: "-50%", translateY: "-50%" }}
                        aria-label={tool.label}
                      >
                        <div className={`flex flex-col items-center justify-center transition-opacity duration-300 ${hoveredTool?.id === tool.id ? 'opacity-0' : 'opacity-100'}`}>
                          <Icon name={tool.icon} className="h-7 w-7 text-white drop-shadow-md mb-1" />
                          <div className="text-sm text-white font-medium leading-tight px-2 drop-shadow-md">{tool.label}</div>
                        </div>

                        {hoveredTool?.id === tool.id && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500/90 to-emerald-700/95 text-white text-xs px-3 py-2 rounded-full animate-fade-in shadow-inner border border-emerald-400/50 backdrop-blur-md">
                            {tool.description}
                          </div>
                        )}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </main>

          <div className="mt-10 flex items-center justify-center gap-6">
            <button onClick={onNavigateToFarmer} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-400 text-white font-semibold shadow-md hover:scale-[1.01] transition-transform">
              {translate('landing.farmerFeatures.tryFree')}
            </button>
          </div>
        </div>

        {selectedTool && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
            <div className="relative bg-gradient-to-br from-emerald-50 to-white rounded-3xl shadow-xl max-w-md w-full p-8 text-center animate-fade-in-up">
              <button
                onClick={() => setSelectedTool(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-200"
                aria-label="Close modal"
              >
                <Icon name="x-mark" className="h-6 w-6" />
              </button>
              <div className="flex flex-col items-center gap-3">
                <div className="text-emerald-600 text-3xl">
                  <Icon name={selectedTool.icon} className="h-10 w-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800">{selectedTool.label}</h2>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">{selectedTool.description}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Customer Features Section */}
      <section
        id="customer-features"
        className="relative py-20 px-4 overflow-hidden"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1974&auto=format&fit=crop')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/40" aria-hidden="true"></div>
        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-semibold text-white text-shadow drop-shadow-lg">
              {translate('landing.customerFeatures.title')}
            </h2>
            <p className="mt-4 text-lg text-white/90 max-w-3xl mx-auto">
              {translate('landing.customerFeatures.subtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {customerFeatures.map((feature, index) => (
              <motion.div
                key={feature.id}
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-white text-center flex flex-col items-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="bg-white/10 p-4 rounded-full mb-4">
                  <Icon name={feature.icon} className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.label}</h3>
                <p className="text-sm text-white/80 flex-grow">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button onClick={onNavigateToCustomer} className="px-8 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-semibold shadow-md hover:scale-[1.01] transition-transform">
              {translate('landing.customerFeatures.exploreMarket')}
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
