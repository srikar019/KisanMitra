import React, { useState } from 'react';
import { logout } from '../services/authService';
import Icon from './common/Icon';
import UserManagement from './UserManagement';
import AdminAnalytics from './AdminAnalytics';

type AdminTab = 'analytics' | 'users';

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Icon name="lock-closed" className="h-8 w-8 text-gray-700" />
                        <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        <Icon name="logout" className="h-5 w-5" />
                        Logout
                    </button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'analytics'
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Analytics
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'users'
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            User Management
                        </button>
                    </nav>
                </div>

                <div>
                    {activeTab === 'analytics' && <AdminAnalytics />}
                    {activeTab === 'users' && <UserManagement />}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
