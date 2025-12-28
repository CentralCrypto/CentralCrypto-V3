
import React, { useState, useEffect } from 'react';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { getConstants } from '../constants';
import { Language } from '../../../types';
import { getTranslations } from '../../../locales';

interface TestimonialsProps {
    currentLang: Language;
}

export const Testimonials: React.FC<TestimonialsProps> = ({ currentLang }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const { testimonials } = getConstants(currentLang);
  const t = getTranslations(currentLang).indicators.testimonials;

  const itemsPerPage = 3;
  const totalPages = Math.ceil(testimonials.length / itemsPerPage);

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => {
      const next = prevIndex + itemsPerPage;
      return next >= testimonials.length ? 0 : next;
    });
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => {
      const prev = prevIndex - itemsPerPage;
      return prev < 0 ? (totalPages - 1) * itemsPerPage : prev;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 8000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const visibleTestimonials = testimonials.slice(currentIndex, currentIndex + itemsPerPage);

  return (
    <section id="depoimentos" className="relative py-24 bg-gray-50 dark:bg-tech-950 transition-colors duration-300 overflow-hidden scroll-mt-[200px]">
      {/* Background Image requested by user */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.07] grayscale"
        style={{
            backgroundImage: `url('https://centralcrypto.com.br/2/wp-content/uploads/2025/09/2025-09-27_23-14-23.png')`,
            backgroundAttachment: 'fixed',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">{t.title}</h2>
            
            <div className="flex gap-2">
                <button 
                    onClick={prevSlide}
                    className="p-3 rounded-full bg-white dark:bg-tech-800 hover:bg-tech-accent hover:text-black text-gray-700 dark:text-white transition-all shadow-md active:scale-90"
                    aria-label="Anterior"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                    onClick={nextSlide}
                    className="p-3 rounded-full bg-white dark:bg-tech-800 hover:bg-tech-accent hover:text-black text-gray-700 dark:text-white transition-all shadow-md active:scale-90"
                    aria-label="Próximo"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {visibleTestimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-white dark:bg-[#16181a] p-8 rounded-2xl border border-gray-100 dark:border-slate-800 relative animate-in fade-in slide-in-from-right duration-500 h-full flex flex-col shadow-xl hover:shadow-2xl dark:shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)] transition-all transform hover:-translate-y-2">
              <Quote className="w-12 h-12 text-[#dd9933]/10 dark:text-[#dd9933]/5 absolute top-6 right-6" />
              
              <div className="flex-grow">
                <p className="text-gray-700 dark:text-slate-300 mb-8 relative z-10 italic font-medium leading-relaxed text-base">"{testimonial.content}"</p>
              </div>
              
              <div className="flex items-center mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
                <img 
                  src={testimonial.avatarUrl} 
                  alt={testimonial.name} 
                  className="w-14 h-14 rounded-full object-cover mr-4 border-2 border-tech-accent shadow-lg"
                />
                <div>
                  <h4 className="font-black text-gray-900 dark:text-white text-lg leading-tight">{testimonial.name}</h4>
                  <span className="text-[11px] font-black text-tech-accent uppercase tracking-[0.2em]">{testimonial.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center gap-3">
            {Array.from({ length: totalPages }).map((_, idx) => (
                <button 
                    key={idx}
                    onClick={() => setCurrentIndex(idx * itemsPerPage)}
                    className={`h-2.5 rounded-full transition-all duration-500 ${Math.floor(currentIndex / itemsPerPage) === idx ? 'bg-tech-accent w-10 shadow-[0_0_10px_rgba(221,153,51,0.5)]' : 'bg-gray-300 dark:bg-slate-800 w-2.5 hover:bg-gray-400 dark:hover:bg-slate-700'}`}
                    aria-label={`Ir para página ${idx + 1}`}
                />
            ))}
        </div>
      </div>
    </section>
  );
};
