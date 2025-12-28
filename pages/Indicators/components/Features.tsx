
import React from 'react';
import { Zap, Shield, MousePointer2, RefreshCcw } from 'lucide-react';
import { LOGO_URL } from '../constants';
import { Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface FeaturesProps {
  currentLang: Language;
}

export const Features: React.FC<FeaturesProps> = ({ currentLang }) => {
  const t = getTranslations(currentLang).indicators.features;
  
  const features = [
    {
      icon: <Zap className="w-10 h-10 text-yellow-500 group-hover:scale-110 transition-transform" />,
      title: t.f1.title,
      description: t.f1.desc
    },
    {
      icon: <Shield className="w-10 h-10 text-green-500 group-hover:scale-110 transition-transform" />,
      title: t.f2.title,
      description: t.f2.desc
    },
    {
      icon: <MousePointer2 className="w-10 h-10 text-blue-500 group-hover:scale-110 transition-transform" />,
      title: t.f3.title,
      description: t.f3.desc
    },
    {
      icon: <RefreshCcw className="w-10 h-10 text-purple-500 group-hover:scale-110 transition-transform" />,
      title: t.f4.title,
      description: t.f4.desc
    }
  ];

  return (
    <section id="recursos" className="relative py-24 bg-white dark:bg-tech-950 border-y border-transparent dark:border-tech-800 transition-colors duration-300 overflow-hidden">
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.1] dark:opacity-[0.05]"
        style={{
            backgroundImage: `url(${LOGO_URL})`,
            backgroundAttachment: 'fixed',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '400px'
        }}
      />

      <div className="relative z-10 max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t.title}</h2>
          <div className="h-1.5 w-24 bg-tech-accent mx-auto mt-4 rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center text-center group p-8 rounded-3xl hover:bg-gray-50 dark:hover:bg-tech-900 transition-all duration-300 border border-transparent hover:border-gray-100 dark:hover:border-tech-800">
              <div className="mb-6 bg-gray-100 dark:bg-tech-800/80 w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner group-hover:shadow-xl transition-all">
                {feature.icon}
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-widest group-hover:text-tech-accent transition-colors">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-base font-medium leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
