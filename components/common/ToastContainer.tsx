import React, { useEffect, useState } from 'react';
import { useToast, Toast, ToastType } from '../../contexts/ToastContext';

const iconMap: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const colorMap: Record<ToastType, { bg: string; border: string; text: string; icon: string; progress: string }> = {
  success: {
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#2D6A4F]/20',
    text: 'text-[#2D6A4F]',
    icon: 'text-[#2D6A4F]',
    progress: 'bg-[#2D6A4F]',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-500',
    progress: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: 'text-amber-500',
    progress: 'bg-amber-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-500',
    progress: 'bg-blue-500',
  },
};

const SingleToast: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const colors = colorMap[toast.type];
  const duration = toast.duration || 4000;

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));
    // Trigger leave animation before removal
    const leaveTimer = setTimeout(() => setIsLeaving(true), duration - 300);
    return () => clearTimeout(leaveTimer);
  }, [duration]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`relative w-full max-w-sm overflow-hidden rounded-2xl border ${colors.border} ${colors.bg} shadow-lg backdrop-blur-sm transition-all duration-300 ease-out ${
        isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <span className={`material-symbols-outlined text-xl ${colors.icon} shrink-0 mt-0.5`}>
          {iconMap[toast.type]}
        </span>
        <p className={`text-sm font-semibold ${colors.text} flex-1 leading-relaxed`}>
          {toast.message}
        </p>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 -mt-0.5"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gray-100">
        <div
          className={`h-full ${colors.progress} opacity-40 rounded-full`}
          style={{
            animation: `shrinkWidth ${duration}ms linear forwards`,
          }}
        />
      </div>
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <SingleToast toast={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
