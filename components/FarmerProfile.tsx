import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../services/authService';
import { addExpense, onExpensesSnapshot, deleteExpense } from '../services/expenseService';
import { onCustomAlertsSnapshot, deleteCustomAlert } from '../services/customAlertService';
import { updateUserProfile } from '../services/userService';
import Card from './common/Card';
import Icon from './common/Icon';
import Button from './common/Button';
import { Expense, ExpenseCategory, CustomAlert } from '../types';
import Spinner from './common/Spinner';

const categoryColors: { [key in ExpenseCategory]: string } = {
    [ExpenseCategory.Seeds]: '#4CAF50',
    [ExpenseCategory.Fertilizer]: '#FFC107',
    [ExpenseCategory.Pesticides]: '#F44336',
    [ExpenseCategory.Machinery]: '#2196F3',
    [ExpenseCategory.Labor]: '#9C27B0',
    [ExpenseCategory.Utilities]: '#00BCD4',
    [ExpenseCategory.Other]: '#9E9E9E',
};

// A simple, dependency-free pie chart component
const ExpensePieChart: React.FC<{ data: { name: string; value: number }[] }> = ({ data }) => {
    if (data.length === 0) return null;
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercent = 0;

    const segments = data.map(item => {
        const percent = item.value / total;
        const segment = {
            ...item,
            percent,
            startAngle: cumulativePercent * 360,
            endAngle: (cumulativePercent + percent) * 360,
        };
        cumulativePercent += percent;
        return segment;
    });

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    return (
        <svg viewBox="-1 -1 2 2" className="w-full h-full max-w-[200px] mx-auto transform -rotate-90">
            {segments.map(segment => {
                const [startX, startY] = getCoordinatesForPercent(segment.startAngle / 360);
                const [endX, endY] = getCoordinatesForPercent(segment.endAngle / 360);
                const largeArcFlag = segment.percent > 0.5 ? 1 : 0;
                const pathData = `M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L 0 0`;
                return <path key={segment.name} d={pathData} fill={categoryColors[segment.name as ExpenseCategory]} />;
            })}
        </svg>
    );
};

