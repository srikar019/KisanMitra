import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createCustomAlert } from '../../services/customAlertService';
import { CustomMarketAlert } from '../../types';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { useLanguage } from '../../contexts/LanguageContext';
import SafeHTML from '../common/SafeHTML';

interface SetMarketAlertDialogProps {
    isOpen: boolean;
    onClose: (success: boolean) => void;
    crop: string;
    location: string;
    priceUnit: string;
}

const SetMarketAlertDialog: React.FC<SetMarketAlertDialogProps> = ({ isOpen, onClose, crop, location, priceUnit }) => {
    const { currentUser } = useAuth();
    const { translate } = useLanguage();
    const [operator, setOperator] = useState<CustomMarketAlert['operator']>('gte');
    const [value, setValue] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) {
            setError("You must be logged in.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const alertData: Omit<CustomMarketAlert, 'id' | 'uid' | 'status' | 'createdAt'> = {
                type: 'market',
                crop,
                location,
                operator,
                value
            };
            await createCustomAlert(currentUser.uid, alertData);
            onClose(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to set alert.");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={() => onClose(false)} title={translate('marketPrices.modal.title')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <SafeHTML as="p" className="text-sm text-gray-600" html={translate('marketPrices.modal.description', { crop, location })} />
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{translate('marketPrices.modal.trigger')}</label>
                        <select value={operator} onChange={e => setOperator(e.target.value as CustomMarketAlert['operator'])} className="w-full mt-1 p-2 border rounded-md">
                            <option value="gte">{translate('marketPrices.modal.above')}</option>
                            <option value="lte">{translate('marketPrices.modal.below')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{translate('marketPrices.modal.value', { priceUnit })}</label>
                        <input type="number" value={value} onChange={e => setValue(parseFloat(e.target.value))} className="w-full mt-1 p-2 border rounded-md" step="any" />
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                
                <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={loading}>
                        {loading ? <Spinner /> : translate('marketPrices.modal.setAlert')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default SetMarketAlertDialog;
