import React, { useState, useEffect, useRef } from 'react';
import Icon from './common/Icon';
import Modal from './common/Modal';
// FIX: Correctly import 'parseUserCommand' from the service and the 'ParsedCommand' type from types.
import { parseUserCommand } from '../services/geminiService';
import type { ParsedCommand } from '../types';
import Spinner from './common/Spinner';
import { useLanguage } from '../contexts/LanguageContext';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// FIX: Define the SpeechRecognition interface to resolve the "Cannot find name 'SpeechRecognition'" error.
interface SpeechRecognition {
    // properties
    continuous: boolean;
    interimResults: boolean;
    lang: string;
  
    // event handlers
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
  
    // methods
    start(): void;
    stop(): void;
}

interface AICommandBarProps {
    isOpen: boolean;
    onClose: () => void;
    onCommand: (command: ParsedCommand) => void;
}

const AICommandBar: React.FC<AICommandBarProps> = ({ isOpen, onClose, onCommand }) => {
    const { language } = useLanguage();
    const [inputValue, setInputValue] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Focus input when modal opens
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.continuous = false;
            recognition.interimResults = true;
            
            const langMap: Record<string, string> = {
                en: 'en-US',
                hi: 'hi-IN',
                te: 'te-IN',
            };
            recognition.lang = langMap[language] || 'en-US';

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        const finalTranscript = event.results[i][0].transcript;
                        setInputValue(finalTranscript);
                        handleSubmit(finalTranscript); // Automatically submit on final voice result
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                        setInputValue(interimTranscript);
                    }
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };
            
            recognition.onend = () => {
                setIsListening(false);
            };

        }

        return () => {
            recognitionRef.current?.stop();
        };
    }, [language]); // Depend on language to re-initialize if it changes

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setInputValue('');
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };

    const handleSubmit = async (commandText?: string) => {
        const command = (commandText || inputValue).trim();
        if (!command) return;

        setIsLoading(true);
        try {
            const parsed = await parseUserCommand(command);
            onCommand(parsed);
            onClose(); // Close modal on success
        } catch (error) {
            console.error("Error parsing command:", error);
            // Handle error display if needed
        } finally {
            setIsLoading(false);
            setInputValue('');
        }
    };
    
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSubmit();
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Command">
            <form onSubmit={handleFormSubmit} className="relative">
                <Icon name="wand-magic-sparkles" className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="e.g., 'Go to market prices' or 'Weather in Mumbai'"
                    className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:outline-none"
                    disabled={isLoading}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {isLoading ? <Spinner /> : (
                        <button type="button" onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                            <Icon name="microphone" className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </form>
             <div className="text-xs text-gray-500 text-center mt-2">
                You can say things like "Show me crop yield prediction" or "Find the market price for wheat in Punjab".
            </div>
        </Modal>
    );
};

export default AICommandBar;
