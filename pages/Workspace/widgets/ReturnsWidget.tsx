
import React from 'react';
import { Language } from '../../../types';

const PlaceholderBox = ({ title }: { title: string }) => (
    <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors h-96 flex flex-col items-center justify-center">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="text-gray-400 dark:text-slate-500 text-sm">
            Em breve...
        </div>
    </div>
);

const PageHeader = ({ title, description }: { title: string; description: string }) => (
  <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors mb-6 shrink-0">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
    <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">{description}</p>
  </div>
);


export const ReturnsWidget: React.FC<{ language: Language }> = ({ language }) => {
    return (
        <div className="w-full flex flex-col gap-6">
            <PageHeader
                title="Análise de Retornos"
                description="Visualize a performance histórica de ativos em diferentes períodos."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PlaceholderBox title="Retornos Diários (1D)" />
                <PlaceholderBox title="Retornos Semanais (1W)" />
                <PlaceholderBox title="Retornos Mensais (1M)" />
                <PlaceholderBox title="Retornos Trimestrais (3M)" />
            </div>
        </div>
    );
};

export default ReturnsWidget;
