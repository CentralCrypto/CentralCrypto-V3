
import React, { useEffect, useState, useRef } from 'react';
import { 
  Share2, 
  Instagram, 
  Youtube, 
  Send, 
  Search, 
  ChevronDown,
  X as CloseIcon, 
  Twitter, 
  LogIn,
  TikTok,
  Activity,
  BarChart3,
  Globe,
  Sun,
  Moon,
  User,
  Power,
  CreditCard,
  Lock,
  MessageCircle
} from './Icons';
import { ViewMode, Language } from '../types';
import { UserData } from '../services/auth';
import { getTranslations, LANGUAGES_CONFIG } from '../locales';

const TICKER_COINS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'SHIB', 'DOT', 
  'TRX', 'LINK', 'BCH', 'NEAR', 'UNI', 'LTC', 'ICP', 'APT', 'ETC',
  'FIL', 'HBAR', 'XLM', 'STX', 'IMX', 'ARB', 'VET', 'OP', 'INJ', 'GRT', 
  'RNDR', 'ATOM', 'TIA', 'RUNE', 'SEI', 'ALGO', 'FTM', 'FLOW', 'SAND', 'AAVE'
];

interface TickerData {
  p: string; 
  rawPrice: number; 
  c: number; 
  v: string; 
}

interface CoinMeta {
  name: string;
  supply: number;
}

const FALLBACK_META: Record<string, CoinMeta> = {
  BTC: { name: 'Bitcoin', supply: 19688000 },
  ETH: { name: 'Ethereum', supply: 120070000 },
  BNB: { name: 'BNB', supply: 147580000 },
  SOL: { name: 'Solana', supply: 443500000 },
};

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  symbol: string;
  data: TickerData;
  meta: CoinMeta;
}

interface TickerItemProps {
  symbol: string;
  data: TickerData;
  meta: CoinMeta;
  onHover: (e: React.MouseEvent, symbol: string, data: TickerData, meta: CoinMeta) => void;
  onLeave: () => void;
}

const TickerItem: React.FC<TickerItemProps> = ({ symbol, data, meta, onHover, onLeave }) => {
  const { p, c } = data;
  
  if (!p || p === '---' || p === '$0.00' || p === '0') return null;

  const safeChange = isNaN(c) ? 0.00 : c;
  const isPositive = safeChange >= 0;
  
  const iconUrl = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;

  return (
    <div 
      className="relative flex items-center h-full px-4 border-r border-transparent dark:border-tech-800/50 min-w-[200px] hover:bg-gray-100 dark:hover:bg-tech-800 transition-colors duration-200 cursor-pointer select-none shrink-0 group/item"
      onMouseEnter={(e) => onHover(e, symbol, data, meta)}
      onMouseLeave={onLeave}
    >
        <img 
          src={iconUrl} 
          alt={symbol}
          className="w-6 h-6 rounded-full shrink-0 mr-2"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="flex items-baseline gap-2 mr-auto">
            <span className="text-gray-900 dark:text-gray-200 font-bold text-sm tracking-tight">{symbol}</span>
            <span className="text-gray-700 dark:text-gray-300 font-mono text-sm font-semibold">{p}</span>
        </div>
        
        <div className="ml-3">
          <span className={`${isPositive ? 'text-tech-success' : 'text-tech-danger'} text-base font-mono font-bold whitespace-nowrap`}>
             {isPositive ? '▲' : '▼'}{Math.abs(safeChange).toFixed(2)}%
          </span>
        </div>
    </div>
  );
};

interface HeaderProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  user: UserData | null;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onSearch: (query: string) => void;
}

const Flag = ({ lang, className }: { lang: Language; className?: string }) => {
  const config = LANGUAGES_CONFIG.find(l => l.code === lang);
  return (
    <img src={config?.flag || "https://hatscripts.github.io/circle-flags/flags/br.svg"} alt={lang} className={`w-5 h-5 rounded-full object-cover shadow-sm ${className}`} />
  );
};

