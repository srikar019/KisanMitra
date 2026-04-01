import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ProductListing, CSATier, CSASubscription, WeeklyAvailability, WeeklyProduceItem, CuratedItem } from '../types';
import { curateDynamicBox, } from '../services/geminiService';
import { addListing, onProductsSnapshot, updateListing, deleteNegotiableListing, onCSATiersForFarmerSnapshot, createOrUpdateCSATier, deleteCSATier, onCSASubscribersForFarmerSnapshot, onWeeklyAvailabilitySnapshot, updateWeeklyAvailability, updateSubscriberCuratedItems } from '../services/marketplaceService';
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


// --- CSA Management Component ---

const CSATierFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<CSATier, 'id' | 'createdAt' | 'farmerUid' | 'farmerName' | 'imageUrl'>) => void;
    loading: boolean;
    mode: 'add' | 'edit';
    initialData: CSATier | null;
}> = ({ isOpen, onClose, onSave, loading, mode, initialData }) => {
    const { translate } = useLanguage();
    const [type, setType] = useState<'static' | 'dynamic'>('static');
    const [items, setItems] = useState<{name: string, quantity: string}[]>([{name: '', quantity: ''}]);
    const [formData, setFormData] = useState({
        name: 'Small Veggie Box',
        description: 'A weekly selection of fresh, seasonal vegetables.',
        price: 25,
        currency: 'USD',
        frequency: 'weekly' as CSATier['frequency'],
    });

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && initialData) {
                setType(initialData.type);
                setItems(Array.isArray(initialData.items) && initialData.items.length > 0 ? initialData.items : [{name: '', quantity: ''}]);
                setFormData({
                    name: initialData.name,
                    description: initialData.description,
                    price: initialData.price,
                    currency: initialData.currency,
                    frequency: initialData.frequency,
                });
            } else {
                 setType('static');
                 setItems([{name: '', quantity: ''}]);
                 setFormData({
                    name: 'Small Veggie Box',
                    description: 'A weekly selection of fresh, seasonal vegetables.',
                    price: 25,
                    currency: 'USD',
                    frequency: 'weekly',
                });
            }
        }
    }, [isOpen, mode, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'price' ? parseFloat(value) : value }));
    };

    const handleItemChange = (index: number, field: 'name' | 'quantity', value: string) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { name: '', quantity: '' }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave: Omit<CSATier, 'id' | 'createdAt' | 'farmerUid' | 'farmerName' | 'imageUrl'> = { ...formData, type };
        if (type === 'static') {
            dataToSave.items = items.filter(i => i.name.trim() && i.quantity.trim());
        }
        onSave(dataToSave);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? translate('csa.modal.createTierTitle') : translate('csa.modal.editTierTitle')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">{translate('csa.modal.tierType')}</label>
                    <select name="type" value={type} onChange={(e) => setType(e.target.value as 'static' | 'dynamic')} className="w-full mt-1 p-2 border rounded-md">
                        <option value="static">{translate('csa.modal.staticBox')}</option>
                        <option value="dynamic">{translate('csa.modal.dynamicBox')}</option>
                    </select>
                </div>
                <div><label className="block text-sm font-medium">{translate('csa.modal.tierName')}</label><input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                <div><label className="block text-sm font-medium">{translate('csa.modal.description')}</label><textarea name="description" value={formData.description} onChange={handleChange} required rows={3} className="w-full mt-1 p-2 border rounded-md" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">{type === 'dynamic' ? translate('csa.modal.basePrice') : translate('csa.modal.price')}</label><input type="number" name="price" value={formData.price} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">{translate('csa.modal.currency')}</label><input type="text" name="currency" value={formData.currency} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                </div>
                <div><label className="block text-sm font-medium">{translate('csa.modal.frequency')}</label><select name="frequency" value={formData.frequency} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"><option value="weekly">{translate('csa.modal.weekly')}</option><option value="bi-weekly">{translate('csa.modal.bi-weekly')}</option><option value="monthly">{translate('csa.modal.monthly')}</option></select></div>
                
                {type === 'static' && (
                    <div>
                        <label className="block text-sm font-medium">{translate('csa.modal.boxItems')}</label>
                        {items.map((item, index) => (
                            <div key={index} className="flex items-center gap-2 mt-1">
                                <input type="text" placeholder={translate('csa.modal.itemName')} value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} className="w-full p-2 border rounded-md" />
                                <input type="text" placeholder={translate('csa.modal.quantity')} value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-1/2 p-2 border rounded-md" />
                                <button type="button" onClick={() => removeItem(index)} disabled={items.length <= 1} className="p-2 text-red-500 hover:bg-red-100 rounded-full disabled:opacity-50"><Icon name="x-mark" className="h-5 w-5" /></button>
                            </div>
                        ))}
                        <Button type="button" onClick={addItem} variant="secondary" className="!text-xs !py-1 w-full mt-2">{translate('csa.modal.addItem')}</Button>
                    </div>
                )}
                {type === 'dynamic' && <p className="text-sm p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200">{translate('csa.modal.dynamicDesc')}</p>}

                <div className="flex justify-end pt-4"><Button type="submit" disabled={loading}>{loading ? <Spinner /> : translate('csa.modal.saveTier')}</Button></div>
            </form>
        </Modal>
    );
};

