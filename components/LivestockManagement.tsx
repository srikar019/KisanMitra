import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getLivestockHealthAnalysis } from '../services/geminiService';
import { addLivestock, onLivestockSnapshot, updateLivestock, deleteLivestock } from '../services/livestockService';
import { Livestock, LivestockType, LivestockGender, HealthStatus, LivestockHealthAnalysis } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Icon from './common/Icon';
import Spinner from './common/Spinner';
import Modal from './common/Modal';
import SafeHTML from './common/SafeHTML';

type FormModalMode = 'add' | 'edit';

const HealthStatusBadge: React.FC<{ status: HealthStatus }> = ({ status }) => {
    const { translate } = useLanguage();
    const styles = {
        [HealthStatus.Healthy]: 'bg-green-100 text-green-800',
        [HealthStatus.Sick]: 'bg-red-100 text-red-800',
        [HealthStatus.UnderObservation]: 'bg-yellow-100 text-yellow-800',
        [HealthStatus.Quarantined]: 'bg-purple-100 text-purple-800',
    };
    
    const statusLabels = {
        [HealthStatus.Healthy]: translate('livestock.healthStatus.healthy'),
        [HealthStatus.Sick]: translate('livestock.healthStatus.sick'),
        [HealthStatus.UnderObservation]: translate('livestock.healthStatus.observation'),
        [HealthStatus.Quarantined]: translate('livestock.healthStatus.quarantined'),
    };

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
            {statusLabels[status] || status}
        </span>
    );
};

