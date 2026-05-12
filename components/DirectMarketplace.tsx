import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ProductListing } from '../types';

import { addListing, onProductsSnapshot, updateListing, deleteNegotiableListing } from '../services/marketplaceService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { validateRequired, validateNumber } from '../services/validationService';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Modal from './common/Modal';
import SafeHTML from './common/SafeHTML';


const ListingFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (listingData: Omit<ProductListing, 'id' | 'createdAt' | 'farmerUid' | 'farmerEmail' | 'imageUrl' | 'farmerName' | 'location' | 'farmerPhoneNumber'>) => void;
    loading: boolean;
    mode: 'add' | 'edit';
    initialData: Partial<ProductListing> | null;
    error: string | null;
}> = ({ isOpen, onClose, onSave, loading, mode, initialData, error }) => {
    const { translate } = useLanguage();
    const [listingType, setListingType] = useState<'wholesale' | 'retail'>('wholesale');
    const currencies = ['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD'];

    const defaultState = {
        cropName: 'Soybeans',
        quantity: 100,
        unit: 'tons',
        price: 550,
        currency: 'USD',
        targetPrice: 550,
        lowestPrices: [500],
    };
    
    const [formData, setFormData] = useState(defaultState);

     useEffect(() => {
        if (isOpen) {
            // If there's initial data (from AI command or edit), use it to pre-fill.
            if (initialData) {
                setListingType(initialData.listingType || 'wholesale');
                setFormData({
                    cropName: initialData.cropName || defaultState.cropName,
                    quantity: initialData.quantity || defaultState.quantity,
                    unit: initialData.unit || defaultState.unit,
                    price: initialData.price || defaultState.price,
                    currency: initialData.currency || defaultState.currency,
                    targetPrice: initialData.targetPrice || initialData.price || defaultState.targetPrice,
                    lowestPrices: initialData.lowestPrices && initialData.lowestPrices.length > 0 ? initialData.lowestPrices : defaultState.lowestPrices,
                });
            } else {
                // Otherwise, reset to default for a clean 'add' form.
                setListingType('wholesale');
                setFormData(defaultState);
            }
        }
    }, [isOpen, initialData]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };

    const handleAddPriceTier = () => {
        if (formData.lowestPrices.length < 3) {
            const lastPrice = formData.lowestPrices[formData.lowestPrices.length - 1] || 0;
            const newPrice = lastPrice > 10 ? lastPrice - 10 : 0;
            setFormData(prev => ({ ...prev, lowestPrices: [...prev.lowestPrices, newPrice].sort((a, b) => b - a) }));
        }
    };

    const handleRemovePriceTier = (index: number) => {
        if (formData.lowestPrices.length > 1) {
            setFormData(prev => ({ ...prev, lowestPrices: prev.lowestPrices.filter((_, i) => i !== index) }));
        }
    };

    const handlePriceTierChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const newPrices = [...formData.lowestPrices];
        newPrices[index] = parseFloat(e.target.value) || 0;
        setFormData(prev => ({ ...prev, lowestPrices: newPrices }));
    };

    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        const { cropName, quantity, unit, price, currency, targetPrice, lowestPrices } = formData;

        // Input validation
        const nameCheck = validateRequired(cropName, 'Crop name', 100);
        if (!nameCheck.isValid) { setFormError(nameCheck.error!); return; }
        const unitCheck = validateRequired(unit, 'Unit', 50);
        if (!unitCheck.isValid) { setFormError(unitCheck.error!); return; }
        const qtyCheck = validateNumber(quantity, 'Quantity', 0.01, 1_000_000);
        if (!qtyCheck.isValid) { setFormError(qtyCheck.error!); return; }
        
        let listingData: Omit<ProductListing, 'id' | 'createdAt' | 'farmerUid' | 'farmerEmail' | 'imageUrl' | 'farmerName' | 'location' | 'farmerPhoneNumber'>;

        if (listingType === 'retail') {
            const priceCheck = validateNumber(price, 'Price', 0.01);
            if (!priceCheck.isValid) { setFormError(priceCheck.error!); return; }
            listingData = { listingType, cropName, quantity, unit, price, currency };
        } else {
            const priceCheck = validateNumber(targetPrice, 'Target price', 0.01);
            if (!priceCheck.isValid) { setFormError(priceCheck.error!); return; }
            listingData = { listingType, cropName, quantity, unit, price: targetPrice, currency, targetPrice, lowestPrices };
        }
        onSave(listingData);
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? translate('marketplace.modal.createTitle') : translate('marketplace.modal.editTitle')}>
            <form onSubmit={handleSubmit} className="p-0 sm:p-2">
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">{translate('marketplace.modal.listingType')}</label>
                        <select value={listingType} onChange={(e) => setListingType(e.target.value as 'wholesale' | 'retail')} className="w-full mt-1 p-2 border rounded-md" disabled={mode === 'edit'}>
                            <option value="wholesale">{translate('marketplace.modal.wholesale')}</option>
                            <option value="retail">{translate('marketplace.modal.retail')}</option>
                        </select>
                    </div>

                    {listingType === 'wholesale' ? (
                        <>
                            <p className="text-gray-600 text-sm">{translate('marketplace.modal.wholesaleDesc')}</p>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium">{translate('marketplace.modal.crop')}</label><input type="text" name="cropName" value={formData.cropName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" disabled={mode === 'edit'} /></div>
                                <div><label className="block text-sm font-medium">{translate('marketplace.modal.quantity')}</label><input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                                <div><label className="block text-sm font-medium">{translate('marketplace.modal.unit')}</label><input type="text" name="unit" value={formData.unit} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                                <div>
                                    <label className="block text-sm font-medium">{translate('marketplace.modal.currency')}</label>
                                    <select name="currency" value={formData.currency} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md">
                                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium">{translate('marketplace.modal.targetPrice')}</label><input type="number" name="targetPrice" value={formData.targetPrice} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">{translate('marketplace.modal.lowestPriceTiers')}</label>
                                <div className="space-y-2 mt-1">
                                    {formData.lowestPrices.map((price, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input type="number" value={price} onBlur={() => setFormData(prev => ({ ...prev, lowestPrices: [...prev.lowestPrices].sort((a, b) => b - a) }))} onChange={(e) => handlePriceTierChange(e, index)} className="w-full p-2 border rounded-md" />
                                            <button type="button" onClick={() => handleRemovePriceTier(index)} disabled={formData.lowestPrices.length <= 1} className="p-2 text-red-500 hover:bg-red-100 rounded-full disabled:opacity-50"><Icon name="x-mark" className="h-5 w-5" /></button>
                                        </div>
                                    ))}
                                    {formData.lowestPrices.length < 3 && <Button type="button" onClick={handleAddPriceTier} variant="secondary" className="w-full text-sm !py-2 border-dashed">{translate('marketplace.modal.addPriceTier')}</Button>}
                                </div>
                            </div>
                        </>
                    ) : (
                         <>
                            <p className="text-gray-600 text-sm">{translate('marketplace.modal.retailDesc')}</p>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2"><label className="block text-sm font-medium">{translate('marketplace.modal.crop')}</label><input type="text" name="cropName" value={formData.cropName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" disabled={mode === 'edit'} /></div>
                                <div><label className="block text-sm font-medium">{translate('marketplace.modal.pricePerUnit')}</label><input type="number" name="price" value={formData.price} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" min="0" step="0.01" /></div>
                                <div>
                                    <label className="block text-sm font-medium">{translate('marketplace.modal.currency')}</label>
                                    <select name="currency" value={formData.currency} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md">
                                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-sm font-medium">{translate('marketplace.modal.stockUnit')}</label><input type="text" name="unit" value={formData.unit} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" placeholder={translate('marketplace.modal.stockUnitPlaceholder')}/></div>
                                <div><label className="block text-sm font-medium">{translate('marketplace.modal.availableStock')}</label><input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" min="0"/></div>
                            </div>
                        </>
                    )}
                </div>
                {formError && <p className="text-red-500 text-sm text-center mt-3 bg-red-50 py-2 px-3 rounded-lg border border-red-200"><span className="material-symbols-outlined text-sm align-middle mr-1">error</span>{formError}</p>}
                {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
                <div className="flex justify-end pt-6">
                    <Button type="submit" disabled={loading}>{loading ? <Spinner /> : mode === 'add' ? translate('marketplace.modal.createButton') : translate('marketplace.modal.saveButton')}</Button>
                </div>
            </form>
        </Modal>
    );
};

