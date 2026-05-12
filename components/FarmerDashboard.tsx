import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWeather } from '../contexts/WeatherContext';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Icon from './common/Icon';
import Card from './common/Card';
import { Link } from 'react-router-dom';
import { onProductsSnapshot, onRetailOrdersForFarmerSnapshot, onDealRequestsSnapshot } from '../services/marketplaceService';
import { onFeedSnapshot } from '../services/communityFeedService';
import { ProductListing, RetailOrder, DealRequest, CommunityFeedPost } from '../types';

const FarmerDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const { translate } = useLanguage();
  const { weatherData, location, displayLocation } = useWeather();
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeListingsCount, setActiveListingsCount] = useState<number>(0);
  const [revenue, setRevenue] = useState<number>(0);
  const [pendingDealsCount, setPendingDealsCount] = useState<number>(0);
  const [recentOrders, setRecentOrders] = useState<RetailOrder[]>([]);
  const [feedPosts, setFeedPosts] = useState<CommunityFeedPost[]>([]);

  useEffect(() => {
    if (!userProfile?.uid) return;

    const unsubscribeProducts = onProductsSnapshot((listings) => {
      const farmerListings = listings.filter(l => l.farmerUid === userProfile.uid);
      setActiveListingsCount(farmerListings.length);
    });

    const unsubscribeOrders = onRetailOrdersForFarmerSnapshot(userProfile.uid, (orders) => {
      const totalRev = orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
      setRevenue(totalRev);
      // Sort orders by most recent first
      const sorted = [...orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setRecentOrders(sorted.slice(0, 5));
    }, (error) => console.error(error));

    const unsubscribeDeals = onDealRequestsSnapshot(userProfile.uid, (deals) => {
      setPendingDealsCount(deals.length);
    });

    const unsubscribeFeed = onFeedSnapshot((posts) => {
      setFeedPosts(posts.slice(0, 3));
    }, (error) => console.error(error));

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeDeals();
      unsubscribeFeed();
    };
  }, [userProfile?.uid]);

  useGSAP(() => {
    // 1. Entrance animation (staggered fade-in and slide-up)
    gsap.from('.dashboard-card', {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'back.out(1.2)',
      clearProps: 'all' // Cleanup inline styles after animation
    });

    // 2. Greeting animation
    gsap.from('.dashboard-greeting', {
      x: -30,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      clearProps: 'all'
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header / Greeting */}
      <div className="dashboard-greeting flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {userProfile?.name || 'Farmer'}! 🌾
          </h1>
          <p className="text-gray-500 mt-2 text-sm md:text-base">
            Here's what's happening on your farm today.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          <Link to="/farm/marketplace" className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm">
            <Icon name="plus" className="w-5 h-5 mr-2" />
            New Listing
          </Link>
          <Link to="/farm/features" className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 transition-colors">
            <Icon name="sparkles" className="w-5 h-5 mr-2" />
            AI Store
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid (Row 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Weather Card */}
        <Link to="/farm/weather" className="dashboard-card block group">
          <Card className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-white">
            <div className="p-6 relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                  <Icon name="sun" className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Weather</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{weatherData?.currentWeather.temperature ? `${Math.round(weatherData.currentWeather.temperature)}°C` : '--°C'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-auto pt-2 border-t border-gray-50">
                {weatherData?.currentWeather.condition || 'Loading...'} • {displayLocation || location || 'Unknown'}
              </p>
            </div>
            <div className="absolute -bottom-4 -right-4 text-blue-50 opacity-20 pointer-events-none">
              <Icon name="sun" className="w-32 h-32" />
            </div>
          </Card>
        </Link>

        {/* Active Listings Card */}
        <Link to="/farm/marketplace" className="dashboard-card block group">
          <Card className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-white">
            <div className="p-6 relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-green-50 rounded-xl text-green-600 group-hover:scale-110 transition-transform">
                  <Icon name="shopping-cart" className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Active Listings</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{activeListingsCount}</span>
              </div>
              <p className="text-xs text-green-600 font-medium mt-auto pt-2 border-t border-gray-50 flex items-center">
                <Icon name="trending-up" className="w-3 h-3 mr-1" />
                Live on marketplace
              </p>
            </div>
            <div className="absolute -bottom-4 -right-4 text-green-50 opacity-20 pointer-events-none">
              <Icon name="shopping-cart" className="w-32 h-32" />
            </div>
          </Card>
        </Link>

        {/* Revenue Card */}
        <div className="dashboard-card block group">
          <Card className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-white">
            <div className="p-6 relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                  <Icon name="currency-rupee" className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Revenue</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">₹{revenue.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-gray-500 mt-auto pt-2 border-t border-gray-50">
                From completed retail orders
              </p>
            </div>
            <div className="absolute -bottom-4 -right-4 text-purple-50 opacity-20 pointer-events-none">
              <Icon name="currency-rupee" className="w-32 h-32" />
            </div>
          </Card>
        </div>

        {/* Pending Deals Card */}
        <Link to="/farm/my-deals" className="dashboard-card block group">
          <Card className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden bg-white">
            <div className="p-6 relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-orange-50 rounded-xl text-orange-600 group-hover:scale-110 transition-transform">
                  <Icon name="clipboard-check" className="w-6 h-6" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Deals</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-gray-900">{pendingDealsCount}</span>
              </div>
              <p className="text-xs text-orange-600 font-medium mt-auto pt-2 border-t border-gray-50 flex items-center">
                Needs your attention
              </p>
            </div>
            <div className="absolute -bottom-4 -right-4 text-orange-50 opacity-20 pointer-events-none">
              <Icon name="clipboard-check" className="w-32 h-32" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Analytics (Row 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Sales Overview */}
        <div className="dashboard-card bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Icon name="chart-bar" className="w-5 h-5 mr-2 text-[#006b2c]" />
              Sales Overview
            </h3>
            <div className="flex gap-2">
              <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded">Week</span>
              <span className="text-xs font-medium px-2 py-1 bg-[#006b2c] text-white rounded shadow-sm">Month</span>
            </div>
          </div>
          
          {/* Placeholder Chart */}
          <div className="h-48 flex items-end justify-between gap-2 border-b border-gray-100 pb-2">
            {[40, 70, 45, 90, 65, 100].map((height, i) => (
              <div key={i} className="w-1/6 group relative flex justify-center">
                <div 
                  className="w-full max-w-[40px] bg-green-100 hover:bg-[#006b2c] transition-colors rounded-t-md"
                  style={{ height: `${height}%` }}
                ></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="dashboard-card bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Icon name="document-text" className="w-5 h-5 mr-2 text-purple-600" />
              Recent Transactions
            </h3>
            <Link to="/farm/my-deals" className="text-sm text-[#006b2c] font-medium hover:underline">View all</Link>
          </div>
          
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Icon name="clipboard-check" className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 font-medium">No transactions yet.</p>
              <p className="text-xs text-gray-400">Your completed sales will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 rounded-t-lg">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg font-medium">Crop</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 capitalize">{order.productName || 'Crop'}</td>
                      <td className="px-4 py-3 text-gray-600">{order.quantityBought} {order.unit}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">+₹{order.totalPrice?.toLocaleString('en-IN') || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Farm Status (Row 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* My Crops Status */}
        <div className="dashboard-card bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Icon name="sparkles" className="w-5 h-5 mr-2 text-[#006b2c]" />
              My Crops Status
            </h3>
            <Link to="/farm/planting" className="text-sm text-[#006b2c] font-medium hover:underline">Manage</Link>
          </div>
          
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-[#006b2c] mb-3">
              <Icon name="sparkles" className="w-8 h-8" />
            </div>
            <p className="text-gray-900 font-medium mb-1">No crops tracked yet</p>
            <p className="text-sm text-gray-500 mb-4 max-w-[200px]">Add your planted crops to monitor their growth progress.</p>
            <Link to="/farm/planting" className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
              Add Crop
            </Link>
          </div>
        </div>

        {/* Community Highlights */}
        <div className="dashboard-card bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Icon name="users" className="w-5 h-5 mr-2 text-[#006b2c]" />
              Community Highlights
            </h3>
            <Link to="/farm/community" className="text-sm text-[#006b2c] font-medium hover:underline">View all</Link>
          </div>
          
          {feedPosts.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-32 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
               <Icon name="users" className="w-8 h-8 text-gray-400 mb-2" />
               <p className="text-sm text-gray-500 font-medium">Your feed is quiet.</p>
               <p className="text-xs text-gray-400 mt-1">Connect with farmers to see updates here.</p>
             </div>
          ) : (
            <div className="space-y-4">
              {feedPosts.map(post => {
                const initial = post.senderName ? post.senderName.charAt(0).toUpperCase() : 'F';
                // Simple color rotation based on string length to make it deterministic
                const colors = ['bg-orange-100 text-orange-600', 'bg-purple-100 text-purple-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600'];
                const colorClass = colors[(post.senderName?.length || 0) % colors.length];
                
                return (
                  <div key={post.id} className="flex gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${colorClass}`}>
                      {initial}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{post.senderName}</h4>
                      <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                        {post.userComment || 'Shared a new post in the community.'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FarmerDashboard;
