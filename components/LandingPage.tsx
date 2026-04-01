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

const LandingHeader: React.FC<LandingPageProps> = ({ onNavigateToFarmer, onNavigateToCustomer }) => {
  const { translate } = useLanguage();
  return (
    <header className="absolute top-0 left-0 w-full z-20 py-4 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3 rounded-full bg-black/10 backdrop-blur-sm pr-4 pl-2 py-1 border border-white/20">
          <img src="/logo.png" alt="KisanMitra Logo" className="h-10 w-10 object-contain rounded-full overflow-hidden" />
          <h1 className="text-xl font-bold text-white text-shadow">KisanMitra</h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <LanguageSwitcher />
          <button
            onClick={onNavigateToCustomer}
            className="px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 bg-black/10 text-white border border-white/30 hover:bg-black/20 backdrop-blur-sm"
          >
            {translate('landing.header.customerPortal')}
          </button>
          <button
            onClick={onNavigateToFarmer}
            className="flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 bg-black/10 text-white border border-white/30 hover:bg-black/20 backdrop-blur-sm"
          >
            <Icon name="user-circle" className="h-5 w-5 mr-2"/>
            {translate('landing.header.farmerLogin')}
          </button>
        </div>
      </div>
    </header>
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
    <div className="bg-green-50 text-gray-800 font-sans">
      <LandingHeader onNavigateToFarmer={onNavigateToFarmer} onNavigateToCustomer={onNavigateToCustomer} />

      {/* Hero Section */}
      <main
        className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
        style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1932&auto=format&fit=crop')",
            backgroundSize: 'cover',
            backgroundPosition: 'center center'
        }}
      >
        <div className="absolute inset-0 bg-teal-900/50" aria-hidden="true"></div>
         <div className="absolute w-72 h-72 bg-white/10 rounded-full animate-blob -top-4 -left-12 filter blur-xl opacity-70"></div>
         <div className="absolute w-96 h-96 bg-white/10 rounded-full animate-blob animation-delay-4000 bottom-0 -right-12 filter blur-xl opacity-70"></div>
        <div className="relative z-[1] text-center text-white">
            <h2 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight tracking-tight text-shadow">
                {translate('landing.hero.title')}
            </h2>
            <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 text-shadow">
                {translate('landing.hero.subtitle')}
            </p>
            <a href="#features" className="bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold py-3 px-8 rounded-full text-lg hover:shadow-xl hover:scale-105 transition-all duration-300 inline-block shadow-lg">
                {translate('landing.hero.explore')}
            </a>
        </div>
      </main>

      {/* Farmer Features Section */}
      <section 
        id="features" 
        className="relative py-20 px-4 overflow-hidden"
        style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=1600&auto=format&fit=crop')",
            backgroundSize: 'cover',
            backgroundPosition: 'center center'
        }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true"></div>
        <div className="relative z-20 max-w-6xl mx-auto py-14">
            <header className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-semibold text-white text-shadow drop-shadow-lg">
                {translate('landing.farmerFeatures.title')}
              </h1>
              <p className="mt-3 text-sm md:text-base text-white/85 max-w-2xl mx-auto">
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
                          className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center text-center backdrop-blur bg-white/10 border border-white/20 shadow-lg"
                          style={{ translateX: "-50%", translateY: "-50%" }}
                          aria-label={tool.label}
                        >
                          <div className={`flex flex-col items-center justify-center transition-opacity duration-300 ${hoveredTool?.id === tool.id ? 'opacity-0' : 'opacity-100'}`}>
                            <Icon name={tool.icon} className="h-7 w-7 text-white/95 mb-1"/>
                            <div className="text-sm text-white font-medium leading-tight px-2">{tool.label}</div>
                          </div>

                          {hoveredTool?.id === tool.id && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-800/80 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm animate-fade-in">
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
                  <Icon name="x-mark" className="h-6 w-6"/>
                </button>
                <div className="flex flex-col items-center gap-3">
                  <div className="text-emerald-600 text-3xl">
                     <Icon name={selectedTool.icon} className="h-10 w-10 text-emerald-600"/>
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
