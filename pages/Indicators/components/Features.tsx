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
      icon: <Zap className="w-8 h-8 text-yellow-500" />,
      title: t.f1.title,
      description: t.f1.desc
    },
    {
      icon: <Shield className="w-8 h-8 text-green-500" />,
      title: t.f2.title,
      description: t.f2.desc
    },
    {
      icon: <MousePointer2 className="w-8 h-8 text-tech-accent" />,
      title: t.f3.title,
      description: t.f3.desc
    },
    {
      icon: <RefreshCcw className="w-8 h-8 text-purple-500" />,
      title: t.f4.title,
      description: t.f4.desc
    }
  ];

  return (
    <section id="recursos" className="relative py-20 bg-white dark:bg-tech-900 border-y border-transparent dark:border-tech-800 transition-colors duration-300 overflow-hidden">
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-[#dd9933]">{t.title}</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-6 rounded-xl bg-gray-50 dark:bg-tech-950 border-0 dark:border dark:border-tech-800 transition-colors shadow-sm hover:shadow-md dark:shadow-none bg-opacity-90 dark:bg-opacity-90 backdrop-blur-sm">
              <div className="mb-4 bg-gray-200 dark:bg-tech-800/50 w-16 h-16 rounded-full flex items-center justify-center">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#dd9933] mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};