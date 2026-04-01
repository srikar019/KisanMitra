import React, { useState, useEffect, useMemo } from 'react';
import { getAllFarmers } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import type { FarmerProfile } from '../types';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';

interface FarmerDirectoryProps {
    onStartChat: (recipient: FarmerProfile) => void;
}

const FarmerDirectory: React.FC<FarmerDirectoryProps> = ({ onStartChat }) => {
    const { currentUser } = useAuth();
    const [farmers, setFarmers] = useState<FarmerProfile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');

    useEffect(() => {
        const fetchFarmers = async () => {
            setLoading(true);
            setError(null);
            try {
                const farmerList = await getAllFarmers();
                setFarmers(farmerList);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            } finally {
                setLoading(false);
            }
        };

        if (currentUser) {
          fetchFarmers();
        }
    }, [currentUser]);

    const filteredFarmers = useMemo(() => {
        return farmers.filter(farmer =>
            farmer.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [farmers, searchTerm]);

    return (
        <Card className="!max-w-4xl">
            <div className="flex items-center mb-6">
                <Icon name="chat-bubble-oval-left-ellipsis" className="h-8 w-8 text-green-500 mr-3" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-700">Community Directory</h2>
                    <p className="text-gray-600">Find and connect with other farmers.</p>
                </div>
            </div>

            <div className="mb-6">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon name="search" className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search farmers by email..."
                        className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    />
                </div>
            </div>
            
            {loading && (
                 <div className="flex justify-center items-center h-48">
                    <div className="w-8 h-8 border-2 border-green-500 border-dashed rounded-full animate-spin"></div>
                </div>
            )}
            {error && <p className="text-red-500 text-center">{error}</p>}
            
            {!loading && !error && (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {filteredFarmers.length > 0 ? (
                        filteredFarmers.map(farmer => {
                            const isCurrentUser = farmer.uid === currentUser?.uid;
                            return (
                                <div key={farmer.uid} className={`flex items-center justify-between p-3 rounded-lg border ${isCurrentUser ? 'bg-green-50' : 'bg-gray-50'}`}>
                                    <div>
                                        <p className="font-semibold text-gray-800 flex items-center">
                                            {farmer.email.split('@')[0]}
                                            {isCurrentUser && <span className="ml-2 text-xs font-normal text-green-700 bg-green-200 px-2 py-0.5 rounded-full">You</span>}
                                        </p>
                                        <p className="text-sm text-gray-500">{farmer.email}</p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        className="!py-1 !px-4 !text-sm"
                                        onClick={() => onStartChat(farmer)}
                                        disabled={isCurrentUser}
                                    >
                                        Chat
                                    </Button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                           <p className="font-semibold">
                               {searchTerm ? 'No farmers match your search.' : 'No farmer profiles found.'}
                           </p>
                           <p className="text-sm mt-2">
                               {searchTerm 
                                   ? 'Try a different search term.' 
                                   : 'As new farmers sign up and log in, they will appear here. If you just logged in, your own profile should be visible.'}
                           </p>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

export default FarmerDirectory;
