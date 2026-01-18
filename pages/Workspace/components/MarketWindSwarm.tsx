import React from 'react';
import { Language } from '../../../types';
import { X as CloseIcon, Atom } from 'lucide-react';

interface MarketWindSwarmProps { language: Language; onClose: () => void; }

const MarketWindSwarm = ({ language, onClose }: MarketWindSwarmProps) => {
  return (
    <div className="fixed inset-0 z-[2000] bg-[#0a0b0c] text-white flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-50">
            <CloseIcon size={24} />
        </button>
        <div className="text-center max-w-md relative z-10">
            <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-[#dd9933] blur-3xl opacity-20 rounded-full"></div>
                <Atom size={80} className="text-[#dd9933] relative animate-spin-slow" />
            </div>
            <h2 className="text-4xl font-black uppercase tracking-[0.2em] mb-4">Market Swarm</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
                Visualização de física de mercado em tempo real.
                <br/>
                <span className="text-xs font-bold text-gray-600 mt-2 block">PHYSICS ENGINE LOADING...</span>
            </p>
            <button onClick={onClose} className="px-8 py-3 bg-[#dd9933] text-black font-black uppercase tracking-widest rounded-full hover:bg-amber-500 transition-all hover:scale-105 shadow-xl shadow-orange-900/20">
                Voltar
            </button>
        </div>
    </div>
  );
};

export default MarketWindSwarm;