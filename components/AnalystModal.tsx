
import React from 'react';
import { X } from './Icons';
import AnalystContent from './AnalystContent';

interface AnalystModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AnalystModal: React.FC<AnalystModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-tech-950 border border-tech-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-tech-800 bg-tech-900 shrink-0">
          <h3 className="text-[#dd9933] font-bold uppercase tracking-wider text-sm">Sobre nosso Analista Sênior</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white bg-black/20 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar bg-tech-950">
          <AnalystContent />
        </div>
        <div className="p-4 border-t border-tech-800 bg-tech-900 shrink-0">
          <button onClick={onClose} className="w-full bg-tech-800 hover:bg-tech-700 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalystModal;
