import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../services/userService';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';

const CustomerProfile: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [countryCode, setCountryCode] = useState('');
    const [localNumber, setLocalNumber] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (userProfile) {
            setName(userProfile.name || '');
            setLocation(userProfile.location || '');
            
            const fullPhone = userProfile.phoneNumber || '';
            if (fullPhone.startsWith('+')) {
                setCountryCode(fullPhone.slice(0, 3));
                setLocalNumber(fullPhone.slice(3));
            } else if (fullPhone.length >= 12) {
                setCountryCode('+' + fullPhone.slice(0, 2));
                setLocalNumber(fullPhone.slice(2));
            } else {
                setCountryCode('+91');
                setLocalNumber(fullPhone);
            }
        }
    }, [userProfile]);
    
    const validatePhoneNumber = (number: string): boolean => {
        if (!number.trim()) return true; // It's an optional field
        const digits = number.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        const fullPhoneNumberDigits = `${countryCode}${localNumber}`.replace(/\D/g, '');

        if (!validatePhoneNumber(fullPhoneNumberDigits)) {
            setPhoneError("Please enter a valid phone number.");
            return;
        }

        setLoading(true);
        setError(null);
        setPhoneError(null);
        setSuccess(null);
        try {
            await updateUserProfile(currentUser.uid, { name, location, phoneNumber: fullPhoneNumberDigits });
            setSuccess("Profile updated successfully!");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save profile.");
        } finally {
            setLoading(false);
        }
    };

    if (!currentUser || !userProfile) {
        return <Card><p>Loading profile...</p></Card>;
    }

    return (
        <Card>
            <div className="flex items-center mb-6">
                <Icon name="user-circle" className="h-8 w-8 text-blue-500 mr-3" />
                <h2 className="text-2xl font-bold text-gray-700">My Profile</h2>
            </div>
            <p className="text-gray-600 mb-6">Update your personal information. This will be used when making deals or contacting farmers.</p>

            <form onSubmit={handleSave} className="space-y-4 max-w-lg mx-auto">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 p-2 bg-gray-100 border rounded-md text-gray-500">{currentUser.email}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Jane Doe" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Location</label>
                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., San Francisco, CA" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number (for WhatsApp)</label>
                    <div className="flex gap-2 mt-1">
                        <input 
                            type="text" 
                            value={countryCode}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\+?\d*$/.test(val)) {
                                    setCountryCode(val.slice(0, 5));
                                }
                            }}
                            className="w-24 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-bold text-center text-gray-700"
                            placeholder="+91"
                            title="Country Code (e.g., +91)"
                        />
                        <input 
                            type="tel" 
                            value={localNumber} 
                            onChange={(e) => {
                                setLocalNumber(e.target.value.replace(/\D/g, ''));
                                if (phoneError) setPhoneError(null);
                            }} 
                            className={`flex-1 p-2 border rounded-md ${phoneError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                            placeholder="9876543210" 
                        />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 font-medium">Format: Country Code and Number (e.g., +91 and 9876543210). Leading zeros are not needed.</p>
                    {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                </div>


                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                {success && <p className="text-green-600 text-sm text-center">{success}</p>}

                <div className="text-right pt-2">
                    <Button type="submit" disabled={loading}>{loading ? <Spinner /> : 'Save Changes'}</Button>
                </div>
            </form>
        </Card>
    );
};

export default CustomerProfile;