const Header: React.FC<HeaderProps> = ({ currentView, setView, theme, toggleTheme, user, language, onLanguageChange, onLoginClick, onLogoutClick, onSearch }) => {
  const t = getTranslations(language).header;
  const common = getTranslations(language).common;

  const [tickers, setTickers] = useState<Record<string, TickerData>>({});
  const [coinMeta, setCoinMeta] = useState<Record<string, CoinMeta>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const [tooltip, setTooltip] = useState<TooltipData>({ 
    visible: false, x: 0, y: 0, symbol: '', 
    data: { p: '', c: 0, v: '', rawPrice: 0 }, 
    meta: { name: '', supply: 0 } 
  });

  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [hoveredLang, setHoveredLang] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const langMenuRef = useRef<HTMLDivElement | null>(null);
  const langTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [toast, setToast] = useState<{
    visible: boolean;
    type: 'login' | 'logout';
    name: string;
    avatar?: string;
  }>({
    visible: false,
    type: 'login',
    name: '',
    avatar: undefined
  });

  const prevUserRef = useRef<UserData | null>(null);

  const closeTooltip = () => setTooltip(prev => ({ ...prev, visible: false }));

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim().length > 0) {
      onSearch(searchTerm.trim());
    }
  };

  useEffect(() => {
    window.addEventListener('click', closeTooltip);
    window.addEventListener('scroll', closeTooltip);
    return () => {
      window.removeEventListener('click', closeTooltip);
      window.removeEventListener('scroll', closeTooltip);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTickerHover = (e: React.MouseEvent, symbol: string, data: TickerData, meta: CoinMeta) => {
    e.stopPropagation(); 
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + (rect.width / 2),
      y: rect.bottom, 
      symbol,
      data,
      meta
    });
  };

  useEffect(() => {
    const previous = prevUserRef.current;

    if (user && !previous) {
      setToast({
        visible: true,
        type: 'login',
        name: user.user_display_name,
        avatar: user.avatar_url
      });
      setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3500);
    } else if (!user && previous) {
      setToast({
        visible: true,
        type: 'logout',
        name: previous.user_display_name,
        avatar: previous.avatar_url
      });
      setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3500);
    }

    prevUserRef.current = user;
  }, [user]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch('https://api.coincap.io/v2/assets?limit=100');
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const json = await response.json();
        const map: Record<string, CoinMeta> = {};
        if (json && json.data) {
          json.data.forEach((coin: any) => {
            map[coin.symbol] = { name: coin.name, supply: parseFloat(coin.supply) };
          });
          setCoinMeta(map);
        }
      } catch (error) {
        // silencioso
      }
    };
    fetchMetadata();
  }, []);
  
  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          const updates: Record<string, TickerData> = {};
          data.forEach((t: any) => {
            if (t.s.endsWith('USDT')) {
              const symbol = t.s.replace('USDT', '');
              if (TICKER_COINS.includes(symbol)) {
                 const close = parseFloat(t.c);
                 const open = parseFloat(t.o);
                 const volumeQuote = parseFloat(t.q);
                 let percent = open > 0 ? ((close - open) / open) * 100 : 0;
                 let volStr = '';
                 if (volumeQuote >= 1e9) volStr = `$${(volumeQuote/1e9).toFixed(2)}B`;
                 else if (volumeQuote >= 1e6) volStr = `$${(volumeQuote/1e6).toFixed(2)}M`;
                 else if (volumeQuote >= 1e3) volStr = `$${(volumeQuote/1e3).toFixed(0)}K`;
                 else volStr = `$${volumeQuote.toFixed(0)}`;
                 
                 updates[symbol] = {
                    p: close < 1 ? close.toFixed(4) : close.toLocaleString('en-US', { style: 'currency', currency: 'USD' }), 
                    rawPrice: close,
                    c: percent,
                    v: volStr
                 };
              }
            }
          });
          setTickers(prev => ({ ...prev, ...updates }));
        }
      } catch (e) { }
    };
    return () => ws.close();
  }, []);

  const getTickerData = (symbol: string): TickerData => {
    return tickers[symbol] || { p: '---', c: 0.00, v: '-', rawPrice: 0 };
  };

  const getMeta = (symbol: string): CoinMeta => {
     return coinMeta[symbol] || FALLBACK_META[symbol] || { name: symbol, supply: 0 };
  };

  const TickerList = React.memo(() => (
    <div className="flex items-center">
      {TICKER_COINS.map((symbol) => (
        <TickerItem 
          key={symbol} 
          symbol={symbol} 
          data={getTickerData(symbol)}
          meta={getMeta(symbol)}
          onHover={handleTickerHover}
          onLeave={closeTooltip}
        />
      ))}
    </div>
  ));

  const menuAnalysis = [
    { label: t.cockpit, mode: ViewMode.COCKPIT, img: 'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?auto=format&fit=crop&q=80&w=600' }, 
    { label: t.workspace, mode: ViewMode.WORKSPACE, img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600' }, 
    { label: t.indicators, mode: ViewMode.INDICATORS, img: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&q=80&w=600' }, 
    { label: t.marketCap, mode: ViewMode.MARKET, img: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=600' }, 
  ];

  const mktCap = tooltip.meta.supply && tooltip.data.rawPrice ? (tooltip.meta.supply * tooltip.data.rawPrice) : 0;
  const hasMktCap = mktCap > 0;

  const socialLinks = [
    { href: "https://x.com/TradersCentral", icon: <Twitter size={20} /> },
    { href: "https://www.instagram.com/centralcrypto72/", icon: <Instagram size={20} /> },
    { href: "https://www.youtube.com/@centralcryptotraders", icon: <Youtube size={20} /> },
    { href: "https://t.me/+80XjLzFScH0yMWQx", icon: <Send size={20} /> },
    { href: "https://www.tiktok.com/@centralcrypto323", icon: <TikTok size={20} /> },
  ];

  const handleLangEnter = () => {
    if (langTimeoutRef.current) clearTimeout(langTimeoutRef.current);
    setIsLangMenuOpen(true);
  };

  const handleLangLeave = () => {
    langTimeoutRef.current = setTimeout(() => {
        setIsLangMenuOpen(false);
        setHoveredLang(null);
    }, 500);
  };

  const getLanguageTooltipText = (langCode: string) => {
      switch(langCode) {
          case 'en': return "The original content of posts and news is in Portuguese.";
          case 'es': return "El contenido original de publicaciones y noticias está en portugués.";
          default: return "";
      }
  };

  return (
    <>
      <div 
        className={`fixed z-[1100] pointer-events-none transition-opacity duration-200 ${tooltip.visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ 
          top: `${tooltip.y}px`, 
          left: `${tooltip.x}px`,
          transform: 'translateX(-50%)' 
        }}
      >
         <div className="mt-2 w-64 bg-white dark:bg-tech-800 border border-gray-200 dark:border-tech-700 shadow-xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-lg p-4 transition-all duration-700">
              <div className="flex items-center gap-3 mb-3 border-b border-gray-200 dark:border-tech-700 pb-2">
                 <img 
                    src={`https://assets.coincap.io/assets/icons/${tooltip.symbol.toLowerCase()}@2x.png`} 
                    className="w-8 h-8 rounded-full" 
                    alt={tooltip.symbol}
                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                 />
                 <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-200">{tooltip.meta.name || tooltip.symbol}</div>
                 </div>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase flex items-center gap-1"><Activity size={10} /> Preço</span>
                    <span className="text-gray-900 dark:text-gray-200 font-bold font-mono">{tooltip.data.p}</span>
                 </div>
                 
                 {hasMktCap && (
                   <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase flex items-center gap-1"><Globe size={10} /> Mkt Cap</span>
                      <span className="text-tech-accent font-bold font-mono">
                        {mktCap >= 1e9 ? `$${(mktCap / 1e9).toFixed(2)}B` : mktCap >= 1e6 ? `$${(mktCap / 1e6).toFixed(2)}M` : `$${mktCap.toLocaleString()}`}
                      </span>
                   </div>
                 )}

                 <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase flex items-center gap-1"><BarChart3 size={10} /> Vol 24h</span>
                    <span className="text-gray-900 dark:text-gray-200 font-bold font-mono">{tooltip.data.v}</span>
                 </div>
                 <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-tech-700 mt-2">
                    <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">Variação 24h</span>
                    <span className={`font-bold font-mono ${tooltip.data.c >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>
                       {tooltip.data.c >= 0 ? '+' : ''}{Math.abs(tooltip.data.c).toFixed(2)}%
                    </span>
                 </div>
              </div>
         </div>
      </div>

      {toast.visible && (
        <div className="fixed top-6 right-6 z-[200]">
          <div className="flex items-center gap-3 bg-white dark:bg-tech-900 border border-gray-200 dark:border-tech-700 rounded-xl px-4 py-3 shadow-2xl min-w-[260px]">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-tech-950 border border-tech-accent flex items-center justify-center overflow-hidden">
              {toast.avatar ? (
                <img src={toast.avatar} alt={toast.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-tech-accent font-bold text-sm">
                  {toast.name ? toast.name.substring(0, 2).toUpperCase() : 'US'}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {toast.type === 'login'
                  ? `${t.welcome} ${toast.name}!`
                  : `Bye, ${toast.name}!`}
              </span>
            </div>
          </div>
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-[1000] w-full flex flex-col shadow-lg transition-all duration-700">
        
        <div 
          className="bg-white dark:bg-tech-950 border-b border-transparent dark:border-tech-800 h-14 flex items-center overflow-hidden w-full relative group transition-colors duration-700 shadow-sm"
        >
          <div className="animate-scroll flex items-center w-max will-change-transform">
             <TickerList />
             <TickerList />
          </div>
          
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-tech-950 to-transparent z-10 pointer-events-none transition-colors duration-700"></div>
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-tech-950 to-transparent z-10 pointer-events-none transition-colors duration-700"></div>
        </div>

        <div className="bg-[#f3f4f6] dark:bg-tech-900 relative z-20 transition-colors duration-700">
          <div className="container mx-auto px-4 h-24 flex items-center justify-between relative">
            
            <div className="flex items-center z-30 min-max">
              <div 
                className="flex items-center cursor-pointer mr-4 group" 
                onClick={() => setView(ViewMode.DASHBOARD)}
              >
                <img 
                  src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" 
                  alt="Central Crypto" 
                  className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(221,153,51,0.2)]"
                />
                <div className="flex flex-col leading-tight ml-3">
                   <span className="text-gray-900 dark:text-gray-200 font-bold text-lg tracking-tight uppercase transition-colors duration-700">Central</span>
                   <span className="text-tech-accent font-bold text-lg tracking-tight uppercase -mt-1.5 transition-colors duration-700">CryptoTraders</span>
                </div>
              </div>

              <div className="h-10 w-px bg-gray-300 dark:bg-tech-800 mx-2 hidden md:block transition-colors duration-700"></div>

              <div className="relative group ml-16 z-50 hidden md:block w-12 h-12"> 
                 <div className="fan-bridge"></div>
                 <div className="absolute left-1/2 top-1/2 -translate-x-1/2 w-[240px] h-[120px] rounded-b-full bg-white/20 dark:bg-black/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500 z-0"></div>
                 
                 <button className="w-12 h-12 bg-white dark:bg-tech-800 rounded-full flex items-center justify-center text-tech-accent hover:text-black dark:hover:text-white hover:bg-yellow-400 dark:hover:bg-tech-700 transition-all duration-300 z-20 relative shadow-lg">
                    <Share2 size={24} />
                 </button>
                 
                 <div className="absolute top-0 left-0 w-12 h-12 flex items-center justify-center z-10">
                    {socialLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fan-item bg-white dark:bg-tech-900 text-tech-accent hover:bg-yellow-400 dark:hover:bg-[#2f3032] hover:text-black dark:hover:text-white flex items-center justify-center shadow-xl w-12 h-12 rounded-full hover:scale-110 transition-all duration-300"
                      >
                        {link.icon}
                      </a>
                    ))}
                 </div>
              </div>
            </div>

            <nav className="hidden xl:flex items-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-full">
              <div className="relative group h-full flex items-center px-6 cursor-pointer">
                  <div onClick={() => setView(ViewMode.DASHBOARD)} className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-gray-300 hover:text-tech-accent transition-colors duration-700 tracking-wider">
                    <span className="bg-tech-accent w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span> 
                    {t.analysisCenter}
                    <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300" />
                  </div>
                  <div className="absolute top-[80%] left-1/2 -translate-x-1/2 w-[650px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 z-50 pt-4">
                    <div className="relative rounded-lg overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-tech-700 bg-white dark:bg-tech-950 p-4 transition-colors duration-700">
                      <div className="grid grid-cols-2 gap-4">
                        {menuAnalysis.map((item, idx) => (
                          <div key={idx} onClick={() => setView(item.mode)} className="relative h-28 rounded-lg border border-gray-100 dark:border-tech-800 hover:border-tech-accent overflow-hidden cursor-pointer group/box transition-all duration-700 shadow-lg bg-white dark:bg-black">
                            
                            <div className="absolute inset-0 transition-all duration-700 grayscale group-hover/box:grayscale-0 opacity-10 group-hover/box:opacity-40 dark:opacity-30 dark:group-hover/box:opacity-50">
                              <img src={item.img} className="w-full h-full object-cover group-hover/box:scale-105 transition-transform duration-1000" alt=""/>
                            </div>
                            
                            <div className="absolute inset-0 bg-transparent group-hover/box:bg-black/40 dark:bg-black/50 transition-all duration-700"></div>
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="font-black uppercase text-lg tracking-widest drop-shadow-sm text-gray-800 dark:text-white group-hover/box:text-white dark:group-hover/box:text-[#dd9933] group-hover/box:scale-110 transition-all duration-500">
                                {item.label}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
              </div>
              <div 
                onClick={() => setView(ViewMode.ACADEMY)}
                className="relative group h-full flex items-center px-6 cursor-pointer"
              >
                  <div className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-gray-300 hover:text-tech-accent transition-colors duration-700 tracking-wider">
                    <span className="bg-tech-accent w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span> 
                    {t.academy}
                  </div>
              </div>
            </nav>

            <div className="flex items-center gap-4 z-30">
               <div className="hidden lg:flex items-center rounded-lg px-3 py-1.5 transition-all duration-700 bg-gray-100 dark:bg-tech-800 dark:border dark:border-tech-700 border border-transparent shadow-sm dark:shadow-inner focus-within:ring-1 focus-within:ring-tech-accent dark:focus-within:border-tech-accent">
                 <input 
                    type="text" 
                    placeholder={common.search.toUpperCase()}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="bg-transparent border-none outline-none text-sm w-24 focus:w-32 transition-all font-mono uppercase text-gray-800 dark:text-gray-400 placeholder-gray-500 dark:placeholder-gray-600" 
                 />
                 <Search size={16} className="text-gray-500 ml-2 cursor-pointer hover:text-tech-accent transition-colors" onClick={() => onSearch(searchTerm)} />
               </div>
               
               <div className="relative" onMouseEnter={handleLangEnter} onMouseLeave={handleLangLeave} ref={langMenuRef}>
                  <button 
                    className="bg-white hover:bg-gray-100 dark:bg-tech-800 dark:hover:bg-tech-700 p-2 rounded-full transition-colors duration-700 border border-transparent dark:border-tech-700 shadow-sm flex items-center gap-2"
                    aria-label="Selecionar Idioma"
                  >
                      <Flag lang={language} />
                  </button>
                  <div className={`absolute top-full right-0 mt-2 w-36 transition-all duration-300 origin-top-right transform ${isLangMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}>
                      <div className="bg-white dark:bg-tech-900 border border-gray-200 dark:border-tech-700 rounded-xl shadow-xl relative">
                          <div className="flex flex-col py-1 overflow-hidden rounded-xl">
                              {LANGUAGES_CONFIG.map((config) => (
                                  <button 
                                    key={config.code} 
                                    onClick={() => { onLanguageChange(config.code); setIsLangMenuOpen(false); }} 
                                    className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-tech-800 transition-colors ${language === config.code ? 'bg-gray-100 dark:bg-tech-800 font-bold text-tech-accent' : 'text-gray-700 dark:text-gray-300'}`}
                                    onMouseEnter={() => setHoveredLang(config.code)}
                                    onMouseLeave={() => setHoveredLang(null)}
                                  >
                                      <img src={config.flag} className="w-5 h-5 rounded-full object-cover shadow-sm"/>
                                      <span className="uppercase font-bold">{config.code}</span>
                                  </button>
                              ))}
                          </div>
                          
                          {hoveredLang && hoveredLang !== 'pt' && (
                              <div className="absolute top-0 right-full mr-2 w-48 p-3 rounded-xl bg-tech-900/95 border border-[#dd9933]/50 shadow-xl shadow-[#dd9933]/10 text-white text-xs backdrop-blur-md animate-in slide-in-from-right-2 fade-in z-[200]">
                                  <div className="absolute top-4 -right-1.5 w-3 h-3 bg-tech-900 border-t border-r border-[#dd9933]/50 rotate-45"></div>
                                  <div className="relative z-10 flex flex-col gap-1">
                                      <p className="leading-snug text-gray-300 italic">
                                          "{getLanguageTooltipText(hoveredLang)}"
                                      </p>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
               </div>

               <button 
                  onClick={toggleTheme} 
                  className="bg-white hover:bg-gray-100 dark:bg-tech-800 dark:hover:bg-tech-700 text-tech-accent p-2 rounded-full transition-colors duration-700 border border-transparent dark:border-tech-700 shadow-sm"
                  aria-label="Alternar Tema"
               >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
               </button>

               <div className="flex items-center gap-2 border-l border-gray-300 dark:border-tech-800 pl-4 transition-colors duration-700">
                  {user ? (
                    <div className="relative" ref={userMenuRef}>
                         <button 
                            onClick={() => setUserMenuOpen(!isUserMenuOpen)} 
                            className="flex items-center gap-3 bg-white dark:bg-tech-800 border border-transparent dark:border-tech-700 rounded-full pl-1 pr-4 py-1 transition-all group shadow-sm hover:shadow-md"
                         >
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-tech-950 flex items-center justify-center overflow-hidden border border-tech-accent shadow-md">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-tech-accent font-bold text-sm">
                                        {user.user_display_name ? user.user_display_name.substring(0,2).toUpperCase() : 'US'}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-none">{t.welcome}</span>
                                <span className="text-xs text-gray-900 dark:text-gray-200 font-bold leading-none max-w-[80px] truncate hover:text-tech-accent dark:hover:text-white">{user.user_display_name}</span>
                            </div>
                            <ChevronDown size={12} className={`text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                         </button>

                         {isUserMenuOpen && (
                             <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-tech-900 border border-gray-200 dark:border-tech-700 rounded-xl shadow-2xl overflow-hidden z-50">
                                 <div className="p-4 border-b border-gray-200 dark:border-tech-800 bg-gray-50 dark:bg-tech-950/50 flex items-center gap-3">
                                     <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-tech-950 flex items-center justify-center overflow-hidden border border-tech-accent">
                                        {user.avatar_url ? (
                                          <img src={user.avatar_url} alt={user.user_display_name} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-tech-accent font-bold text-xs">
                                            {user.user_display_name ? user.user_display_name.substring(0,2).toUpperCase() : 'US'}
                                          </span>
                                        )}
                                     </div>
                                     <div className="flex flex-col">
                                       <p className="text-gray-900 dark:text-white font-bold text-sm truncate">{user.user_display_name}</p>
                                       <p className="text-gray-500 text-xs truncate">{user.user_email}</p>
                                     </div>
                                 </div>
                                 <div className="p-2">
                                     <button onClick={() => { setView(ViewMode.PROFILE); setUserMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800 hover:text-tech-accent rounded-lg transition-colors">
                                         <User size={16} /> {t.profile}
                                     </button>
                                     <button onClick={() => { setView(ViewMode.PROFILE); setUserMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800 hover:text-tech-accent rounded-lg transition-colors">
                                         <CreditCard size={16} /> {t.subscription}
                                     </button>
                                     <button onClick={() => { setView(ViewMode.PROFILE); setUserMenuOpen(false); }} className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800 hover:text-tech-accent rounded-lg transition-colors">
                                         <Lock size={16} /> {t.security}
                                     </button>
                                 </div>
                                 <div className="p-2 border-t border-gray-200 dark:border-tech-800">
                                     <button
                                       onClick={() => {
                                         setUserMenuOpen(false);
                                         onLogoutClick();
                                       }}
                                       className="w-full text-left flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 hover:text-red-600 rounded-lg transition-colors uppercase tracking-wide"
                                     >
                                         <Power size={14} /> {t.logout}
                                     </button>
                                 </div>
                             </div>
                         )}
                    </div>
                  ) : (
                    <>
                    <button
                      onClick={onLoginClick}
                      className="
                        flex items-center gap-2 
                        text-sm font-bold 
                        text-gray-800 dark:text-gray-300 
                        hover:text-tech-500 dark:hover:text-white
                        px-3 py-2 rounded 
                        transition-colors
                        dark:hover:bg-transparent
                        hover:text-[#dd9933] light-mode:hover:text-[#dd9933]
                      "
                    >
                      <LogIn size={14} className="text-tech-accent" /> {t.login}
                    </button>
                    </>
                  )}
               </div>
            </div>

          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
