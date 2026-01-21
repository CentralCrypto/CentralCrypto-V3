
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  Spotify,
  Activity,
  BarChart3,
  Globe,
  Sun,
  Moon,
  User,
  Power,
  CreditCard,
  Lock,
  MessageCircle,
  Menu
} from './Icons';
import { ViewMode, Language } from '../types';
import { UserData } from '../services/auth';
import { getTranslations, LANGUAGES_CONFIG } from '../locales';
import { fetchTopCoins } from '../pages/Workspace/services/api';
import { useBinanceWS } from '../services/BinanceWebSocketContext';

const TICKER_COINS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'SHIB', 'DOT', 
  'TRX', 'LINK', 'BCH', 'NEAR', 'UNI', 'LTC', 'ICP', 'APT', 'ETC',
  'FIL', 'HBAR', 'XLM', 'STX', 'IMX', 'ARB', 'VET', 'OP', 'INJ', 'GRT', 
  'RNDR', 'ATOM', 'TIA', 'RUNE', 'SEI', 'ALGO', 'FTM', 'FLOW', 'SAND', 'AAVE'
];

interface DisplayTickerData { p: string; rawPrice: number; c: number; v: string; }
interface CoinMeta { name: string; mcap: number; rank: number; }
interface TooltipData { visible: boolean; x: number; y: number; symbol: string; data: DisplayTickerData | null; meta: CoinMeta | null; }

// Cores de flash padronizadas com o MarketCapTable
const FLASH_GREEN_BG = '#122A21';
const FLASH_RED_BG = '#C33B4080';