const WeeklyAvailabilityManager: React.FC<{
    availability: WeeklyAvailability | null;
    onSave: (items: WeeklyProduceItem[]) => Promise<void>;
}> = ({ availability, onSave }) => {
    const { translate } = useLanguage();
    const [items, setItems] = useState<WeeklyProduceItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setItems(availability?.items || []);
    }, [availability]);

    const handleItemChange = (index: number, field: keyof Omit<WeeklyProduceItem, 'id'>, value: string | number) => {
        const newItems = [...items];
        const item = { ...newItems[index] };
        if (field === 'itemName' || field === 'unit') {
            item[field] = value as string;
        } else if (field === 'pricePerUnit' || field === 'availableQuantity') {
            item[field] = value as number;
        }
        newItems[index] = item;
        setItems(newItems);
    };
    
    const addItem = () => setItems([...items, { id: '', itemName: '', unit: 'kg', pricePerUnit: 0, availableQuantity: 0 }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const handleSave = async () => {
        setLoading(true);
        const validItems = items.filter(i => i.itemName.trim() && i.availableQuantity > 0 && i.pricePerUnit >= 0);
        await onSave(validItems);
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {items.length === 0 && <p className="text-on-surface-variant italic">No items available this week. Add some produce to start curating boxes.</p>}
                {items.map((item, index) => (
                    <div key={item.id || index} className="grid grid-cols-2 md:grid-cols-12 gap-3 items-center bg-surface-bright p-3 rounded-2xl hover:bg-surface-container transition-colors">
                        <input type="text" placeholder={translate('csa.weekly.itemNamePlaceholder')} value={item.itemName} onChange={e => handleItemChange(index, 'itemName', e.target.value)} className="md:col-span-4 p-2 bg-transparent border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" />
                        <input type="number" placeholder={translate('csa.weekly.qtyPlaceholder')} value={item.availableQuantity} onChange={e => handleItemChange(index, 'availableQuantity', parseFloat(e.target.value))} className="md:col-span-2 p-2 bg-transparent border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" />
                        <input type="text" placeholder={translate('csa.weekly.unitPlaceholder')} value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)} className="md:col-span-2 p-2 bg-transparent border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" />
                         <div className="md:col-span-4 flex items-center gap-2">
                            <input type="number" placeholder={translate('csa.weekly.pricePlaceholder')} value={item.pricePerUnit} onChange={e => handleItemChange(index, 'pricePerUnit', parseFloat(e.target.value))} className="w-full p-2 bg-transparent border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" />
                            <button type="button" onClick={() => removeItem(index)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-full transition-colors"><Icon name="x-mark" className="h-5 w-5" /></button>
                         </div>
                    </div>
                ))}
            </div>
             <button type="button" onClick={addItem} className="flex items-center justify-center w-full py-3 bg-[#a3f69c] opacity-80 hover:opacity-100 text-[#005312] font-bold rounded-xl transition-colors">
                 <Icon name="plus" className="w-5 h-5 mr-2"/> {translate('csa.addAvailableItem')}
             </button>
            <div className="text-right mt-2 flex justify-end">
                <button onClick={handleSave} disabled={loading} className="bg-primary hover:bg-[#005312] text-on-primary px-6 py-2 rounded-xl font-bold font-body transition-colors disabled:opacity-50">
                    {loading ? <Spinner/> : translate('csa.saveAvailability')}
                </button>
            </div>
        </div>
    );
};


