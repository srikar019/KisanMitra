import React, { useState, useEffect } from 'react';
import { getSystemStats } from '../services/adminService';
import { SystemStats } from '../types';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Card from './common/Card';

const StatCard: React.FC<{ title: string; value: number; icon: string }> = ({ title, value, icon }) => (
    <div className="bg-white p-6 rounded-lg shadow border flex items-start">
        <div className="bg-indigo-100 p-3 rounded-full mr-4">
            <Icon name={icon} className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
);


const AdminAnalytics: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getSystemStats();
                setStats(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner /> <span className="ml-2 text-gray-600">Loading statistics...</span>
            </div>
        );
    }

    if (error) {
        return <p className="text-red-500 text-center">{error}</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Farmers" value={stats?.totalFarmers ?? 0} icon="leaf" />
            <StatCard title="Total Customers" value={stats?.totalCustomers ?? 0} icon="shopping-bag" />
            <StatCard title="Marketplace Listings" value={stats?.marketplaceListings ?? 0} icon="tag" />
            <StatCard title="Agri-Swap Listings" value={stats?.agriSwapListings ?? 0} icon="arrows-right-left" />
        </div>
    );
};

export default AdminAnalytics;
