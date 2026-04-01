import React, { useState, useEffect, useMemo } from 'react';
import { getAllUsers, deleteUserAccount } from '../services/adminService';
import { FarmerProfile } from '../types';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Modal from './common/Modal';
import Button from './common/Button';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<FarmerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [userToDelete, setUserToDelete] = useState<FarmerProfile | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAllUsers();
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (user: FarmerProfile) => {
        setUserToDelete(user);
        setIsConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        setDeleteLoading(true);
        setError(null);
        try {
            await deleteUserAccount(userToDelete.uid);
            setUsers(prev => prev.filter(u => u.uid !== userToDelete.uid));
            setIsConfirmOpen(false);
            setUserToDelete(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete user.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.role?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner /> <span className="ml-2 text-gray-600">Loading user data...</span>
            </div>
        );
    }
    
    return (
        <div className="bg-white p-6 rounded-lg shadow border">
            <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="Confirm Deletion">
                <div>
                    <p>Are you sure you want to delete the user account for <strong>{userToDelete?.email}</strong>? This action cannot be undone.</p>
                     {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    <div className="flex justify-end gap-4 mt-6">
                        <Button variant="secondary" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
                        <Button className="bg-red-600 hover:bg-red-700 focus:ring-red-500" onClick={handleConfirmDelete} disabled={deleteLoading}>
                            {deleteLoading ? <Spinner/> : 'Delete User'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">All Users ({users.length})</h2>
                <div className="w-full max-w-xs">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icon name="search" className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search by email, name, role..."
                            className="w-full p-2 pl-10 border rounded-md"
                        />
                    </div>
                </div>
            </div>

            {error && !deleteLoading && <p className="text-red-500 text-center mb-4">{error}</p>}

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map(user => (
                            <tr key={user.uid}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.name || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.location || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        user.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                                        user.role === 'farmer' ? 'bg-green-100 text-green-800' :
                                        'bg-blue-100 text-blue-800'
                                    }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {user.role !== 'admin' && (
                                        <button onClick={() => handleDeleteClick(user)} className="text-red-600 hover:text-red-900" title="Delete User">
                                            <Icon name="trash" className="h-5 w-5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredUsers.length === 0 && (
                    <p className="text-center py-8 text-gray-500">No users found.</p>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
