import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getCoordinatesForLocation } from '../services/geminiService';
import {
    addMachineryListing,
    onMachineryListingsSnapshot,
    updateMachineryListing,
    deleteMachineryListing,
    createRentalRequest,
    onRentalRequestsSnapshot,
    updateRentalRequestStatus,
} from '../services/machineryService';
import { FarmMachinery, MachineryRentalRequest, MachineryType } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Modal from './common/Modal';

declare const L: any;

// Helper function to calculate distance
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

const StatusBadge: React.FC<{ status: MachineryRentalRequest['status'] }> = ({ status }) => {
    const { translate } = useLanguage();
    const styles: { [key: string]: string } = {
        pending: 'bg-yellow-100 text-yellow-800',
        accepted: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        completed: 'bg-gray-100 text-gray-800',
        paid: 'bg-blue-100 text-blue-800',
        cancelled: 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${styles[status]}`}>{translate(`machinery.status.${status}`)}</span>;
};

// --- MODALS ---
// FIX: Moved modal components before the main component to resolve scoping and "Cannot find name" errors.
const MachineryFormModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (data: any) => void, loading: boolean, mode: 'add' | 'edit', initialData: FarmMachinery | null }> = ({ isOpen, onClose, onSave, loading, mode, initialData }) => {
    const { translate } = useLanguage();
    const [formData, setFormData] = useState({ type: MachineryType.Tractor, model: '', description: '', rentalRate: 50, currency: 'USD', rateType: 'perHour' as 'perHour' | 'perDay' });
    useEffect(() => { if (mode === 'edit' && initialData) setFormData({ type: initialData.type, model: initialData.model, description: initialData.description || '', rentalRate: initialData.rentalRate, currency: initialData.currency, rateType: initialData.rateType }); }, [mode, initialData]);
    const handleChange = (e: any) => setFormData(p => ({ ...p, [e.target.name]: e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value }));
    return <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? translate('machinery.modal.listTitle') : translate('machinery.modal.editTitle')}><form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4"><div><label>{translate('machinery.type')}</label><select name="type" value={formData.type} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md">{Object.values(MachineryType).map(t => <option key={t}>{t}</option>)}</select></div><div><label>{translate('machinery.model')}</label><input name="model" value={formData.model} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div><div className="grid grid-cols-2 gap-4"><div><label>{translate('machinery.rate')}</label><input name="rentalRate" type="number" value={formData.rentalRate} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div><div><label>{translate('machinery.per')}</label><select name="rateType" value={formData.rateType} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"><option value="perHour">{translate('machinery.hour')}</option><option value="perDay">{translate('machinery.day')}</option></select></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="secondary" type="button" onClick={onClose}>{translate('community.post.button.cancel')}</Button><Button type="submit" disabled={loading}>{loading ? <Spinner/> : translate('machinery.save')}</Button></div></form></Modal>;
};

const RequestRentalModal: React.FC<{ isOpen: boolean, onClose: () => void, onConfirm: (data: any) => void, machine: FarmMachinery, loading: boolean }> = ({ isOpen, onClose, onConfirm, machine, loading }) => {
    const { translate } = useLanguage();
    const [dates, setDates] = useState({ startDate: '', endDate: '' });
    const totalCost = useMemo(() => {
        if (!dates.startDate || !dates.endDate) return 0;
        const start = new Date(dates.startDate + 'T00:00:00');
        const end = new Date(dates.endDate + 'T00:00:00');

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
            return 0;
        }

        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (machine.rateType === 'perDay') {
            return diffDays * machine.rentalRate;
        } else if (machine.rateType === 'perHour') {
            const workHoursPerDay = 8;
            return diffDays * workHoursPerDay * machine.rentalRate;
        }
        return 0;
    }, [dates, machine]);
    return <Modal isOpen={isOpen} onClose={onClose} title={translate('machinery.rentMachine', { model: machine.model })}><form onSubmit={e => {e.preventDefault(); onConfirm({...dates, totalCost, currency: machine.currency})}} className="space-y-4"><div><label>{translate('machinery.startDate')}</label><input type="date" value={dates.startDate} onChange={e => setDates(p => ({...p, startDate: e.target.value}))} required className="w-full mt-1 p-2 border rounded-md"/></div><div><label>{translate('machinery.endDate')}</label><input type="date" value={dates.endDate} onChange={e => setDates(p => ({...p, endDate: e.target.value}))} required className="w-full mt-1 p-2 border rounded-md"/></div>{totalCost > 0 && <p>{translate('machinery.total')}: {totalCost.toFixed(2)} {machine.currency}</p>}<div className="flex justify-end gap-2 mt-4"><Button variant="secondary" type="button" onClick={onClose}>{translate('community.post.button.cancel')}</Button><Button type="submit" disabled={loading}>{loading ? <Spinner/> : translate('machinery.requestButton')}</Button></div></form></Modal>;
}

const PaymentModal: React.FC<{ isOpen: boolean, onClose: () => void, onConfirm: () => void, request: MachineryRentalRequest, loading: boolean }> = ({ isOpen, onClose, onConfirm, request, loading }) => {
    const { translate } = useLanguage();
    return <Modal isOpen={isOpen} onClose={onClose} title={translate('machinery.payment.title')}><div className="text-center"><p>{translate('machinery.payment.simulate')}:</p><p className="font-bold text-lg">{request.totalCost.toFixed(2)} {request.currency}</p><p>{translate('machinery.payment.forRenting', { model: request.machineryInfo.model })}.</p><div className="flex justify-center gap-2 mt-4"><Button variant="secondary" onClick={onClose}>{translate('community.post.button.cancel')}</Button><Button onClick={onConfirm} disabled={loading}>{loading ? <Spinner/> : translate('machinery.payment.payNow')}</Button></div></div></Modal>;
}


// Main Component
// FIX: Changed to a named export.
export const FarmMachinerySharing: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const { translate } = useLanguage();
    const [allListings, setAllListings] = useState<FarmMachinery[]>([]);
    const [myRequests, setMyRequests] = useState<MachineryRentalRequest[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<MachineryRentalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'browse' | 'myRentals' | 'myMachinery'>('browse');
    const [browseView, setBrowseView] = useState<'map' | 'list'>('map');

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [machineToEdit, setMachineToEdit] = useState<FarmMachinery | null>(null);
    const [machineToDelete, setMachineToDelete] = useState<FarmMachinery | null>(null);
    const [requestingMachine, setRequestingMachine] = useState<FarmMachinery | null>(null);
    const [paymentRequest, setPaymentRequest] = useState<MachineryRentalRequest | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    // Map state
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {
                if (userProfile?.location) {
                    getCoordinatesForLocation(userProfile.location).then(setUserCoords).catch(() => setError("Could not get your location. Map functionality will be limited."));
                } else {
                    setError("Could not get your location. Map functionality will be limited.");
                }
            }
        );

        setLoading(true);
        const unsubListings = onMachineryListingsSnapshot((data) => {
            setAllListings(data);
            setLoading(false);
        });
        
        let unsubMyRequests = () => {};
        let unsubIncoming = () => {};
        if (currentUser) {
            unsubMyRequests = onRentalRequestsSnapshot(currentUser.uid, 'renter', setMyRequests);
            unsubIncoming = onRentalRequestsSnapshot(currentUser.uid, 'owner', setIncomingRequests);
        }

        return () => {
            unsubListings();
            unsubMyRequests();
            unsubIncoming();
             if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [currentUser, userProfile]);

    const { myListings, otherListings } = useMemo(() => {
        const myListings = allListings.filter(l => l.ownerUid === currentUser?.uid);
        const otherListings = allListings.filter(l => l.ownerUid !== currentUser?.uid);
        if (userCoords) {
            otherListings.forEach(l => {
                l.distance = getDistance(userCoords.lat, userCoords.lng, l.coordinates.lat, l.coordinates.lng);
            });
            otherListings.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        }
        return { myListings, otherListings };
    }, [allListings, currentUser, userCoords]);

    useEffect(() => {
        // This effect now correctly handles map creation and destruction
        if (browseView === 'map' && userCoords && mapContainerRef.current) {
            if (!mapRef.current) { // Only create if it doesn't exist yet
                mapRef.current = L.map(mapContainerRef.current).setView([userCoords.lat, userCoords.lng], 10);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
                L.marker([userCoords.lat, userCoords.lng]).addTo(mapRef.current).bindPopup('Your Location');
                
                otherListings.forEach(machine => {
                    L.marker([machine.coordinates.lat, machine.coordinates.lng])
                        .addTo(mapRef.current)
                        .bindPopup(`<b>${machine.model} ${machine.type}</b><br>${machine.rentalRate} ${machine.currency}/${machine.rateType === 'perDay' ? 'day' : 'hr'}`);
                });
            }
        } else if (browseView !== 'map' && mapRef.current) {
            // If view is not map, and map instance exists, destroy it.
            mapRef.current.remove();
            mapRef.current = null;
        }
    }, [browseView, userCoords, otherListings]);

    const handleListMachineryClick = () => {
        if (!userProfile?.name || !userProfile?.location) {
            setError("Please complete your profile (name and location) on the 'My Profile' page before listing machinery.");
            return;
        }
        setError(null);
        setFormMode('add');
        setMachineToEdit(null);
        setIsFormOpen(true);
    };

    const handleSaveMachine = async (data: any) => {
        if (!currentUser || !userProfile?.name || !userProfile.location) return;
        setFormLoading(true);
        setError(null);
        try {
            const coordinates = await getCoordinatesForLocation(userProfile.location);
            
            if (formMode === 'add') {
                const listingData = {
                    ...data,
                    ownerUid: currentUser.uid,
                    ownerName: userProfile.name,
                    ownerPhoneNumber: userProfile.phoneNumber || '',
                    location: userProfile.location,
                    imageUrl: '',
                    coordinates,
                    status: 'available',
                };
                await addMachineryListing(listingData);
            } else if (machineToEdit) {
                await updateMachineryListing(machineToEdit.id, data);
            }
            setIsFormOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save machinery.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteMachine = async () => {
        if (!machineToDelete) return;
        setFormLoading(true);
        try {
            await deleteMachineryListing(machineToDelete.id);
            setMachineToDelete(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete machinery.');
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleCreateRequest = async (rentalData: any) => {
        if (!currentUser || !userProfile?.name || !userProfile.location || !requestingMachine) return;
        setFormLoading(true);
        try {
            const requestPayload = {
                ...rentalData,
                machineryId: requestingMachine.id,
                ownerUid: requestingMachine.ownerUid,
                renterUid: currentUser.uid,
                renterName: userProfile.name,
                renterLocation: userProfile.location,
                status: 'pending' as 'pending',
                machineryInfo: {
                    type: requestingMachine.type,
                    model: requestingMachine.model,
                    imageUrl: requestingMachine.imageUrl,
                }
            };
            await createRentalRequest(requestPayload);
            setRequestingMachine(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create rental request.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdateRequest = async (req: MachineryRentalRequest, status: MachineryRentalRequest['status']) => {
        setFormLoading(true);
        try {
            await updateRentalRequestStatus(req.id, status, req.machineryId);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update request.');
        } finally {
            setFormLoading(false);
        }
    };
    
    const handlePayment = async () => {
        if (!paymentRequest) return;
        setFormLoading(true);
        try {
            await updateRentalRequestStatus(paymentRequest.id, 'paid');
            setPaymentRequest(null);
        } catch (e) {
             setError(e instanceof Error ? e.message : 'Payment failed.');
        } finally {
            setFormLoading(false);
        }
    };

    const renderTabs = () => (
        <div className="flex border-b mb-6">
             <button onClick={() => setActiveTab('browse')} className={`px-4 py-2 text-sm font-semibold relative ${activeTab === 'browse' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}>{translate('machinery.tabs.browse')}</button>
             <button onClick={() => setActiveTab('myRentals')} className={`px-4 py-2 text-sm font-semibold relative ${activeTab === 'myRentals' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}>{translate('machinery.tabs.rentals')}</button>
             <button onClick={() => setActiveTab('myMachinery')} className={`px-4 py-2 text-sm font-semibold relative ${activeTab === 'myMachinery' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}>{translate('machinery.tabs.myMachinery')}</button>
        </div>
    );
    
    const renderBrowse = () => (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setBrowseView('map')} className={`px-3 py-1 text-sm rounded-md ${browseView === 'map' ? 'bg-white shadow' : ''}`}>{translate('machinery.view.map')}</button>
                    <button onClick={() => setBrowseView('list')} className={`px-3 py-1 text-sm rounded-md ${browseView === 'list' ? 'bg-white shadow' : ''}`}>{translate('machinery.view.list')}</button>
                </div>
                 <Button onClick={handleListMachineryClick}>{translate('machinery.listMachinery')}</Button>
            </div>
            
            {/* Map container is always in the DOM, just hidden */}
            <div id="map" ref={mapContainerRef} className={browseView !== 'map' ? 'hidden' : ''} style={{ height: '500px', borderRadius: '0.5rem', background: '#f0f0f0' }}>
                {!userCoords && <div className="h-full w-full flex items-center justify-center text-gray-500">Enable location or set it in your profile to use the map.</div>}
            </div>

            {/* List container is always in the DOM, just hidden */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${browseView !== 'list' ? 'hidden' : ''}`}>
                {otherListings.map(m => (
                    <div key={m.id} className="border rounded-lg overflow-hidden flex flex-col">
                        <img src={m.imageUrl || undefined} alt={m.model} className="h-40 w-full object-cover"/>
                        <div className="p-4 flex flex-col flex-grow">
                            <h3 className="font-bold">{m.model} {m.type}</h3>
                            <p className="text-sm text-gray-500">{translate('machinery.owner')}: {m.ownerName}</p>
                            {m.distance != null && <p className="text-xs text-gray-500">{m.distance.toFixed(1)} km {translate('machinery.away')}</p>}
                            <p className="font-semibold mt-2">{m.rentalRate} {m.currency}/{m.rateType === 'perDay' ? translate('machinery.day') : translate('machinery.hour')}</p>
                            <div className="flex-grow"></div>
                            <Button className="w-full mt-2 !py-1 !text-sm" onClick={() => setRequestingMachine(m)}>{translate('machinery.requestToRent')}</Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    
    const renderMyRentals = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
                <h3 className="text-lg font-semibold mb-4">{translate('machinery.myRentalRequests')}</h3>
                <div className="space-y-3">
                    {myRequests.map(req => (
                        <div key={req.id} className="p-3 border rounded-lg flex items-center gap-4">
                             <img src={req.machineryInfo.imageUrl || undefined} className="w-16 h-16 object-cover rounded-md"/>
                             <div className="flex-grow">
                                <p className="font-semibold">{req.machineryInfo.model}</p>
                                <p className="text-xs text-gray-500">{req.startDate} to {req.endDate}</p>
                                <p className="text-sm font-bold">{req.totalCost.toFixed(2)} {req.currency}</p>
                             </div>
                             <div className="text-right">
                                <StatusBadge status={req.status} />
                                {req.status === 'pending' && <button onClick={() => handleUpdateRequest(req, 'cancelled')} className="text-xs text-red-600 mt-1">{translate('community.post.button.cancel')}</button>}
                                {req.status === 'accepted' && <Button className="!text-xs !py-1 mt-1" onClick={() => setPaymentRequest(req)}>{translate('machinery.payment.payNow')}</Button>}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-4">{translate('machinery.incomingRequests')}</h3>
                 <div className="space-y-3">
                    {incomingRequests.map(req => (
                        <div key={req.id} className="p-3 border rounded-lg flex items-center gap-4">
                             <img src={req.machineryInfo.imageUrl || undefined} className="w-16 h-16 object-cover rounded-md"/>
                             <div className="flex-grow">
                                <p className="font-semibold">{req.machineryInfo.model}</p>
                                <p className="text-xs text-gray-500">{translate('machinery.renter')}: {req.renterName}</p>
                                <p className="text-xs text-gray-500">{req.startDate} to {req.endDate}</p>
                                <p className="text-sm font-bold">{req.totalCost.toFixed(2)} {req.currency}</p>
                             </div>
                             <div className="text-right">
                                <StatusBadge status={req.status} />
                                {req.status === 'pending' && (
                                    <div className="flex gap-2 mt-1">
                                        <button onClick={() => handleUpdateRequest(req, 'accepted')} className="text-xs text-green-600">{translate('machinery.action.accept')}</button>
                                        <button onClick={() => handleUpdateRequest(req, 'rejected')} className="text-xs text-red-600">{translate('machinery.action.reject')}</button>
                                    </div>
                                )}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
    
    // FIX: Wrapped loose JSX in a function definition for `renderMyMachinery`.
    const renderMyMachinery = () => (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myListings.map(m => (
                <div key={m.id} className="border rounded-lg overflow-hidden">
                    <img src={m.imageUrl || undefined} alt={m.model} className="h-40 w-full object-cover"/>
                    <div className="p-4">
                        <div className="flex justify-between">
                            <h3 className="font-bold">{m.model} {m.type}</h3>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{translate(`machinery.status.${m.status}`)}</span>
                        </div>
                        <p className="font-semibold mt-2">{m.rentalRate} {m.currency}/{m.rateType === 'perDay' ? translate('machinery.day') : translate('machinery.hour')}</p>
                        <div className="flex gap-2 mt-2">
                            <Button variant="secondary" className="!py-1 !text-xs" onClick={() => { setFormMode('edit'); setMachineToEdit(m); setIsFormOpen(true); }}>{translate('community.post.button.edit')}</Button>
                            <Button variant="secondary" className="!py-1 !text-xs !text-red-600" onClick={() => setMachineToDelete(m)}>{translate('community.post.button.delete')}</Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <Card>
            <MachineryFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveMachine} loading={formLoading} mode={formMode} initialData={machineToEdit} />
            {machineToDelete && <Modal isOpen={!!machineToDelete} onClose={() => setMachineToDelete(null)} title={translate('machinery.confirmDelete.title')}><p>{translate('machinery.confirmDelete.text', { model: machineToDelete.model })}</p><div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setMachineToDelete(null)}>{translate('community.post.button.cancel')}</Button><Button onClick={handleDeleteMachine} className="!bg-red-600">{translate('community.post.button.delete')}</Button></div></Modal>}
            {requestingMachine && <RequestRentalModal isOpen={!!requestingMachine} onClose={() => setRequestingMachine(null)} onConfirm={handleCreateRequest} machine={requestingMachine} loading={formLoading} />}
            {paymentRequest && <PaymentModal isOpen={!!paymentRequest} onClose={() => setPaymentRequest(null)} onConfirm={handlePayment} request={paymentRequest} loading={formLoading} />}

            <div className="flex items-center mb-6">
                <Icon name="truck" className="h-8 w-8 text-gray-700 mr-3" />
                <div>
                    <h2 className="text-2xl font-bold text-gray-700">{translate('machinery.title')}</h2>
                    <p className="text-gray-600">{translate('machinery.description')}</p>
                </div>
            </div>
            {error && <p className="text-red-500 bg-red-50 p-3 rounded-md mb-4">{error}</p>}
            
            {renderTabs()}

            {loading ? (
                <div className="flex justify-center items-center h-64"><Spinner /></div>
            ) : (
                <div className="animate-fade-in">
                    {activeTab === 'browse' && renderBrowse()}
                    {activeTab === 'myRentals' && renderMyRentals()}
                    {activeTab === 'myMachinery' && renderMyMachinery()}
                </div>
            )}
        </Card>
    );
};