const FarmerProfilePage: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loadingExpenses, setLoadingExpenses] = useState(true);
    const [errorExpenses, setErrorExpenses] = useState<string | null>(null);
    const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
    const [loadingAlerts, setLoadingAlerts] = useState(true);

    // Profile state
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [countryCode, setCountryCode] = useState('');
    const [localNumber, setLocalNumber] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

    const initialExpenseState: Omit<Expense, 'id'> = {
        description: '',
        category: ExpenseCategory.Seeds,
        amount: 0,
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
    };

    const [newExpense, setNewExpense] = useState(initialExpenseState);

     useEffect(() => {
        if (userProfile) {
            setName(userProfile.name || '');
            setLocation(userProfile.location || '');
            
            const fullPhone = userProfile.phoneNumber || '';
            // Heuristic to split existing phone number
            if (fullPhone.startsWith('+')) {
                // If it already has a +, find where digits start or just use first 3-4 chars
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

    useEffect(() => {
        if (currentUser) {
            const unsubExpenses = onExpensesSnapshot(currentUser.uid, (fetchedExpenses) => {
                setExpenses(fetchedExpenses);
                setLoadingExpenses(false);
            }, (error) => {
                setErrorExpenses(error.message);
                setLoadingExpenses(false);
            });

            const unsubAlerts = onCustomAlertsSnapshot(currentUser.uid, (fetchedAlerts) => {
                setCustomAlerts(fetchedAlerts);
                setLoadingAlerts(false);
            });

            return () => {
                unsubExpenses();
                unsubAlerts();
            };
        }
    }, [currentUser]);
    
    const handleExpenseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewExpense(prev => ({...prev, [name]: name === 'amount' ? parseFloat(value) || 0 : value }));
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newExpense.description || newExpense.amount <= 0) {
            setErrorExpenses("Please enter a valid description and amount.");
            return;
        }
        setErrorExpenses(null);
        try {
            await addExpense(currentUser.uid, newExpense);
            setNewExpense(initialExpenseState); // Reset form
        } catch (error) {
            setErrorExpenses(error instanceof Error ? error.message : "Could not add expense.");
        }
    };

    const handleDeleteExpense = async (expenseId: string) => {
        if (!currentUser) return;
        try {
            await deleteExpense(currentUser.uid, expenseId);
        } catch (error) {
            setErrorExpenses(error instanceof Error ? error.message : "Could not delete expense.");
        }
    };

    const handleDeleteCustomAlert = async (alertId: string) => {
        if (!currentUser) return;
        try {
            await deleteCustomAlert(currentUser.uid, alertId);
        } catch (error) {
            console.error(error);
        }
    };
    
    const validatePhoneNumber = (number: string): boolean => {
        if (!number.trim()) return true; // It's an optional field
        const digits = number.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15;
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        // Strip everything except digits for storage/backend processing
        const fullPhoneNumberDigits = `${countryCode}${localNumber}`.replace(/\D/g, '');

        if (!validatePhoneNumber(fullPhoneNumberDigits)) {
            setPhoneError("Please enter a valid phone number.");
            return;
        }
        
        setProfileLoading(true);
        setProfileError(null);
        setPhoneError(null);
        setProfileSuccess(null);
        try {
            await updateUserProfile(currentUser.uid, { name, location, phoneNumber: fullPhoneNumberDigits });
            setProfileSuccess("Profile updated successfully!");
             setTimeout(() => setProfileSuccess(null), 3000); // Clear after 3s
        } catch (err) {
            setProfileError(err instanceof Error ? err.message : "Failed to save profile.");
        } finally {
            setProfileLoading(false);
        }
    };

    const { totalExpensesByCurrency, categoryBreakdown } = useMemo(() => {
        const totals: { [key: string]: number } = {};
        expenses.forEach(exp => {
            totals[exp.currency] = (totals[exp.currency] || 0) + exp.amount;
        });

        const breakdown = expenses.reduce((acc: Record<string, number>, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
            return acc;
        }, {} as Record<string, number>);
        
        const chartData = Object.entries(breakdown).map(([name, value]) => ({ name, value: value as number }));

        return { totalExpensesByCurrency: totals, categoryBreakdown: chartData };
    }, [expenses]);
    
    const handleSignOut = async () => {
        try {
            await logout();
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const renderCustomAlert = (alert: CustomAlert) => {
        if (alert.type === 'weather') {
            return `Weather: ${alert.location} - ${alert.condition} ${alert.operator === 'lte' ? '<=' : '>='} ${alert.value}`;
        }
        if (alert.type === 'market') {
            return `Market: ${alert.crop} in ${alert.location} - price ${alert.operator === 'lte' ? '<=' : '>='} ${alert.value}`;
        }
        return 'Unknown alert';
    };


    if (!currentUser) {
        return (
            <Card>
                <p>You are not signed in.</p>
            </Card>
        );
    }

    const currencies = ['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD'];

    return (
        <Card className="!max-w-4xl">
            <div className="flex items-center mb-6">
                <Icon name="user-circle" className="h-10 w-10 text-green-600 mr-4"/>
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">My Profile</h2>
                    <p className="text-gray-600">Manage your account, farm details, and finances.</p>
                </div>
            </div>
            
            <div className="space-y-6">
                {/* Account Information */}
                <div className="p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Account Information</h3>
                    <div className="flex items-center">
                        <p className="text-gray-600 font-medium w-32">Email:</p>
                        <p className="text-gray-800 font-semibold">{currentUser.email}</p>
                    </div>
                     <div className="flex items-center mt-2">
                        <p className="text-gray-600 font-medium w-32">User ID:</p>
                        <p className="text-gray-400 text-sm font-mono">{currentUser.uid}</p>
                    </div>
                </div>

                {/* Profile Details */}
                <div className="p-6 bg-gray-50 rounded-lg border">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">Farm & Contact Information</h3>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Farmer/Farm Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" placeholder="e.g., John's Family Farm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Location</label>
                                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" placeholder="e.g., Napa Valley, CA" />
                            </div>
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
                                    className="w-24 p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 font-bold text-center text-gray-700"
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
                                    className={`flex-1 p-2 border rounded-md ${phoneError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-green-500 focus:border-green-500'}`}
                                    placeholder="9876543210" 
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500 font-medium">Format: Country Code and Number (e.g., +91 and 9876543210). Leading zeros are not needed.</p>
                            {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                        </div>
                        {profileError && <p className="text-red-500 text-sm">{profileError}</p>}
                        {profileSuccess && <p className="text-green-600 text-sm">{profileSuccess}</p>}
                        <div className="text-right">
                            <Button type="submit" disabled={profileLoading}>{profileLoading ? <Spinner /> : 'Save Profile'}</Button>
                        </div>
                    </form>
                </div>

                {/* My Custom Alerts */}
                <div className="p-6 bg-gray-50 rounded-lg border">
                    <div className="flex items-center mb-4">
                        <Icon name="bell" className="h-6 w-6 text-purple-600 mr-3" />
                        <h3 className="text-xl font-semibold text-gray-700">My Custom Alerts</h3>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {loadingAlerts ? (
                            <p className="text-center text-gray-500">Loading alerts...</p>
                        ) : customAlerts.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">You haven't set any custom alerts.</p>
                        ) : (
                            customAlerts.map(alert => (
                                <div key={alert.id} className="flex justify-between items-center p-2 bg-white border rounded-md">
                                    <p className="text-sm text-gray-700">{renderCustomAlert(alert)}</p>
                                    <button onClick={() => handleDeleteCustomAlert(alert.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full">
                                        <Icon name="trash" className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Expense Tracker */}
                <div className="p-6 bg-gray-50 rounded-lg border">
                    <div className="flex items-center mb-4">
                        <Icon name="receipt" className="h-6 w-6 text-blue-600 mr-3" />
                        <h3 className="text-xl font-semibold text-gray-700">Expense Tracker</h3>
                    </div>
                    
                    <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end mb-6 p-4 bg-white rounded-lg border">
                        <div className="lg:col-span-3">
                            <label className="text-sm font-medium text-gray-700">Description</label>
                            <input type="text" name="description" value={newExpense.description} onChange={handleExpenseChange} className="w-full mt-1 p-2 border rounded-md" required />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Category</label>
                            <select name="category" value={newExpense.category} onChange={handleExpenseChange} className="w-full mt-1 p-2 border rounded-md">
                                {Object.values(ExpenseCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-2">
                             <label className="text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" name="amount" value={newExpense.amount} onChange={handleExpenseChange} className="w-full mt-1 p-2 border rounded-md" required min="0.01" step="0.01" />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Currency</label>
                            <select name="currency" value={newExpense.currency} onChange={handleExpenseChange} className="w-full mt-1 p-2 border rounded-md">
                                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-2">
                             <label className="text-sm font-medium text-gray-700">Date</label>
                             <input type="date" name="date" value={newExpense.date} onChange={handleExpenseChange} className="w-full mt-1 p-2 border rounded-md" required/>
                        </div>
                        <div className="lg:col-span-1 flex justify-end">
                             <button type="submit" className="p-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all transform hover:scale-110 active:scale-95 shadow-md" aria-label="Add expense">
                                <Icon name="plus" className="h-6 w-6" />
                             </button>
                        </div>
                    </form>

                    {errorExpenses && <p className="text-red-500 text-center text-sm mb-4">{errorExpenses}</p>}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <h4 className="font-semibold text-gray-800 mb-2">Expense History</h4>
                            <div className="overflow-x-auto max-h-96 border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Category</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                            <th className="px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loadingExpenses ? (
                                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading expenses...</td></tr>
                                        ) : expenses.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">No expenses recorded yet.</td></tr>
                                        ) : (
                                            expenses.map(exp => (
                                                <tr key={exp.id}>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{exp.date}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 font-medium">{exp.description}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">{exp.category}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 font-semibold">{exp.amount.toFixed(2)} {exp.currency}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button onClick={() => handleDeleteExpense(exp.id)} className="text-red-500 hover:text-red-700"><Icon name="trash" className="h-4 w-4"/></button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="lg:col-span-1">
                             <h4 className="font-semibold text-gray-800 mb-2">Summary</h4>
                             <div className="p-4 bg-white border rounded-lg space-y-4">
                                <div>
                                    <p className="text-sm text-gray-500">Total Expenses</p>
                                     {Object.keys(totalExpensesByCurrency).length > 0 ? (
                                        Object.entries(totalExpensesByCurrency).map(([currency, total]) => (
                                            <p key={currency} className="text-2xl font-bold text-gray-800">
                                                {(total as number).toFixed(2)} <span className="text-xl font-semibold">{currency}</span>
                                            </p>
                                        ))
                                     ) : (
                                        <p className="text-2xl font-bold text-gray-800">0.00</p>
                                     )}
                                </div>
                                <div className="relative h-48">
                                    <ExpensePieChart data={categoryBreakdown} />
                                </div>
                                <div className="space-y-1 text-xs">
                                    {categoryBreakdown.map(cat => (
                                        <div key={cat.name} className="flex justify-between items-center">
                                            <span className="flex items-center"><span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: categoryColors[cat.name as ExpenseCategory] }}></span>{cat.name}</span>
                                            <span className="font-semibold">{cat.value.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="text-center pt-4">
                    <Button onClick={handleSignOut} className="bg-red-600 hover:bg-red-700 focus:ring-red-500">
                        Sign Out
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default FarmerProfilePage;
