import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

import { 
    addAgriSwapListing, 
    onAgriSwapListingsSnapshot, 
    updateAgriSwapListing, 
    updateAgriSwapListingStatus, 
    deleteAgriSwapListing,
    sendAgriSwapDealRequest,
    onSentAgriSwapRequestsSnapshot
} from '../services/barterService';
import { AgriSwapListing, AgriSwapDealRequest } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Modal from './common/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import SafeHTML from './common/SafeHTML';

const ListingFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<AgriSwapListing, 'id' | 'createdAt' | 'status' | 'farmerUid' | 'farmerEmail' | 'offerImageUrl' | 'farmerName' | 'location' | 'farmerPhoneNumber'>) => void;
    loading: boolean;
    mode: 'add' | 'edit';
    listing: AgriSwapListing | null;
}> = ({ isOpen, onClose, onSubmit, loading, mode, listing }) => {
    const { translate } = useLanguage();
    
    const [formData, setFormData] = useState({
        offerItemName: 'Wheat',
        offerQuantity: 100,
        offerUnit: 'kg',
        offerDescription: '',
        wantItemName: 'Rice',
        wantQuantity: 50,
        wantUnit: 'kg',
        wantDescription: '',
    });

    useEffect(() => {
        if (mode === 'edit' && listing) {
            setFormData({
                offerItemName: listing.offerItemName,
                offerQuantity: listing.offerQuantity,
                offerUnit: listing.offerUnit,
                offerDescription: listing.offerDescription || '',
                wantItemName: listing.wantItemName,
                wantQuantity: listing.wantQuantity,
                wantUnit: listing.wantUnit,
                wantDescription: listing.wantDescription || '',
            });
        } else {
             setFormData({ // Reset for 'add' mode
                offerItemName: 'Wheat',
                offerQuantity: 100,
                offerUnit: 'kg',
                offerDescription: '',
                wantItemName: 'Rice',
                wantQuantity: 50,
                wantUnit: 'kg',
                wantDescription: '',
            });
        }
    }, [isOpen, mode, listing]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? translate('agriSwap.modal.createTitle') : translate('agriSwap.modal.editTitle')}>
             <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">{translate('agriSwap.modal.profilePrompt')}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Offering Column */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-green-700 border-b border-green-200 pb-2">{translate('agriSwap.modal.offering')}</h3>
                        <div>
                            <label className="block text-sm font-medium">{translate('agriSwap.modal.itemName')}</label>
                            <input type="text" name="offerItemName" value={formData.offerItemName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">{translate('agriSwap.modal.quantity')}</label>
                                <input type="number" name="offerQuantity" value={formData.offerQuantity} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" min="0" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">{translate('agriSwap.modal.unit')}</label>
                                <input type="text" name="offerUnit" value={formData.offerUnit} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" placeholder="e.g., kg" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">{translate('agriSwap.modal.description')}</label>
                            <textarea name="offerDescription" value={formData.offerDescription} onChange={handleChange} rows={2} className="w-full mt-1 p-2 border rounded-md" />
                        </div>
                    </div>

                    {/* Wanting Column */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-blue-700 border-b border-blue-200 pb-2">{translate('agriSwap.modal.wanting')}</h3>
                        <div>
                            <label className="block text-sm font-medium">{translate('agriSwap.modal.itemName')}</label>
                            <input type="text" name="wantItemName" value={formData.wantItemName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">{translate('agriSwap.modal.quantity')}</label>
                                <input type="number" name="wantQuantity" value={formData.wantQuantity} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" min="0" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">{translate('agriSwap.modal.unit')}</label>
                                <input type="text" name="wantUnit" value={formData.wantUnit} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" placeholder="e.g., kg" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">{translate('agriSwap.modal.description')}</label>
                            <textarea name="wantDescription" value={formData.wantDescription} onChange={handleChange} rows={2} className="w-full mt-1 p-2 border rounded-md" />
                        </div>
                    </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={loading}>{loading ? <Spinner /> : mode === 'add' ? translate('agriSwap.modal.createButton') : translate('agriSwap.modal.saveButton')}</Button>
                </div>
            </form>
        </Modal>
    );
};

const RequestTradeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    listing: AgriSwapListing | null;
    loading: boolean;
}> = ({ isOpen, onClose, onConfirm, listing, loading }) => {
    const { translate } = useLanguage();
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={translate('agriSwap.modal.requestTradeTitle')}>
             <form onSubmit={handleSubmit} className="space-y-4">
                <SafeHTML as="p" className="text-sm text-gray-600" html={translate('agriSwap.modal.requestTradeText', { itemName: listing?.offerItemName || '', farmerName: listing?.farmerName || '' })} />
                <div className="flex justify-end gap-4 pt-4">
                    <Button variant="secondary" type="button" onClick={onClose}>{translate('marketplace.modal.cancel')}</Button>
                    <Button type="submit" disabled={loading}>{loading ? <Spinner /> : translate('agriSwap.modal.confirmRequest')}</Button>
                </div>
            </form>
        </Modal>
    );
};