const LivestockManagement: React.FC = () => {
    const { currentUser } = useAuth();
    const { translate } = useLanguage();
    const [livestock, setLivestock] = useState<Livestock[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<FormModalMode>('add');
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [selectedAnimal, setSelectedAnimal] = useState<Livestock | null>(null);

    useEffect(() => {
        if (currentUser) {
            setLoading(true);
            const unsubscribe = onLivestockSnapshot(currentUser.uid, (data) => {
                setLivestock(data);
                setLoading(false);
            }, (err) => {
                setError(err.message);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [currentUser]);

    const filteredLivestock = useMemo(() => {
        return livestock.filter(animal =>
            animal.tagId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            animal.breed.toLowerCase().includes(searchTerm.toLowerCase()) ||
            animal.type.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [livestock, searchTerm]);

    const handleOpenForm = (mode: FormModalMode, animal: Livestock | null = null) => {
        setFormMode(mode);
        setSelectedAnimal(animal);
        setIsFormOpen(true);
    };

    const handleOpenDetail = (animal: Livestock) => {
        setSelectedAnimal(animal);
        setIsDetailOpen(true);
    };

    const handleOpenConfirm = (animal: Livestock) => {
        setSelectedAnimal(animal);
        setIsDetailOpen(false);
        setIsConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (currentUser && selectedAnimal) {
            try {
                await deleteLivestock(currentUser.uid, selectedAnimal.id);
                setIsConfirmOpen(false);
                setSelectedAnimal(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete animal.');
            }
        }
    };
    
    return (
        <Card className="!max-w-7xl">
            <AnimalFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                mode={formMode}
                animal={selectedAnimal}
                setError={setError}
            />
             <AnimalDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                animal={selectedAnimal}
                onEdit={() => selectedAnimal && handleOpenForm('edit', selectedAnimal)}
                onDelete={() => selectedAnimal && handleOpenConfirm(selectedAnimal)}
            />
            <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title={translate('livestock.confirmDelete.title')}>
                 <div>
                    <SafeHTML as="p" html={translate('livestock.confirmDelete.text', { tagId: selectedAnimal?.tagId || '' })} />
                    <div className="flex justify-end gap-4 mt-6">
                        <Button variant="secondary" onClick={() => setIsConfirmOpen(false)}>{translate('community.post.button.cancel')}</Button>
                        <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>{translate('community.post.button.delete')}</Button>
                    </div>
                </div>
            </Modal>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div className="flex items-center">
                    <Icon name="livestock" className="h-8 w-8 text-blue-500 mr-3" />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-700">{translate('livestock.title')}</h2>
                        <p className="text-gray-600">{translate('livestock.description')}</p>
                    </div>
                </div>
                <Button onClick={() => handleOpenForm('add')}>{translate('livestock.addAnimal')}</Button>
            </div>
            
             <div className="mb-6 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Icon name="search" className="h-5 w-5 text-gray-400" /></div>
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={translate('livestock.searchPlaceholder')} className="w-full p-2 pl-10 border rounded-md" />
            </div>

            {error && <p className="text-red-500 text-center mb-4">{error}</p>}
            
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
                </div>
            ) : filteredLivestock.length === 0 ? (
                 <div className="text-center py-16 bg-gray-50 rounded-lg border">
                    <Icon name="livestock" className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">{translate('livestock.noAnimals')}</h3>
                    <p className="text-gray-500 mt-2">{translate('livestock.noAnimalsDesc')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredLivestock.map(animal => (
                        <div key={animal.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col group cursor-pointer" onClick={() => handleOpenDetail(animal)}>
                            <div className="relative h-48 w-full overflow-hidden">
                                <img src={animal.imageUrl || undefined} alt={`${animal.breed} ${animal.type}`} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            </div>
                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-bold text-gray-800">{animal.breed} {animal.type}</h3>
                                    <HealthStatusBadge status={animal.healthStatus} />
                                </div>
                                <p className="text-sm text-gray-500 mb-2">{translate('livestock.tagId')}: <span className="font-mono bg-gray-100 px-1 rounded">{animal.tagId}</span></p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

// --- MODAL COMPONENTS ---

interface AnimalFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: FormModalMode;
    animal: Livestock | null;
    setError: (error: string | null) => void;
}

const AnimalFormModal: React.FC<AnimalFormModalProps> = ({ isOpen, onClose, mode, animal, setError }) => {
    const { currentUser } = useAuth();
    const { translate } = useLanguage();
    const [formData, setFormData] = useState<Omit<Livestock, 'id' | 'farmerUid' | 'createdAt' | 'imageUrl'>>({
        tagId: '',
        type: LivestockType.Cow,
        breed: '',
        gender: LivestockGender.Female,
        birthDate: new Date().toISOString().split('T')[0],
        healthStatus: HealthStatus.Healthy,
        notes: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (mode === 'edit' && animal) {
            setFormData({
                tagId: animal.tagId,
                type: animal.type,
                breed: animal.breed,
                gender: animal.gender,
                birthDate: animal.birthDate,
                healthStatus: animal.healthStatus,
                notes: animal.notes || '',
            });
        } else {
             setFormData({
                tagId: '',
                type: LivestockType.Cow,
                breed: '',
                gender: LivestockGender.Female,
                birthDate: new Date().toISOString().split('T')[0],
                healthStatus: HealthStatus.Healthy,
                notes: '',
            });
        }
    }, [isOpen, mode, animal]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setLoading(true);
        setError(null);
        try {
            if (mode === 'add') {
                await addLivestock(currentUser.uid, { ...formData, imageUrl: '' });
            } else if (animal) {
                await updateLivestock(currentUser.uid, animal.id, formData);
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save animal data.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={mode === 'add' ? translate('livestock.modal.addTitle') : translate('livestock.modal.editTitle')}>
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">{translate('livestock.tagId')}</label><input type="text" name="tagId" value={formData.tagId} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">{translate('livestock.type')}</label><select name="type" value={formData.type} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md">{Object.values(LivestockType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="block text-sm font-medium">{translate('livestock.breed')}</label><input type="text" name="breed" value={formData.breed} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">{translate('livestock.gender')}</label><select name="gender" value={formData.gender} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md">{Object.values(LivestockGender).map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                    <div><label className="block text-sm font-medium">{translate('livestock.birthDate')}</label><input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md" /></div>
                    <div><label className="block text-sm font-medium">{translate('livestock.healthStatus')}</label><select name="healthStatus" value={formData.healthStatus} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md">{Object.values(HealthStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                 <div><label className="block text-sm font-medium">{translate('livestock.notes')}</label><textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full mt-1 p-2 border rounded-md" /></div>
                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={loading}>{loading ? <Spinner /> : translate('livestock.saveRecord')}</Button>
                </div>
            </form>
        </Modal>
    );
};

interface AnimalDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    animal: Livestock | null;
    onEdit: () => void;
    onDelete: () => void;
}

const AnimalDetailModal: React.FC<AnimalDetailModalProps> = ({ isOpen, onClose, animal, onEdit, onDelete }) => {
    const { translate, language } = useLanguage();
    const [analysis, setAnalysis] = useState<LivestockHealthAnalysis | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    useEffect(() => {
        // Reset analysis when modal opens for a new animal
        setAnalysis(null);
        setAnalysisError(null);
    }, [isOpen]);

    const handleAnalyze = async () => {
        if (!animal) return;
        setAnalysisLoading(true);
        setAnalysisError(null);
        setAnalysis(null);
        try {
            const result = await getLivestockHealthAnalysis(animal, language);
            setAnalysis(result);
        } catch (err) {
            setAnalysisError(err instanceof Error ? err.message : "AI analysis failed.");
        } finally {
            setAnalysisLoading(false);
        }
    };
    
    if (!animal) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={translate('livestock.modal.detailTitle', { tagId: animal.tagId })}>
            <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="font-medium text-gray-500">{translate('livestock.type')}</p><p className="font-semibold text-gray-800">{animal.type}</p></div>
                    <div><p className="font-medium text-gray-500">{translate('livestock.breed')}</p><p className="font-semibold text-gray-800">{animal.breed}</p></div>
                    <div><p className="font-medium text-gray-500">{translate('livestock.gender')}</p><p className="font-semibold text-gray-800">{animal.gender}</p></div>
                    <div><p className="font-medium text-gray-500">{translate('livestock.birthDate')}</p><p className="font-semibold text-gray-800">{animal.birthDate}</p></div>
                    <div className="col-span-2"><p className="font-medium text-gray-500">{translate('livestock.healthStatus')}</p><p><HealthStatusBadge status={animal.healthStatus}/></p></div>
                    {animal.notes && <div className="col-span-2"><p className="font-medium text-gray-500">{translate('livestock.notes')}</p><p className="text-gray-700 whitespace-pre-wrap">{animal.notes}</p></div>}
                </div>

                <div className="p-4 bg-blue-50/70 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">{translate('livestock.aiPilot.title')}</h4>
                    {analysisError && <p className="text-red-500 text-sm">{analysisError}</p>}
                    {analysisLoading && <div className="flex items-center text-blue-700"><Spinner />{translate('livestock.aiPilot.analyzing')}</div>}
                    {analysis && (
                        <div className="space-y-2 text-sm animate-fade-in">
                            <div>
                                <h5 className="font-semibold text-gray-700">{translate('disease.report.plant.description')}:</h5>
                                <p className="text-gray-600">{analysis.summary}</p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-700">{translate('disease.report.soil.recommendations')}:</h5>
                                <ul className="list-disc list-inside text-gray-600">
                                    {analysis.recommendations?.map((rec, i) => <li key={i}>{rec}</li>) || <li>No recommendations provided.</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                    {!analysis && !analysisLoading && (
                         <Button onClick={handleAnalyze} variant="secondary" className="!text-sm !py-1 !px-3">
                            <Icon name="sparkles" className="h-4 w-4 mr-2"/>
                            {translate('livestock.aiPilot.generate')}
                        </Button>
                    )}
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button variant="secondary" onClick={() => { onClose(); onDelete(); }}>{translate('community.post.button.delete')}</Button>
                    <Button onClick={() => { onClose(); onEdit(); }}>{translate('community.post.button.edit')}</Button>
                </div>
            </div>
        </Modal>
    );
};

export default LivestockManagement;
