import React from 'react';
import Icon from './Icon';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            {/* The outer div now also has a max-h to constrain the modal on short screens */}
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl relative animate-fade-in-up flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                    <h2 id="modal-title" className="text-xl font-bold text-gray-700">{title}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200" aria-label="Close dialog">
                        <Icon name="x-mark" className="h-6 w-6 text-gray-600" />
                    </button>
                </div>
                {/* This content div will now scroll if the content inside is too tall */}
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