export const CSAManagement: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const { translate } = useLanguage();
    const [tiers, setTiers] = useState<CSATier[]>([]);
    const [subscribers, setSubscribers] = useState<CSASubscription[]>([]);
    const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability | null>(null);
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [curationLoading, setCurationLoading] = useState(false);
    const [curationSuccess, setCurationSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
    const [tierToEdit, setTierToEdit] = useState<CSATier | null>(null);
    const [tierToDelete, setTierToDelete] = useState<CSATier | null>(null);

    useEffect(() => {
        if (currentUser) {
            setLoading(true);
            const unsubTiers = onCSATiersForFarmerSnapshot(currentUser.uid, setTiers);
            const unsubSubs = onCSASubscribersForFarmerSnapshot(currentUser.uid, setSubscribers);
            const unsubAvailability = onWeeklyAvailabilitySnapshot(currentUser.uid, (avail) => {
                setWeeklyAvailability(avail);
                setLoading(false);
            });
            return () => {
                unsubTiers();
                unsubSubs();
                unsubAvailability();
            };
        }
    }, [currentUser]);
    
    const handleSaveTier = async (data: Omit<CSATier, 'id' | 'createdAt' | 'farmerUid' | 'farmerName' | 'imageUrl'>) => {
        if (!currentUser || !userProfile?.name) return;
        setFormLoading(true);
        setError(null);
        try {
            if (formMode === 'add') {
                const fullData = { ...data, farmerName: userProfile.name, imageUrl: '' };
                await createOrUpdateCSATier(currentUser.uid, fullData);
            } else if (tierToEdit) {
                 const fullData = { ...data, farmerName: userProfile.name, imageUrl: tierToEdit.imageUrl };
                await createOrUpdateCSATier(currentUser.uid, fullData, tierToEdit.id);
            }
            setIsFormOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save tier.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteTier = async () => {
        if (!tierToDelete) return;
        try {
            await deleteCSATier(tierToDelete.id);
            setTierToDelete(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete tier.');
        }
    };

    const handleGenerateBoxes = async () => {
        if (!weeklyAvailability || weeklyAvailability.items.length === 0) {
            setError("Please set your weekly availability before generating boxes.");
            return;
        }
        setCurationLoading(true);
        setError(null);
        setCurationSuccess(null);
        
        const date = new Date();
        const year = date.getUTCFullYear();
        const week = Math.ceil((((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getUTCDay() + 1) / 7);
        const currentWeekId = `${year}-W${week}`;

        const dynamicSubs = subscribers.filter(s => s.tierInfo.type === 'dynamic');
        if(dynamicSubs.length === 0){
             setError("No customers subscribed to dynamic boxes yet.");
             setCurationLoading(false);
             return;
        }

        let successCount = 0;
        try {
            for (const sub of dynamicSubs) {
                const tier = tiers.find(t => t.id === sub.tierId);
                if (sub.preferences && tier) {
                    const curatedItems = await curateDynamicBox(sub.preferences, weeklyAvailability.items, tier);
                    if (Array.isArray(curatedItems)) {
                        await updateSubscriberCuratedItems(sub.id, currentWeekId, curatedItems);
                        successCount++;
                    }
                }
            }
            setCurationSuccess(`Successfully generated curated boxes for ${successCount} subscriber(s)!`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An AI error occurred during curation.");
        } finally {
            setCurationLoading(false);
        }
    };

    const handleSaveAvailability = async (items: WeeklyProduceItem[]) => {
        if (!currentUser) return;
        await updateWeeklyAvailability(currentUser.uid, items);
    };
    
    return (
        <div className="space-y-10 font-body">
            <CSATierFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveTier} loading={formLoading} mode={formMode} initialData={tierToEdit} />
            <Modal isOpen={!!tierToDelete} onClose={() => setTierToDelete(null)} title={translate('csa.modal.deleteTierTitle')}>
                <SafeHTML as="p" html={translate('csa.modal.deleteTierText', { tierName: tierToDelete?.name || '' })} />
                <div className="flex justify-end gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setTierToDelete(null)}>{translate('marketplace.modal.cancel')}</Button>
                    <Button className="bg-red-600 hover:bg-red-700 font-bold" onClick={handleDeleteTier}>{translate('marketplace.modal.delete')}</Button>
                </div>
            </Modal>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold font-headline text-primary">{translate('csa.title')}</h2>
                    <p className="text-on-surface-variant font-body mt-1">{translate('csa.description')}</p>
                </div>
                <button className="bg-primary hover:bg-[#005312] text-on-primary px-6 h-12 rounded-xl font-bold font-body transition-colors flex items-center justify-center gap-2" onClick={() => { setFormMode('add'); setTierToEdit(null); setIsFormOpen(true); }}>
                    {translate('csa.newTier')}
                </button>
            </div>

            {error && <p className="text-error text-center p-3 bg-error-container/20 rounded-xl font-body border border-error-container">{error}</p>}
            {curationSuccess && <p className="text-primary text-center p-3 bg-primary-container/20 rounded-xl font-body border border-primary-container">{curationSuccess}</p>}
            
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric Card 1 */}
                <div className="bg-white md:bg-[#f2f4f0] p-8 rounded-[2rem] flex flex-col justify-between h-48 relative overflow-hidden group">
                    <div className="z-10">
                        <span className="text-gray-600 font-label text-sm font-medium tracking-wide">Active Subscribers</span>
                        <div className="text-[#0d631b] font-headline text-6xl font-extrabold mt-2">{subscribers.length}</div>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Icon name="users" className="w-32 h-32" />
                    </div>
                </div>
                {/* Metric Card 2 */}
                <div className="bg-[#fdcdbc] p-8 rounded-[2rem] flex flex-col justify-between h-48 relative overflow-hidden group">
                    <div className="z-10">
                        <span className="text-[#795548] font-label text-sm font-medium tracking-wide">Available Weekly Items</span>
                        <div className="text-[#7a5649] font-headline text-6xl font-extrabold mt-2">{weeklyAvailability?.items?.length || 0}</div>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#7a5649]">
                        <Icon name="truck" className="w-32 h-32" />
                    </div>
                </div>
                {/* Metric Card 3 */}
                <div className="bg-[#ffefd6] md:bg-[#fff7ed] p-8 rounded-[2rem] flex flex-col justify-between h-48 relative overflow-hidden group">
                    <div className="z-10">
                        <span className="text-[#8c6800] font-label text-sm font-medium tracking-wide">Active Tiers</span>
                        <div className="text-[#8c6800] font-headline text-5xl font-extrabold mt-2">{tiers.length}</div>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#8c6800]">
                        <Icon name="currency-dollar" className="w-32 h-32" />
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <section className="lg:col-span-7 space-y-8">
                     {/* Weekly Availability block replacing 'This Week's Box' */}
                     <div className="bg-[#e1e3df] p-8 rounded-[2.5rem] shadow-sm border border-black/5">
                         <div className="flex items-center justify-between mb-8">
                             <div>
                                 <h2 className="font-headline text-2xl font-bold text-on-surface">Weekly Availability</h2>
                                 <p className="text-on-surface-variant text-sm mt-1">Manage what's available for boxes this week</p>
                             </div>
                         </div>
                         <div className="mb-4">
                            <WeeklyAvailabilityManager availability={weeklyAvailability} onSave={handleSaveAvailability} />
                         </div>
                     </div>

                     {/* My Tiers */}
                     <div className="bg-[#f2f4f0] p-8 rounded-[2.5rem] shadow-sm border border-black/5">
                         <h2 className="font-headline text-2xl font-bold text-on-surface mb-6">{translate('csa.myTiers')}</h2>
                         <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {loading && <Spinner />}
                            {tiers.length === 0 && !loading && <p className="text-on-surface-variant text-center py-8">{translate('csa.noTiers')}</p>}
                            {tiers.map(tier => (
                                <div key={tier.id} className="p-5 border-none rounded-2xl bg-surface-bright flex flex-col md:flex-row items-start md:items-center justify-between group hover:bg-surface-container transition-colors gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-bold text-lg text-on-surface">{tier.name}</h4>
                                            <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${tier.type === 'dynamic' ? 'bg-primary-fixed-dim text-on-primary-fixed' : 'bg-surface-variant text-on-surface-variant'}`}>{translate(tier.type)}</span>
                                        </div>
                                        <p className="text-sm text-on-surface-variant mt-2">{tier.description}</p>
                                        <p className="font-semibold text-primary mt-3 text-lg">{tier.price} <span className="text-sm text-on-surface-variant font-medium">{tier.currency} / {tier.frequency}</span></p>
                                    </div>
                                    <div className="flex items-center gap-2 self-end md:self-center bg-surface-container-low md:bg-transparent rounded-full md:rounded-none p-1 md:p-0 shrink-0">
                                        <button className="p-3 text-on-surface-variant hover:bg-surface-variant rounded-full hover:text-primary transition-colors flex items-center justify-center bg-white md:bg-transparent" onClick={() => { setFormMode('edit'); setTierToEdit(tier); setIsFormOpen(true); }}><Icon name="pencil" className="w-5 h-5"/></button>
                                        <button className="p-3 text-on-surface-variant hover:bg-error-container rounded-full hover:text-error transition-colors flex items-center justify-center bg-white md:bg-transparent" onClick={() => setTierToDelete(tier)}><Icon name="trash" className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                </section>

                <section className="lg:col-span-5 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_10px_30px_-10px_rgba(27,67,50,0.12)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="font-headline text-2xl font-bold text-on-surface">{translate('csa.mySubscribers', { count: subscribers.length })}</h2>
                            <button className="bg-[#ffdf9e] hover:bg-[#fabd00] text-[#261a00] px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50" onClick={handleGenerateBoxes} disabled={curationLoading || subscribers.length === 0}>
                                {curationLoading ? <Spinner/> : <><Icon name="sparkles" className="h-4 w-4 stroke-[3px]"/> Generate Boxes</>}
                            </button>
                        </div>
                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                            {loading && <Spinner />}
                            {subscribers.length === 0 && !loading && <p className="text-on-surface-variant text-center py-8">{translate('csa.noSubscribers')}</p>}
                            {subscribers.map((sub, index) => (
                                <React.Fragment key={sub.id}>
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary-fixed shrink-0 flex items-center justify-center text-on-primary-fixed font-bold font-headline text-lg">
                                            {sub.customerName.substring(0,2).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-on-surface font-headline">{sub.customerName}</h4>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${sub.tierInfo.type === 'dynamic' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                                                    {translate(sub.tierInfo.type)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-on-surface-variant mt-1">{sub.tierInfo.name}</p>
                                        </div>
                                    </div>
                                    {index < subscribers.length - 1 && <div className="h-px bg-surface-variant/70 w-full" />}
                                </React.Fragment>
                            ))}
                        </div>
                         <button className="w-full mt-8 py-4 bg-surface-container-highest rounded-xl text-primary font-bold text-sm hover:bg-surface-variant transition-colors">
                            View All Subscribers
                        </button>
                    </div>

                    {/* Inventory Alert mock component */}
                    {(!weeklyAvailability || weeklyAvailability.items.length === 0) ? (
                     <div className="bg-[#ffdad6] text-[#93000a] p-6 rounded-[2rem] relative overflow-hidden">
                        <div className="flex items-center gap-4 relative z-10">
                            <Icon name="information-circle" className="w-8 h-8 shrink-0" />
                            <div>
                                <h4 className="font-bold font-headline">Inventory Required</h4>
                                <p className="text-sm mt-1 font-body text-black/60">Update weekly availability to begin curating dynamic subscriber boxes.</p>
                            </div>
                        </div>
                    </div>
                    ) : (
                     <div className="bg-[#ffefd6] text-[#8c6800] p-6 rounded-[2rem] relative overflow-hidden">
                        <div className="flex items-center gap-4 relative z-10">
                            <Icon name="check-circle" className="w-8 h-8 shrink-0" />
                            <div>
                                <h4 className="font-bold font-headline">Ready for Curation</h4>
                                <p className="text-sm mt-1 opacity-90 font-body">Availability updated. You can generate dynamic boxes.</p>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 bg-on-tertiary-container w-full opacity-30"></div>
                    </div>
                    )}
                </section>
            </div>
        </div>
    );
};