const AgriSwap: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const { translate } = useLanguage();
    const [listings, setListings] = useState<AgriSwapListing[]>([]);
    const [sentRequests, setSentRequests] = useState<AgriSwapDealRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // State for modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [selectedListing, setSelectedListing] = useState<AgriSwapListing | null>(null);
    const [listingToDelete, setListingToDelete] = useState<AgriSwapListing | null>(null);
    const [listingToRequest, setListingToRequest] = useState<AgriSwapListing | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribeListings = onAgriSwapListingsSnapshot((allListings) => {
            setListings(allListings);
            setLoading(false);
        });

        let unsubscribeSentRequests = () => {};
        if (currentUser) {
            unsubscribeSentRequests = onSentAgriSwapRequestsSnapshot(currentUser.uid, setSentRequests);
        }

        return () => {
            unsubscribeListings();
            unsubscribeSentRequests();
        };
    }, [currentUser]);

    const handleFormSubmit = async (data: Omit<AgriSwapListing, 'id' | 'createdAt' | 'status' | 'farmerUid' | 'farmerEmail' | 'offerImageUrl' | 'farmerName' | 'location' | 'farmerPhoneNumber'>) => {
        if (!currentUser || !currentUser.email || !userProfile || !userProfile.name || !userProfile.location) {
            setError(translate('marketplace.error.profile'));
            return;
        }
        setFormLoading(true);
        setError(null);
        try {
            if (formMode === 'add') {
                const fullData = {
                    ...data,
                    farmerUid: currentUser.uid,
                    farmerEmail: currentUser.email,
                    farmerName: userProfile.name,
                    location: userProfile.location,
                    farmerPhoneNumber: userProfile.phoneNumber || '',
                    offerImageUrl: ''
                };
                await addAgriSwapListing(fullData);
            } else if (selectedListing) {
                await updateAgriSwapListing(selectedListing.id, data);
            }
            setIsFormModalOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save listing.');
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleConfirmDelete = async () => {
        if (!listingToDelete) return;
        setFormLoading(true);
        try {
            await deleteAgriSwapListing(listingToDelete.id);
            setListingToDelete(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete listing.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleConfirmRequest = async () => {
        if (!listingToRequest || !userProfile) {
            setError("Cannot process request: user or listing missing.");
            return;
        }
        setFormLoading(true);
        setError(null);
        try {
            await sendAgriSwapDealRequest(listingToRequest, userProfile, currentUser!.uid, currentUser!.email!);
            setListingToRequest(null);
        } catch (err) {
             setError(err instanceof Error ? err.message : 'Could not send request.');
        } finally {
            setFormLoading(false);
        }
    };
    
    const openAddModal = () => {
        if (!userProfile?.name || !userProfile?.location) {
            setError(translate('marketplace.error.profile'));
            return;
        }
        setFormMode('add');
        setSelectedListing(null);
        setIsFormModalOpen(true);
    };

    const openEditModal = (listing: AgriSwapListing) => {
        setFormMode('edit');
        setSelectedListing(listing);
        setIsFormModalOpen(true);
    };

    const mySentRequestIds = new Set(sentRequests.map(r => r.listingId));

    return (
        <Card className="!max-w-7xl">
            <ListingFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSubmit={handleFormSubmit} loading={formLoading} mode={formMode} listing={selectedListing} />
            <Modal isOpen={!!listingToDelete} onClose={() => setListingToDelete(null)} title={translate('agriSwap.modal.confirmDeleteTitle')}>
                <SafeHTML as="p" html={translate('agriSwap.modal.confirmDeleteText', { itemName: listingToDelete?.offerItemName || '' })} />
                <div className="flex justify-end gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setListingToDelete(null)}>{translate('marketplace.modal.cancel')}</Button>
                    <Button className="bg-red-600 hover:bg-red-700" onClick={handleConfirmDelete} disabled={formLoading}>{formLoading ? <Spinner/> : translate('marketplace.modal.delete')}</Button>
                </div>
            </Modal>
            <RequestTradeModal isOpen={!!listingToRequest} onClose={() => setListingToRequest(null)} onConfirm={handleConfirmRequest} listing={listingToRequest} loading={formLoading} />


             <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div className="flex items-center">
                    <Icon name="arrows-right-left" className="h-8 w-8 text-cyan-500 mr-3" />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-700">{translate('agriSwap.title')}</h2>
                        <p className="text-gray-600">{translate('agriSwap.description')}</p>
                    </div>
                </div>
                <Button onClick={openAddModal}>{translate('agriSwap.createListing')}</Button>
            </div>

            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            
            {loading ? (
                 <div className="flex justify-center items-center h-64"><div className="w-12 h-12 border-4 border-cyan-500 border-dashed rounded-full animate-spin"></div></div>
            ) : listings.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg border">
                    <Icon name="arrows-right-left" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">{translate('agriSwap.empty.title')}</h3>
                    <p className="text-gray-500 mt-2">{translate('agriSwap.empty.subtitle')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listings.map(listing => {
                        const isMyListing = listing.farmerUid === currentUser?.uid;
                        const hasRequested = mySentRequestIds.has(listing.id);
                        return (
                        <div key={listing.id} className="bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col group">
                            <div className="relative h-48 w-full overflow-hidden">
                                <img src={listing.offerImageUrl || undefined} alt={listing.offerItemName} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            </div>
                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex items-center justify-between text-lg font-bold">
                                    <div className="text-green-700">{listing.offerQuantity} {listing.offerUnit} {listing.offerItemName}</div>
                                    <Icon name="arrows-right-left" className="h-6 w-6 text-gray-400" />
                                    <div className="text-blue-700">{listing.wantQuantity} {listing.wantUnit} {listing.wantItemName}</div>
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm text-gray-600 mt-2">{listing.offerDescription}</p>
                                </div>
                                <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                                    <p><strong>{translate('agriSwap.card.farmer')}:</strong> {listing.farmerName}</p>
                                    <p><strong>{translate('agriSwap.card.location')}:</strong> {listing.location}</p>
                                    {listing.farmerPhoneNumber && (
                                        <div className="mt-2">
                                            <a 
                                                href={`tel:${listing.farmerPhoneNumber.replace(/\s/g, '')}`}
                                                className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors"
                                            >
                                                <Icon name="phone" className="h-4 w-4" />
                                                {listing.farmerPhoneNumber}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-3 bg-gray-50 border-t">
                                {isMyListing ? (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="secondary" className="!text-xs !py-1" onClick={() => openEditModal(listing)}>{translate('agriSwap.card.edit')}</Button>
                                        <Button variant="secondary" className="!text-xs !py-1 !text-red-600" onClick={() => setListingToDelete(listing)}>{translate('agriSwap.card.delete')}</Button>
                                    </div>
                                ) : (
                                    <Button className="w-full !text-sm !py-2" onClick={() => setListingToRequest(listing)} disabled={hasRequested}>
                                        {hasRequested ? translate('agriSwap.card.requested') : translate('agriSwap.card.request')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            )}
        </Card>
    );
};

export default AgriSwap;