const ListingActions: React.FC<{ onEdit: () => void; onDelete: () => void; }> = ({ onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleEditClick = () => {
        onEdit();
        setIsOpen(false);
    };

    const handleDeleteClick = () => {
        onDelete();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors" aria-label="Listing options">
                <Icon name="ellipsis-vertical" className="h-5 w-5" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg border z-10 animate-fade-in-up">
                    <button onClick={handleEditClick} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</button>
                    <button onClick={handleDeleteClick} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                </div>
            )}
        </div>
    );
};


const DirectMarketplace: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const { translate } = useLanguage();
    const [listings, setListings] = useState<ProductListing[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [initialLoading, setInitialLoading] = useState<boolean>(true);

    // Modal and form state
    const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [listingToEdit, setListingToEdit] = useState<ProductListing | null>(null);
    const [listingToDelete, setListingToDelete] = useState<ProductListing | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);


    useEffect(() => {
        if (!currentUser) {
            setInitialLoading(false);
            return;
        }
        const unsubscribe = onProductsSnapshot((allListings) => {
            const myListings = allListings.filter(l => l.farmerUid === currentUser.uid);
            setListings(myListings);
            setInitialLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const handleSaveListing = useCallback(async (listingData: Omit<ProductListing, 'id' | 'createdAt' | 'farmerUid' | 'farmerEmail' | 'imageUrl' | 'farmerName' | 'location' | 'farmerPhoneNumber'>) => {
        if (!currentUser || !currentUser.email || !userProfile?.name || !userProfile?.location) {
            setError(translate('marketplace.error.profile'));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            if (formMode === 'edit' && listingToEdit) {
                await updateListing(listingToEdit.id, listingData);
            } else {
                await addListing(listingData, {
                    uid: currentUser.uid,
                    email: currentUser.email,
                    name: userProfile.name,
                    location: userProfile.location,
                    phoneNumber: userProfile.phoneNumber || '',
                });
            }
            setIsFormModalOpen(false);
            setListingToEdit(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save listing.';
            setError(errorMessage);
            // Keep modal open if there was an error
            if (formMode === 'add') {
                 setIsFormModalOpen(true);
            }
        } finally {
            setLoading(false);
        }
    }, [currentUser, userProfile, formMode, listingToEdit, translate]);

    const handleConfirmDelete = async () => {
        if (!listingToDelete || !currentUser) return;
        setDeleteLoading(true);
        setError(null);
        try {
            await deleteNegotiableListing(listingToDelete.id);
            setListingToDelete(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete listing.');
        } finally {
            setDeleteLoading(false);
        }
    };
    
    const handleOpenAddModal = () => {
        setError(null);
        if (!userProfile?.name || !userProfile?.location) {
            setError(translate('marketplace.error.profile'));
            return;
        }
        setFormMode('add');
        setListingToEdit(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (listing: ProductListing) => {
        setError(null);
        setFormMode('edit');
        setListingToEdit(listing);
        setIsFormModalOpen(true);
    };

    return (
        <Card className="!max-w-7xl">
            <ListingFormModal
                isOpen={isFormModalOpen}
                onClose={() => { setIsFormModalOpen(false); setError(null); }}
                onSave={handleSaveListing}
                loading={loading}
                mode={formMode}
                initialData={listingToEdit}
                error={error}
            />
            <Modal isOpen={!!listingToDelete} onClose={() => setListingToDelete(null)} title={translate('marketplace.modal.confirmDeleteTitle')}>
                 <div>
                    <SafeHTML as="p" html={translate('marketplace.modal.confirmDeleteText', { cropName: listingToDelete?.cropName || '' })} />
                     {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    <div className="flex justify-end gap-4 mt-6">
                        <Button variant="secondary" onClick={() => setListingToDelete(null)}>{translate('marketplace.modal.cancel')}</Button>
                        <Button className="bg-red-600 hover:bg-red-700 focus:ring-red-500" onClick={handleConfirmDelete} disabled={deleteLoading}>
                            {deleteLoading ? <Spinner/> : translate('marketplace.modal.delete')}
                        </Button>
                    </div>
                </div>
            </Modal>


            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div className="flex items-center">
                    <Icon name="shopping-bag" className="h-8 w-8 text-orange-500 mr-3" />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-700">{translate('marketplace.title')}</h2>
                        <p className="text-gray-600">{translate('marketplace.description')}</p>
                    </div>
                </div>
                <Button onClick={handleOpenAddModal}>
                    {translate('marketplace.newListing')}
                </Button>
            </div>

            {error && !isFormModalOpen && <p className="text-red-500 text-center mb-4 p-3 bg-red-50 rounded-md border border-red-200">{error}</p>}

            {initialLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="w-12 h-12 border-4 border-green-500 border-dashed rounded-full animate-spin"></div>
                </div>
            ) : listings.length === 0 ? (
                 <div className="text-center py-16 bg-gray-50 rounded-lg border">
                    <Icon name="shopping-bag" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">{translate('marketplace.empty.title')}</h3>
                    <p className="text-gray-500 mt-2">{translate('marketplace.empty.subtitle')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {listings.map(listing => (
                        <div key={listing.id} className="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden flex flex-col group">
                            <div className="relative h-48 w-full overflow-hidden">
                                <img src={listing.imageUrl || undefined} alt={listing.cropName} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                {listing.listingType === 'wholesale' ? (
                                    <div className="absolute top-2 left-2 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                        <Icon name="sparkles" className="h-3 w-3" /> {translate('marketplace.aiAgent')}
                                    </div>
                                ) : (
                                     <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                        {translate('marketplace.fixedPrice')}
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ListingActions
                                        onEdit={() => handleOpenEditModal(listing)}
                                        onDelete={() => setListingToDelete(listing)}
                                    />
                                </div>
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                            <div className="p-4 flex flex-col flex-grow">
                                <h3 className="text-lg font-bold text-gray-800">{listing.cropName}</h3>
                                <p className="text-sm text-gray-500 mb-2">{translate('marketplace.available', { quantity: listing.quantity, unit: listing.unit })}</p>
                                <div className="flex-grow">
                                     <p className="text-2xl font-extrabold text-green-600 mb-2">
                                        {listing.listingType === 'wholesale' && '~'}{(listing.price || 0).toFixed(2)}
                                        <span className="text-lg font-normal text-green-700"> {listing.currency}</span>
                                        <span className="text-sm font-normal text-gray-500"> / {listing.unit}</span>
                                    </p>
                                </div>
                                <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                                    <p><strong>{translate('marketplace.seller')}:</strong> {listing.farmerName}</p>
                                    <p><strong>{translate('marketplace.location')}:</strong> {listing.location}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default DirectMarketplace;