const formatUSD = (val: number) => {
    if (!val) return "---";
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

const TickerItem: React.FC<{ symbol: string; data: DisplayTickerData; meta: CoinMeta; onHover: any; onLeave: any; }> = React.memo(({ symbol, data, meta, onHover, onLeave }) => {
  const { p, c, rawPrice } = data;
  const [flashBg, setFlashBg] = useState('transparent');
  const prevPriceRef = useRef(rawPrice);

  useEffect(() => {
    // Se o preço mudou, aplica o flash
    if (rawPrice !== prevPriceRef.current) {
        if (rawPrice > prevPriceRef.current) {
            setFlashBg(FLASH_GREEN_BG);
        } else if (rawPrice < prevPriceRef.current) {
            setFlashBg(FLASH_RED_BG);
        }
        
        prevPriceRef.current = rawPrice;

        const timer = setTimeout(() => setFlashBg('transparent'), 350);
        return () => clearTimeout(timer);
    }
  }, [rawPrice]);

  if (!p || p === '---' || p === '$0.00' || p === '0') return null;
  const isPositive = c >= 0;
  
  const iconUrl = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
  
  return (
    <div 
      className={`relative flex items-center h-full px-4 border-r border-transparent dark:border-tech-800/30 min-w-[200px] hover:bg-gray-100/50 dark:hover:bg-tech-800/40 transition-colors duration-300 cursor-pointer select-none shrink-0 group/item`} 
      onMouseEnter={(e) => onHover(e, symbol, data, meta)} 
      onMouseMove={(e) => onHover(e, symbol, data, meta)}
    >
        <img src={iconUrl} alt={symbol} className="w-6 h-6 rounded-full shrink-0 mr-2 shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="flex items-baseline gap-2 mr-auto">
            <span className="text-gray-900 dark:text-gray-200 font-bold text-sm tracking-tight">{symbol}</span>
            <span className="text-gray-700 dark:text-gray-300 font-mono text-sm font-semibold">{p}</span>
        </div>
        <div className="ml-3">
            <span 
                className={`${isPositive ? 'text-tech-success' : 'text-tech-danger'} text-base font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded transition-colors duration-200`}
                style={{ backgroundColor: flashBg }}
            >
                {isPositive ? '▲' : '▼'}{Math.abs(c).toFixed(2)}%
            </span>
        </div>
    </div>
  );
});

// Componente separado para evitar remounts no Header
const TickerList: React.FC<{ 
    tickers: Record<string, any>, 
    coinMeta: Record<string, CoinMeta>, 
    onHover: any, 
    onLeave: any 
}> = React.memo(({ tickers, coinMeta, onHover, onLeave }) => {
    return (
        <div className="flex items-center">
            {TICKER_COINS.map(s => {
                const binanceSymbol = `${s}USDT`;
                const liveData = tickers[binanceSymbol];
                
                let displayData: DisplayTickerData = { p: '---', c: 0, v: '-', rawPrice: 0 };
                
                if (liveData) {
                    const close = parseFloat(liveData.c);
                    const open = parseFloat(liveData.o);
                    const changePct = open > 0 ? ((close - open) / open) * 100 : 0;
                    const vol = parseFloat(liveData.q);

                    displayData = {
                        p: close < 1 ? close.toFixed(4) : close.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
                        rawPrice: close,
                        c: changePct,
                        v: '$' + (vol / 1e6).toFixed(1) + 'M'
                    };
                }

                return (
                    <TickerItem 
                      key={s} 
                      symbol={s} 
                      data={displayData} 
                      meta={coinMeta[s] || { name: s, mcap: 0, rank: 0 }} 
                      onHover={onHover} 
                      onLeave={onLeave} 
                    />
                );
            })}
        </div>
    );
});

const Flag: React.FC<{ lang: Language }> = ({ lang }) => {
  const config = LANGUAGES_CONFIG.find(c => c.code === lang);
  if (!config) return null;
  return <img src={config.flag} className="w-5 h-5 rounded-full object-cover shadow-sm" alt={lang} />;
};

const Header: React.FC<{ currentView: ViewMode; setView: (v: ViewMode) => void; theme: 'dark' | 'light'; toggleTheme: () => void; user: UserData | null; language: Language; onLanguageChange: (lang: Language) => void; onLoginClick: () => void; onLogoutClick: () => void; onSearch: (q: string) => void; }> = ({ currentView, setView, theme, toggleTheme, user, language, onLanguageChange, onLoginClick, onLogoutClick, onSearch }) => {
  const t = getTranslations(language).header;
  const common = getTranslations(language).common;

  // Use Global WebSocket Context
  const { tickers: globalTickers } = useBinanceWS();

  const [coinMeta, setCoinMeta] = useState<Record<string, CoinMeta>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  
  const [tooltip, setTooltip] = useState<TooltipData>({ 
    visible: false, x: 0, y: 0, symbol: '', 
    data: null, 
    meta: null 
  });

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchTopCoins().then(coins => {
      if (coins && coins.length > 0) {
        const meta: Record<string, CoinMeta> = {};
        coins.forEach(c => {
          if (c.symbol) {
            meta[c.symbol.toUpperCase()] = {
              name: c.name || c.symbol,
              mcap: c.market_cap || 0,
              rank: c.market_cap_rank || 0
            };
          }
        });
        setCoinMeta(meta);
      }
    });
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) { onSearch(searchTerm.trim()); setIsMenuOpen(false); }
  };

  const handleTickerHover = useCallback((e: React.MouseEvent, symbol: string, data: DisplayTickerData, meta: CoinMeta) => {
    setTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY + 20, 
        symbol,
        data,
        meta: meta || { name: symbol, mcap: 0, rank: 0 }
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip({ visible: false, x: 0, y: 0, symbol: '', data: null, meta: null }), []);

  const menuAnalysis = [
    { label: t.cockpit, mode: ViewMode.COCKPIT, img: 'https://images.unsplash.com/photo-1640340434855-6084b1f4901c?auto=format&fit=crop&q=80&w=600' }, 
    { label: t.workspace, mode: ViewMode.WORKSPACE, img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600' }, 
    { label: t.indicators, mode: ViewMode.INDICATORS, img: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&q=80&w=600' }, 
    { label: t.marketCap, mode: ViewMode.MARKET, img: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=600' }, 
  ];

  const socialLinks = [
    { href: "https://x.com/TradersCentral", icon: <Twitter size={18} /> },
    { href: "https://www.instagram.com/centralcrypto72/", icon: <Instagram size={18} /> },
    { href: "https://www.youtube.com/@centralcryptotraders", icon: <Youtube size={18} /> },
    { href: "https://t.me/+80XjLzFScH0yMWQx", icon: <Send size={18} /> },
    { href: "https://www.tiktok.com/@centralcrypto323", icon: <TikTok size={18} /> },
    { href: "https://open.spotify.com/show/1FurXwMBQIJOBKEBXDUiGb", icon: <Spotify size={18} /> },
  ];

  return (
    <>
      {/* TOOLTIP */}
      {tooltip.visible && tooltip.data && (
        <div 
            className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-150" 
            style={{ 
                top: `${tooltip.y}px`, 
                left: `${Math.min(window.innerWidth - 270, Math.max(10, tooltip.x - 128))}px` 
            }}
        >
            <div className="w-68 bg-white dark:bg-[#1e2022] backdrop-blur-xl border border-gray-100 dark:border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-2xl p-5 overflow-hidden">
                <div className="flex items-center gap-4 mb-4 border-b border-gray-100 dark:border-white/5 pb-4">
                    <div className="relative">
                        <img src={`https://assets.coincap.io/assets/icons/${tooltip.symbol.toLowerCase()}@2x.png`} className="w-12 h-12 rounded-full bg-white p-1 shadow-md" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div className="flex flex-col">
                        <div className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{tooltip.meta?.name || tooltip.symbol}</div>
                        <div className="text-xs font-black text-[#dd9933] uppercase mt-1 tracking-widest">
                           #{tooltip.meta?.rank || '?'} {tooltip.symbol}/USDT
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <div className="flex flex-col">
                        <span className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mb-0.5">Price</span>
                        <span className="font-bold font-mono text-sm text-gray-900 dark:text-white">{tooltip.data.p}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mb-0.5">24h Change</span>
                        <span className={`font-bold font-mono text-sm ${tooltip.data.c >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>
                            {tooltip.data.c >= 0 ? '+' : ''}{tooltip.data.c.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mb-0.5">Market Cap</span>
                        <span className="font-bold font-mono text-sm text-blue-600 dark:text-blue-400/80">{formatUSD(tooltip.meta?.mcap || 0)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-gray-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest mb-0.5">Daily Volume</span>
                        <span className="font-bold font-mono text-sm text-[#dd9933]/80">{tooltip.data.v}</span>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MOBILE DRAWER */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[2000] xl:hidden flex">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsMenuOpen(false)}></div>
           <div className="relative w-80 max-w-[85%] bg-white dark:bg-tech-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ml-auto border-l border-gray-200 dark:border-tech-800">
               <div className="p-4 border-b border-gray-200 dark:border-tech-800 flex justify-between items-center bg-gray-50 dark:bg-tech-950/30">
                  {user ? (
                      <div onClick={() => { setView(ViewMode.PROFILE); setIsMenuOpen(false); }} className="flex items-center gap-3 cursor-pointer">
                         <div className="w-9 h-9 rounded-full border-2 border-[#dd9933] overflow-hidden shadow-sm"><img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.user_display_name}`} className="w-full h-full object-cover" /></div>
                         <div className="flex flex-col"><span className="text-xs font-black text-gray-900 dark:text-white leading-tight truncate max-w-[120px]">{user.user_display_name}</span><span className="text-[8px] text-[#dd9933] uppercase font-black tracking-widest">{t.profile}</span></div>
                      </div>
                  ) : (
                      <button onClick={() => { onLoginClick(); setIsMenuOpen(false); }} className="px-3 py-1.5 bg-[#dd9933] text-black font-black uppercase tracking-widest text-[9px] rounded-lg shadow-md flex items-center gap-1.5 active:scale-95 transition-transform"><LogIn size={14}/> {t.login}</button>
                  )}
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 text-gray-500 hover:text-black dark:hover:text-white"><CloseIcon size={22}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div className="space-y-4">
                     <button onClick={() => { setView(ViewMode.DASHBOARD); setIsMenuOpen(false); }} className="w-full text-left text-2xl font-black text-gray-800 dark:text-gray-200 hover:text-[#dd9933] flex items-center gap-3 transition-colors"><Globe size={24}/> Home</button>
                     <div className="space-y-2">
                        <button onClick={() => setAnalysisExpanded(!analysisExpanded)} className="w-full text-left text-2xl font-black text-gray-800 dark:text-gray-200 flex justify-between items-center group">
                           <div className="flex items-center gap-3"><Activity size={24}/> {t.analysisCenter}</div>
                           <ChevronDown size={22} className={`transition-transform duration-300 ${analysisExpanded ? 'rotate-180 text-tech-accent' : ''}`} />
                        </button>
                        {analysisExpanded && (
                           <div className="grid grid-cols-1 gap-2 pl-9 animate-in slide-in-from-top-2">
                              {menuAnalysis.map(item => (
                                 <button key={item.mode} onClick={() => { setView(item.mode); setIsMenuOpen(false); }} className="w-full text-left py-2 text-gray-500 hover:text-[#dd9933] font-black text-xs uppercase tracking-[0.2em] transition-colors">{item.label}</button>
                              ))}
                           </div>
                        )}
                     </div>
                     <button onClick={() => { setView(ViewMode.ACADEMY); setIsMenuOpen(false); }} className="w-full text-left text-2xl font-black text-gray-800 dark:text-gray-200 hover:text-[#dd9933] flex items-center gap-3 transition-colors"><BarChart3 size={24}/> {t.academy}</button>
                  </div>
               </div>
           </div>
        </div>
      )}

      {/* DESKTOP HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[1000] w-full flex flex-col shadow-lg transition-all duration-700">
        <div className="bg-white dark:bg-tech-950 border-b border-transparent dark:border-white/5 h-14 flex items-center overflow-hidden w-full relative transition-colors duration-700 shadow-sm" onMouseLeave={hideTooltip}>
          <div className="animate-scroll flex items-center w-max will-change-transform">
              <TickerList tickers={globalTickers} coinMeta={coinMeta} onHover={handleTickerHover} onLeave={hideTooltip} />
              <TickerList tickers={globalTickers} coinMeta={coinMeta} onHover={handleTickerHover} onLeave={hideTooltip} />
          </div>
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-tech-950 to-transparent z-10 pointer-events-none"></div>
        </div>

        <div className="bg-[#f3f4f6] dark:bg-tech-900 relative z-20 transition-colors duration-700 h-24" onMouseEnter={hideTooltip}>
          <div className="max-w-[90%] mx-auto px-4 h-full flex items-center justify-between relative">
            <div className="flex items-center z-30 md:absolute md:left-1/2 md:-translate-x-1/2 xl:relative xl:left-0 xl:translate-x-0">
              <div className="flex items-center cursor-pointer group" onClick={() => setView(ViewMode.DASHBOARD)}>
                <img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="Central Crypto" className="h-14 md:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(221,153,51,0.2)]" />
                <div className="flex flex-col leading-tight ml-3">
                   <span className="text-gray-900 dark:text-gray-200 font-black text-lg md:text-xl tracking-tighter uppercase">Central</span>
                   <span className="text-tech-accent font-black text-lg md:text-xl tracking-tighter uppercase -mt-1.5">CryptoTraders</span>
                </div>
              </div>
              <div className="hidden xl:flex items-center ml-8 gap-4">
                  <div className="h-12 w-px bg-gray-300 dark:bg-tech-800 mx-2"></div>
                  {/* FAN MENU */}
                  <div className="relative group z-50 w-12 h-12 flex items-center justify-center">
                     <div className="fan-bridge"></div>
                     <button className="w-11 h-11 bg-white dark:bg-tech-800 rounded-full flex items-center justify-center text-tech-accent hover:bg-yellow-400 dark:hover:bg-tech-700 transition-all duration-300 z-20 relative shadow-lg">
                        <Share2 size={22} />
                     </button>
                     {socialLinks.map((link, index) => (
                        <a key={index} href={link.href} target="_blank" rel="noopener noreferrer" className="fan-item bg-white dark:bg-tech-900 text-tech-accent hover:bg-yellow-400 dark:hover:bg-[#2f3032] flex items-center justify-center shadow-xl w-10 h-10 rounded-full hover:scale-110 border border-transparent dark:border-tech-700/50">
                           {link.icon}
                        </a>
                     ))}
                  </div>
              </div>
            </div>
            <div className="xl:hidden flex items-center z-40">
                <button onClick={() => setIsMenuOpen(true)} className="p-3.5 bg-white dark:bg-tech-800 rounded-2xl text-tech-accent shadow-xl border border-gray-200 dark:border-tech-700 active:scale-90 transition-transform"><Menu size={26} /></button>
            </div>
            <nav className="hidden xl:flex items-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-full z-10">
              <div className="relative group h-full flex items-center px-6 cursor-pointer">
                  <div onClick={() => setView(ViewMode.DASHBOARD)} className="flex items-center gap-2 text-xl font-black text-gray-800 dark:text-gray-300 hover:text-tech-accent transition-all tracking-widest uppercase">
                    {t.analysisCenter} <ChevronDown size={14} className="group-hover:rotate-180 transition-transform duration-300" />
                  </div>
                  <div className="absolute top-[80%] left-1/2 -translate-x-1/2 w-[600px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 z-50 pt-4">
                    <div className="relative rounded-2xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-white/5 bg-white dark:bg-[#1a1c1e] p-6">
                      <div className="grid grid-cols-2 gap-4">
                        {menuAnalysis.map((item, idx) => (
                          <div key={idx} onClick={() => setView(item.mode)} className="relative h-28 rounded-xl border border-gray-100 dark:border-tech-800 hover:border-tech-accent overflow-hidden cursor-pointer group/box transition-all bg-white dark:bg-black shadow-md">
                            <div className="absolute inset-0 grayscale group-hover/box:grayscale-0 opacity-20 group-hover/box:opacity-60 transition-all"><img src={item.img} className="w-full h-full object-cover group-hover/box:scale-105 transition-transform duration-1000" /></div>
                            <div className="absolute inset-0 flex items-center justify-center"><div className="font-black uppercase text-lg tracking-widest text-gray-900 dark:text-white group-hover/box:text-[#dd9933] transition-colors">{item.label}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
              </div>
              <div onClick={() => setView(ViewMode.ACADEMY)} className="relative group h-full flex items-center px-6 cursor-pointer transition-all hover:scale-105"><div className="text-xl font-black text-gray-800 dark:text-gray-300 hover:text-tech-accent transition-all tracking-widest uppercase">{t.academy}</div></div>
            </nav>
            <div className="hidden xl:flex items-center gap-5 z-30">
               <div className="group/search flex items-center bg-gray-200/50 dark:bg-tech-800/80 border border-transparent dark:border-tech-700 rounded-full px-3 py-2 transition-all duration-500 shadow-inner hover:ring-2 hover:ring-[#dd9933]/20">
                 <input type="text" placeholder={common.search.toUpperCase()} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchKeyDown} className="bg-transparent border-none outline-none text-sm w-0 opacity-0 group-hover/search:w-48 group-hover/search:opacity-100 group-hover/search:ml-2 focus:w-48 focus:opacity-100 focus:ml-2 transition-all duration-500 font-mono font-bold uppercase text-gray-800 dark:text-gray-200 order-1" />
                 <Search size={18} className="text-[#dd9933] cursor-pointer group-hover/search:scale-110 transition-transform order-2" onClick={() => onSearch(searchTerm)} />
               </div>
                <div className="relative" ref={langMenuRef}>
                    <button 
                        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                        className="flex items-center gap-2 bg-white dark:bg-tech-800 p-2.5 rounded-full border border-transparent dark:border-tech-700 shadow-md hover:scale-110 transition-transform"
                    >
                        <Flag lang={language} />
                        <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isLangMenuOpen && (
                        <div className="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 p-2">
                        {LANGUAGES_CONFIG.map((lang) => (
                            <div key={lang.code} className="relative group/langitem">
                            <button
                                onClick={() => {
                                onLanguageChange(lang.code);
                                setIsLangMenuOpen(false);
                                }}
                                className="w-full text-left flex items-center gap-4 px-4 py-3 text-xs font-black text-gray-700 dark:text-gray-300 hover:bg-[#dd9933]/10 hover:text-[#dd9933] rounded-xl transition-all uppercase tracking-[0.15em]"
                            >
                                <Flag lang={lang.code} />
                                <span>{lang.label}</span>
                            </button>
                            {(lang.code === 'en' || lang.code === 'es') && (
                                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-[10px] font-bold rounded-lg py-1.5 px-3 opacity-0 group-hover/langitem:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                                Os posts estão disponíveis apenas em Português.
                                <div className="absolute top-1/2 -translate-y-1/2 left-full w-2 h-2 bg-gray-800 transform rotate-45 -ml-1"></div>
                                </div>
                            )}
                            </div>
                        ))}
                        </div>
                    )}
                </div>
               <button onClick={toggleTheme} className="bg-white dark:bg-tech-800 text-tech-accent p-2.5 rounded-full border border-transparent dark:border-tech-700 shadow-md hover:scale-110 transition-transform">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
               <div className="flex items-center gap-3 border-l border-gray-300 dark:border-tech-800 pl-5">
                  {user ? (
                    <div className="relative" ref={userMenuRef}>
                         <button onClick={() => setUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 bg-white dark:bg-tech-800 border border-transparent dark:border-tech-700 rounded-full pl-1 pr-5 py-1 shadow-md hover:shadow-lg transition-all active:scale-95">
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-tech-950 flex items-center justify-center overflow-hidden border-2 border-tech-accent shadow-sm"><img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.user_display_name}`} className="w-full h-full object-cover" /></div>
                            <div className="flex flex-col items-start"><span className="text-[9px] text-gray-500 uppercase font-black tracking-tighter leading-none mb-0.5">{t.welcome}</span><span className="text-xs text-gray-900 dark:text-gray-200 font-black truncate max-w-[90px]">{user.user_display_name}</span></div>
                            <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                         </button>
                         {isUserMenuOpen && (
                             <div className="absolute top-full right-0 mt-3 w-64 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                 <div className="p-5 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#1e2022] flex items-center gap-4">
                                     <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-tech-950 flex items-center justify-center border-2 border-tech-accent overflow-hidden shadow-sm">{user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <span className="text-tech-accent font-bold text-xs">{user.user_display_name?.substring(0,2).toUpperCase()}</span>}</div>
                                     <div className="flex flex-col min-w-0"><p className="text-gray-900 dark:text-white font-black text-sm truncate">{user.user_display_name}</p><p className="text-gray-500 text-[10px] truncate">{user.user_email}</p></div>
                                 </div>
                                 <div className="p-2.5">
                                     <button onClick={() => { setView(ViewMode.PROFILE); setUserMenuOpen(false); }} className="w-full text-left flex items-center gap-4 px-4 py-3 text-xs font-black text-gray-700 dark:text-gray-300 hover:bg-[#dd9933]/10 hover:text-[#dd9933] rounded-xl transition-all uppercase tracking-[0.15em]"><User size={18}/> {t.profile}</button>
                                     <button onClick={() => { setView(ViewMode.PROFILE); setUserMenuOpen(false); }} className="w-full text-left flex items-center gap-4 px-4 py-3 text-xs font-black text-gray-700 dark:text-gray-300 hover:bg-[#dd9933]/10 hover:text-[#dd9933] rounded-xl transition-all uppercase tracking-[0.15em]"><CreditCard size={18}/> {t.subscription}</button>
                                 </div>
                                 <div className="p-2.5 border-t border-gray-100 dark:border-white/5"><button onClick={() => { setUserMenuOpen(false); onLogoutClick(); }} className="w-full text-left flex items-center gap-4 px-4 py-3 text-xs font-black text-red-500 hover:bg-red-500/10 rounded-xl transition-all uppercase tracking-[0.2em]"><Power size={18}/> {t.logout}</button></div>
                             </div>
                         )}
                    </div>
                  ) : (
                    <button onClick={onLoginClick} className="bg-[#dd9933] text-black font-black uppercase tracking-widest text-xs px-8 py-3 rounded-xl shadow-lg hover:bg-amber-600 transition-all active:scale-95">{t.login}</button>
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
