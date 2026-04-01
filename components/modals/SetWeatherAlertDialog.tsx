import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createCustomAlert } from '../../services/customAlertService';
import { CustomWeatherAlert } from '../../types';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { useLanguage } from '../../contexts/LanguageContext';
import SafeHTML from '../common/SafeHTML';

interface SetWeatherAlertDialogProps {
    isOpen: boolean;
    onClose: (success: boolean) => void;
    location: string;
}

const SetWeatherAlertDialog: React.FC<SetWeatherAlertDialogProps> = ({ isOpen, onClose, location }) => {
    const { currentUser } = useAuth();
    const { translate } = useLanguage();
    const [condition, setCondition] = useState<CustomWeatherAlert['condition']>('temperature');
    const [operator, setOperator] = useState<CustomWeatherAlert['operator']>('lte');
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
            const alertData: Omit<CustomWeatherAlert, 'id' | 'uid' | 'status' | 'createdAt'> = {
                type: 'weather',
                location,
                condition,
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
    
    const conditionUnit = {
        temperature: '°C',
        humidity: '%',
        windSpeed: 'km/h'
    };

    return (
        <Modal isOpen={isOpen} onClose={() => onClose(false)} title={translate('weather.modal.title')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <SafeHTML as="p" className="text-sm text-gray-600" html={translate('weather.modal.description', { location })} />
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">{translate('weather.modal.condition')}</label>
                    <select value={condition} onChange={e => setCondition(e.target.value as CustomWeatherAlert['condition'])} className="w-full mt-1 p-2 border rounded-md">
                        <option value="temperature">{translate('weather.modal.temperature')}</option>
                        <option value="humidity">{translate('weather.modal.humidity')}</option>
                        <option value="windSpeed">{translate('weather.modal.wind')}</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{translate('weather.modal.trigger')}</label>
                        <select value={operator} onChange={e => setOperator(e.target.value as CustomWeatherAlert['operator'])} className="w-full mt-1 p-2 border rounded-md">
                            <option value="lte">{translate('weather.modal.below')}</option>
                            <option value="gte">{translate('weather.modal.above')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{translate('weather.modal.value', { unit: conditionUnit[condition] })}</label>
                        <input type="number" value={value} onChange={e => setValue(parseFloat(e.target.value))} className="w-full mt-1 p-2 border rounded-md" step="any" />
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                
                <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={loading}>
                        {loading ? <Spinner /> : translate('weather.modal.setAlert')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default SetWeatherAlertDialog;
