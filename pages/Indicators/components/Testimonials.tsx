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
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const visibleTestimonials = testimonials.slice(currentIndex, currentIndex + itemsPerPage);

  return (
    <section id="depoimentos" className="py-20 bg-gray-50 dark:bg-tech-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t.title}</h2>
            
            <div className="flex gap-2">
                <button 
                    onClick={prevSlide}
                    className="p-2 rounded-full bg-gray-200 dark:bg-tech-800 hover:bg-gray-300 dark:hover:bg-tech-700 text-gray-700 dark:text-white transition-colors"
                    aria-label="Anterior"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                    onClick={nextSlide}
                    className="p-2 rounded-full bg-gray-200 dark:bg-tech-800 hover:bg-gray-300 dark:hover:bg-tech-700 text-gray-700 dark:text-white transition-colors"
                    aria-label="Próximo"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {visibleTestimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-white dark:bg-tech-900 p-8 rounded-xl border-0 dark:border dark:border-tech-800 relative animate-fade-in h-full flex flex-col shadow-sm hover:shadow-md dark:shadow-none transition-colors duration-300">
              <Quote className="w-10 h-10 text-gray-300 dark:text-gray-700 absolute top-6 right-6" />
              
              <div className="flex-grow">
                <p className="text-gray-700 dark:text-gray-300 mb-6 relative z-10 italic">"{testimonial.content}"</p>
              </div>
              
              <div className="flex items-center mt-4 pt-4 border-t border-gray-200 dark:border-tech-800/50">
                <img 
                  src={testimonial.avatarUrl} 
                  alt={testimonial.name} 
                  className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-tech-accent"
                />
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">{testimonial.name}</h4>
                  <span className="text-xs text-gray-500 uppercase">{testimonial.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, idx) => (
                <button 
                    key={idx}
                    onClick={() => setCurrentIndex(idx * itemsPerPage)}
                    className={`h-2 rounded-full transition-all duration-300 ${Math.floor(currentIndex / itemsPerPage) === idx ? 'bg-tech-accent w-8' : 'bg-gray-300 dark:bg-tech-700 w-2 hover:bg-gray-400 dark:hover:bg-tech-600'}`}
                    aria-label={`Ir para página ${idx + 1}`}
                />
            ))}
        </div>
      </div>
    </section>
  );
};