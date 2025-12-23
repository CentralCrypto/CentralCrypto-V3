import React from 'react';

const Magazine: React.FC = () => {
  return (
    // Header is fixed approx 152px. So we subtract that from 100vh to fit screen without scrolling parent
    <div className="w-full h-[calc(100vh-152px)] overflow-hidden bg-white">
       <iframe 
         src="https://centralcrypto.com.br/2/magazine" 
         className="w-full h-full border-none block"
         title="Central Crypto Magazine"
         loading="lazy"
       />
    </div>
  );
};

export default Magazine;