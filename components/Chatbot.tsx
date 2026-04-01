import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Removed unused and unexported 'LiveSession' type.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { getChatbotResponse } from '../services/geminiService';
import type { ChatMessage } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from './common/Icon';

/**
 * Formats the raw text response from the AI into a clean, bulleted list.
 * @param responseText The raw string from the AI.
 * @returns A formatted string with 4-5 bullet points.
 */
const formatAIResponse = (responseText: string): string => {
  const trimmedResponse = responseText.trim();

  // 1. If the response is already a list, return it as is to preserve formatting.
  const isAlreadyList = /^\s*([*-]|\d+\.)/m.test(trimmedResponse);
  if (isAlreadyList) {
    return trimmedResponse;
  }

  // 2. Split the response into sentences. This regex is more robust than a simple split.
  let sentences: string[] = trimmedResponse.match(/[^.!?]+[.!?](\s|$)/g) || [];

  // 3. As a fallback for long sentences, try splitting by clauses if it makes sense.
  if (sentences.length <= 1 && trimmedResponse.includes(',')) {
      const clauses = trimmedResponse.split(',').map(s => s.trim()).filter(s => s.length > 15);
      if (clauses.length > 2) {
        sentences = clauses;
      }
  }
  
  // 4. If we still only have one item, just bullet that.
  if (sentences.length <= 1) {
    return `• ${trimmedResponse}`;
  }

  // 5. Limit to 4-5 key points for clarity.
  const keyPoints = sentences.slice(0, 5);

  // 6. Join the points into a single string with bullet points and newlines.
  return keyPoints.map(s => `• ${s.trim()}`).join('\n');
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Audio Helper Functions ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


const Chatbot: React.FC = () => {
  const { translate, language } = useLanguage();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: "Namaste! I'm KisanMitra, your AI farming assistant. How can I help you with your crops, soil, or market today?",
    },
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Voice Assistant State
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState({ user: '', model: '' });
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  // FIX: Infer the session promise type from the SDK's connect method to avoid using the unexported 'LiveSession' type.
  const sessionPromiseRef = useRef<ReturnType<typeof ai.live.connect> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioPlaybackSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextStartTimeRef = useRef(0);

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages, isLoading, isVoiceSessionActive, transcriptionHistory, currentTranscription]);

  const stopVoiceSession = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
    }

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();

    sessionPromiseRef.current = null;
    mediaStreamRef.current = null;
    scriptProcessorRef.current = null;
    sourceNodeRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    audioPlaybackSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsVoiceSessionActive(false);
    setVoiceError(null);
    setTranscriptionHistory([]);
    setCurrentTranscription({ user: '', model: '' });
  }, []);

  const startVoiceSession = useCallback(async () => {
    setVoiceError(null);
    setIsVoiceSessionActive(true);
    setTranscriptionHistory([]);
    setCurrentTranscription({ user: '', model: '' });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // FIX: Cast window to `any` to allow for `webkitAudioContext` fallback for older browsers without causing a TypeScript error.
      inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      // FIX: Cast window to `any` to allow for `webkitAudioContext` fallback for older browsers without causing a TypeScript error.
      outputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
            sourceNodeRef.current = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            sourceNodeRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle transcriptions
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            setCurrentTranscription({ user: currentInputTranscriptionRef.current, model: currentOutputTranscriptionRef.current });

            if (message.serverContent?.turnComplete) {
              const fullInput = currentInputTranscriptionRef.current;
              const fullOutput = currentOutputTranscriptionRef.current;
              setTranscriptionHistory(prev => [
                ...prev,
                { role: 'user', content: fullInput },
                { role: 'model', content: fullOutput }
              ]);
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
              setCurrentTranscription({ user: '', model: '' });
            }

            // Handle audio playback
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const outputCtx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => {
                audioPlaybackSourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioPlaybackSourcesRef.current.add(source);
            }

            // Handle interruptions
            if (message.serverContent?.interrupted) {
              for (const source of audioPlaybackSourcesRef.current.values()) {
                source.stop();
                audioPlaybackSourcesRef.current.delete(source);
              }
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Voice session error:', e);
            setVoiceError("A voice session error occurred. Please try again.");
            stopVoiceSession();
          },
          onclose: (e: CloseEvent) => {
            console.log('Voice session closed');
            stopVoiceSession();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are KisanMitra, a friendly and helpful AI farming assistant. Your expertise includes soil health, pests, irrigation, and market updates. RESPOND IN ${language === 'hi' ? 'Hindi' : language === 'te' ? 'Telugu' : 'English'}.`,
        },
      });
    } catch (err) {
      console.error("Failed to get microphone permissions:", err);
      setVoiceError("Microphone access denied. Please enable microphone permissions in your browser settings.");
      setIsVoiceSessionActive(false);
    }
  }, [stopVoiceSession]);

  useEffect(() => {
    return () => {
      if (isVoiceSessionActive) {
        stopVoiceSession();
      }
    };
  }, [isVoiceSessionActive, stopVoiceSession]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const userMessage = inputValue.trim();
    if (!userMessage || isLoading) return;

    const newHistory: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await getChatbotResponse(newHistory, language);
      const formattedResponse = formatAIResponse(response);
      setMessages((prev) => [...prev, { role: 'model', content: formattedResponse }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sorry, I couldn't connect to my brain. Please try again later.";
      setMessages((prev) => [...prev, { role: 'model', content: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTextChat = () => (
    <>
      <div className="flex-1 p-4 overflow-y-auto bg-green-50/20">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${msg.role === 'user' ? 'bg-blue-500' : 'bg-white'}`}>
                  <Icon name={msg.role === 'user' ? 'user-circle' : 'mascot'} className={msg.role === 'user' ? 'h-5 w-5 text-white' : 'h-8 w-8'}/>
              </div>
              <div className={`p-3 rounded-2xl max-w-[80%] break-words whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3 flex-row">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden"><Icon name="mascot" className="h-8 w-8"/></div>
              <div className="p-3 rounded-2xl bg-gray-100 text-gray-800 rounded-bl-none">
                <div className="flex items-center gap-2">
                   <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0s]"></span>
                   <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.15s]"></span>
                   <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.3s]"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form onSubmit={handleSendMessage} className="flex-shrink-0 p-4 border-t bg-white rounded-b-2xl">
        <div className="relative flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question..."
            className="w-full py-2 pl-4 pr-12 text-gray-800 bg-gray-100 border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={startVoiceSession}
            className="p-2 text-gray-500 hover:text-green-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Start voice chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="absolute inset-y-0 right-12 flex items-center justify-center w-10 h-10 text-white bg-green-600 rounded-full transform transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:scale-100 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Icon name="paper-airplane" className="w-5 h-5 -ml-px" />
          </button>
        </div>
      </form>
    </>
  );

  const renderVoiceChat = () => (
    <>
      <div className="flex-1 p-4 overflow-y-auto bg-green-50/20">
        {voiceError && <p className="text-red-500 text-center bg-red-100 p-2 rounded-md">{voiceError}</p>}
        <div className="space-y-4">
          {transcriptionHistory.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${msg.role === 'user' ? 'bg-blue-500' : 'bg-white'}`}>
                    <Icon name={msg.role === 'user' ? 'user-circle' : 'mascot'} className={msg.role === 'user' ? 'h-5 w-5 text-white' : 'h-8 w-8'}/>
                </div>
                <div className={`p-3 rounded-2xl max-w-[80%] break-words ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                  {msg.content}
                </div>
            </div>
          ))}
           {currentTranscription.user && (
            <div className="flex items-start gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500"><Icon name="user-circle" className="h-5 w-5 text-white"/></div>
              <div className="p-3 rounded-2xl max-w-[80%] break-words bg-blue-500 text-white rounded-br-none italic">{currentTranscription.user}</div>
            </div>
          )}
          {currentTranscription.model && (
            <div className="flex items-start gap-3 flex-row">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white overflow-hidden"><Icon name="mascot" className="h-8 w-8"/></div>
              <div className="p-3 rounded-2xl max-w-[80%] break-words bg-gray-100 text-gray-800 rounded-bl-none italic">{currentTranscription.model}</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="flex-shrink-0 p-4 border-t bg-white rounded-b-2xl flex flex-col items-center justify-center h-[90px]">
        <div className="w-16 h-16 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center transform transition-all hover:scale-105 animate-pulse"
          onClick={stopVoiceSession}
        >
          <Icon name="x-mark" className="w-8 h-8" />
        </div>
        <p className="text-xs text-red-600 mt-1">Stop Session</p>
      </div>
    </>
  );

  return (
    <>
      {/* Chat Window */}
      <div
        className={`z-50 fixed bottom-24 right-4 sm:right-6 w-[calc(100%-2rem)] max-w-sm h-[70vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-in-out origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-white flex items-center justify-center">
              <Icon name="mascot" className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">KisanMitra Assistant</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 text-gray-500 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500" aria-label="Close chat">
            <Icon name="x-mark" className="h-6 w-6" />
          </button>
        </div>

        {isVoiceSessionActive ? renderVoiceChat() : renderTextChat()}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="z-50 fixed bottom-4 right-4 sm:right-6 w-16 h-16 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center transform transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        aria-label={isOpen ? "Close chat" : "Open chat assistant"}
      >
        <div className="transition-transform duration-300 ease-in-out overflow-hidden rounded-full h-14 w-14 flex items-center justify-center bg-white" style={{ transform: isOpen ? 'rotate(90deg) scale(0.75)' : 'rotate(0) scale(1)' }}>
            <Icon name={isOpen ? 'x-mark' : 'mascot'} className={isOpen ? 'w-8 h-8' : 'w-14 h-14'} />
        </div>
      </button>
    </>
  );
};

export default Chatbot;
