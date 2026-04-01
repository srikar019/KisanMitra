import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import { logout } from './services/authService';
import { ActiveView, FarmerProfile, ProductListing } from './types';
import { viewToPath, pathToView } from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import ToastContainer from './components/common/ToastContainer';

// ─── Eagerly loaded (critical path) ─────────────────────────────────────
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';

// ─── Lazy loaded (code-split per route) ──────────────────────────────────
const Login = React.lazy(() => import('./components/Login'));
const CustomerLogin = React.lazy(() => import('./components/CustomerLogin'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const Weather = React.lazy(() => import('./components/Weather'));
const DiseaseDetection = React.lazy(() => import('./components/DiseaseDetection'));
const PlantingRecommendations = React.lazy(() => import('./components/PlantingRecommendations'));
const MarketPrices = React.lazy(() => import('./components/MarketPrices'));
const CropYieldPrediction = React.lazy(() => import('./components/CropYieldPrediction'));
const ProfitForecaster = React.lazy(() => import('./components/CropRotation'));
const DirectMarketplace = React.lazy(() => import('./components/DirectMarketplace').then(m => ({ default: m.default })));
const CSAManagement = React.lazy(() => import('./components/DirectMarketplace').then(m => ({ default: m.CSAManagement })));
const CommunityPage = React.lazy(() => import('./components/CommunityPage'));
const FarmerChat = React.lazy(() => import('./components/FarmerChat'));
const NegotiationChat = React.lazy(() => import('./components/NegotiationChat'));
const FarmerProfilePage = React.lazy(() => import('./components/FarmerProfile'));
const FeatureStore = React.lazy(() => import('./components/FeatureStore'));
const IndianAgriNews = React.lazy(() => import('./components/IndianAgriNews'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const FarmerDeals = React.lazy(() => import('./components/FarmerDeals'));
const FarmAssetsExchange = React.lazy(() => import('./components/FarmAssetsExchange'));
const MyFarmPage = React.lazy(() => import('./components/MyFarmPage'));
const Chatbot = React.lazy(() => import('./components/Chatbot'));
const CustomerPortal = React.lazy(() => import('./components/PriceBroker').then(m => ({ default: m.CustomerPortal })));

// ─── View → Component mapping ────────────────────────────────────────────
const VIEW_COMPONENT_MAP: Record<string, React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>> = {
  weather: Weather as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  'health-analysis': DiseaseDetection as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  planting: PlantingRecommendations as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  'market-prices': MarketPrices as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  'yield-prediction': CropYieldPrediction as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  'profit-forecaster': ProfitForecaster as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  marketplace: DirectMarketplace as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  community: CommunityPage as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  'assets-exchange': FarmAssetsExchange as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  csa: CSAManagement as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  features: FeatureStore as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  news: IndianAgriNews as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  profile: FarmerProfilePage as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  deals: FarmerDeals as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
  'my-farm': MyFarmPage as React.LazyExoticComponent<React.FC<{ onStartChat?: (r: FarmerProfile) => void }>>,
};

// ─── Suspense Fallbacks ───────────────────────────────────────────────────
const ViewSpinner: React.FC = () => {
    const { translate } = useLanguage();
    return (
        <div className="flex justify-center items-center py-24">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-500 font-medium">{translate('header.loadingModule')}</span>
            </div>
        </div>
    );
};

const FullScreenSpinner: React.FC = () => {
    const { translate } = useLanguage();
    return (
        <div className="flex justify-center items-center min-h-screen bg-green-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-green-500 border-dashed rounded-full animate-spin"></div>
                <span className="text-sm text-gray-500 font-medium">{translate('header.initializingApp')}</span>
            </div>
        </div>
    );
};

// ─── Protected Route Guard ───────────────────────────────────────────────
const ProtectedRoute: React.FC<{ allowedRoles: string[]; children: React.ReactNode }> = ({ allowedRoles, children }) => {
  const { currentUser, userProfile, loading, isAuthenticating } = useAuth();

  if (loading || isAuthenticating) {
    return <FullScreenSpinner />;
  }

  if (!currentUser || !userProfile) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ─── Dynamic Farm View Route ─────────────────────────────────────────────
const FarmViewRoute: React.FC = () => {
  const { viewSlug } = useParams<{ viewSlug: string }>();
  const navigate = useNavigate();
  const view = viewSlug ? pathToView[viewSlug] : undefined;

  const handleStartChat = React.useCallback((recipient: FarmerProfile) => {
    navigate(`/farm/chat/${recipient.uid}`, { state: { recipient } });
  }, [navigate]);

  if (!view || !VIEW_COMPONENT_MAP[viewSlug!]) {
    return <Navigate to="/farm/weather" replace />;
  }

  const ViewComponent = VIEW_COMPONENT_MAP[viewSlug!];

  // Community page gets the onStartChat prop
  if (viewSlug === 'community') {
    return (
      <Suspense fallback={<ViewSpinner />}>
        <ViewComponent onStartChat={handleStartChat} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ViewSpinner />}>
      <ViewComponent />
    </Suspense>
  );
};

// ─── Farm Chat Route ─────────────────────────────────────────────────────
const FarmChatRoute: React.FC = () => {
  const navigate = useNavigate();
  const { state } = window.history;
  const recipient = state?.usr?.recipient as FarmerProfile | undefined;

  const handleBack = React.useCallback(() => {
    navigate('/farm/community');
  }, [navigate]);

  if (!recipient) {
    return <Navigate to="/farm/community" replace />;
  }

  return (
    <Suspense fallback={<ViewSpinner />}>
      <FarmerChat recipient={recipient} onBack={handleBack} />
    </Suspense>
  );
};

// ─── Farmer Layout ───────────────────────────────────────────────────────
const FarmerLayout: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  // Derive the active view from the current URL
  const currentPath = window.location.pathname;
  const viewSlug = currentPath.split('/farm/')[1]?.split('/')[0] || 'weather';
  const activeView = pathToView[viewSlug] || ActiveView.Weather;

  const validViews = Object.values(ActiveView);
  const defaultFeatures = [ActiveView.Weather];
  const userFeatures = (userProfile?.enabledFeatures || []).filter(feature => validViews.includes(feature));
  const combinedFeatures = [...defaultFeatures, ...userFeatures];
  const sidebarFeatures = Array.from(new Set(combinedFeatures));

  const handleProfileClick = React.useCallback(() => {
    navigate('/farm/profile');
    setIsSidebarOpen(false);
  }, [navigate]);

  const handleStartChat = React.useCallback((recipient: FarmerProfile) => {
    navigate(`/farm/chat/${recipient.uid}`, { state: { recipient } });
  }, [navigate]);

  const handleNavigate = React.useCallback((view: ActiveView) => {
    navigate(`/farm/${viewToPath[view]}`);
    setIsSidebarOpen(false);
  }, [navigate]);

  const handleSetActiveView = React.useCallback((view: ActiveView) => {
    navigate(`/farm/${viewToPath[view]}`);
  }, [navigate]);

  const toggleSidebar = React.useCallback(() => setIsSidebarOpen(prev => !prev), []);

  return (
    <NotificationProvider>
      <div className="flex flex-col min-h-screen bg-green-50 font-sans text-gray-800">
        <Header toggleSidebar={toggleSidebar} onProfileClick={handleProfileClick} onNavigateToChat={handleStartChat} onNavigate={handleNavigate} onLogout={logout} />
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          activeView={activeView}
          setActiveView={handleSetActiveView}
          enabledFeatures={sidebarFeatures}
        />
        <main className="flex-grow container mx-auto px-4 py-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <Footer />
        <Suspense fallback={null}>
          <Chatbot />
        </Suspense>
      </div>
    </NotificationProvider>
  );
};

// ─── Customer Layout ─────────────────────────────────────────────────────
const CustomerLayout: React.FC = () => {
  const navigate = useNavigate();
  const [negotiationSession, setNegotiationSession] = React.useState<{ listing: ProductListing; customer: FarmerProfile } | null>(null);

  const handleStartNegotiation = React.useCallback((listing: ProductListing, customer: FarmerProfile) => {
    setNegotiationSession({ listing, customer });
  }, []);

  const handleEndNegotiation = React.useCallback(() => {
    setNegotiationSession(null);
  }, []);

  if (negotiationSession) {
    return (
      <Suspense fallback={<FullScreenSpinner />}>
        <NegotiationChat
          listing={negotiationSession.listing}
          customer={negotiationSession.customer}
          onBack={handleEndNegotiation}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <CustomerPortal onBack={logout} onStartNegotiation={handleStartNegotiation} />
    </Suspense>
  );
};

// ─── Landing Page Wrapper ────────────────────────────────────────────────
const LandingPageWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, loading, isAuthenticating } = useAuth();

  if (loading || isAuthenticating) {
    return <FullScreenSpinner />;
  }

  // Redirect logged-in users to their portal
  if (currentUser && userProfile) {
    if (userProfile.role === 'admin') return <Navigate to="/admin" replace />;
    if (userProfile.role === 'farmer') return <Navigate to="/farm/weather" replace />;
    if (userProfile.role === 'customer') return <Navigate to="/customer" replace />;
  }

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <LandingPage
        onNavigateToFarmer={() => navigate('/login/farmer')}
        onNavigateToCustomer={() => navigate('/login/customer')}
      />
    </Suspense>
  );
};

// ─── Login Wrappers ──────────────────────────────────────────────────────
const FarmerLoginWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (currentUser && userProfile?.role === 'farmer') return <Navigate to="/farm/weather" replace />;

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Login onBack={() => navigate('/')} />
    </Suspense>
  );
};

const CustomerLoginWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (currentUser && userProfile?.role === 'customer') return <Navigate to="/customer" replace />;

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <CustomerLogin onBack={() => navigate('/')} />
    </Suspense>
  );
};

// ─── Root App ────────────────────────────────────────────────────────────
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPageWrapper />} />
                <Route path="/login/farmer" element={<FarmerLoginWrapper />} />
                <Route path="/login/customer" element={<CustomerLoginWrapper />} />

                {/* Farmer portal (protected) */}
                <Route
                  path="/farm"
                  element={
                    <ProtectedRoute allowedRoles={['farmer', 'admin']}>
                      <FarmerLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="weather" replace />} />
                  <Route path=":viewSlug" element={<FarmViewRoute />} />
                  <Route path="chat/:recipientId" element={<FarmChatRoute />} />
                </Route>

                {/* Customer portal (protected) */}
                <Route
                  path="/customer"
                  element={
                    <ProtectedRoute allowedRoles={['customer', 'admin']}>
                      <CustomerLayout />
                    </ProtectedRoute>
                  }
                />

                {/* Admin portal (protected) */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<FullScreenSpinner />}>
                        <AdminDashboard />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all — redirect to landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <ToastContainer />
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

export default App;
