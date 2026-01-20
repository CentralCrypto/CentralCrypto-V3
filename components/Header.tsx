
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

// Cores de flash padronizadas
const FLASH_GREEN_BG = '#122A21';
const FLASH_RED_BG = '#C33B4080';

const formatUSD = (val: number) => {
    if (!val) return "---";
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

// Componente extraído e memoizado para evitar re-renders desnecessários
const TickerItem: React.FC<{ symbol: string; data: DisplayTickerData; meta: CoinMeta; onHover: any; onLeave: any; }> = React.memo(({ symbol, data, meta, onHover, onLeave }) => {
  const { p, c, rawPrice } = data;
  const [flashBg, setFlashBg] = useState('transparent');
  const prevPriceRef = useRef(rawPrice);

  useEffect(() => {
    if (rawPrice !== prevPriceRef.current) {
        // Ignora a inicialização (quando prev é 0 ou undefined se preferir)
        if (prevPriceRef.current > 0) {
            if (rawPrice > prevPriceRef.current) {
                setFlashBg(FLASH_GREEN_BG);
            } else if (rawPrice < prevPriceRef.current) {
                setFlashBg(FLASH_RED_BG);
            }
            
            const timer = setTimeout(() => setFlashBg('transparent'), 500);
            return () => clearTimeout(timer);
        }
        prevPriceRef.current = rawPrice;
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
                className={`${isPositive ? 'text-tech-success' : 'text-tech-danger'} text-base font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded transition-colors duration-300`}
                style={{ backgroundColor: flashBg }}
            >
                {isPositive ? '▲' : '▼'}{Math.abs(c).toFixed(2)}%
            </span>
        </div>
    </div>
  );
}, (prev, next) => {
    // Custom comparison para performance extrema: só renderiza se dados mudarem
    return prev.data.rawPrice === next.data.rawPrice && prev.data.c === next.data.c && prev.symbol === next.symbol;
});

// Lista memoizada
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

export const Header: React.FC<{ currentView: ViewMode; setView: (v: ViewMode) => void; theme: 'dark' | 'light'; toggleTheme: () => void; user: UserData | null; language: Language; onLanguageChange: (lang: Language) => void; onLoginClick: () => void; onLogoutClick: () => void; onSearch: (q: string) => void; }> = ({ currentView, setView, theme, toggleTheme, user, language, onLanguageChange, onLoginClick, onLogoutClick, onSearch }) => {
  const t = getTranslations(language).header;
  const common = getTranslations(language).common;

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

  // useCallback vital para não quebrar a memoização do TickerItem/TickerList
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
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 text-gray-500 hover:text-red-500 bg-white dark:bg-tech-800 rounded-lg shadow-sm border border-gray-100 dark:border-tech-700 transition-colors"><CloseIcon size={18}/></button>
               </div>
               
               <div className="p-4 overflow-y-auto flex-1">
                   <div className="mb-6 relative">
                       <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                       <input 
                           type="text" 
                           placeholder={common.search} 
                           className="w-full bg-gray-100 dark:bg-tech-800 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#dd9933] transition-all"
                           onKeyDown={handleSearchKeyDown}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           value={searchTerm}
                       />
                   </div>

                   <nav className="space-y-1">
                        <button 
                            onClick={() => { setView(ViewMode.DASHBOARD); setIsMenuOpen(false); }}
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${currentView === ViewMode.DASHBOARD ? 'bg-[#dd9933] text-black shadow-lg shadow-orange-500/20' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800'}`}
                        >
                            <Activity size={18} /> Dashboard
                        </button>
                        
                        <div className="pt-2">
                            <button 
                                onClick={() => setAnalysisExpanded(!analysisExpanded)}
                                className="w-full text-left px-4 py-3 rounded-xl font-bold flex items-center justify-between text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800 transition-colors"
                            >
                                <span className="flex items-center gap-3"><BarChart3 size={18} /> {t.analysisCenter}</span>
                                <ChevronDown size={16} className={`transition-transform duration-300 ${analysisExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {analysisExpanded && (
                                <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 dark:border-tech-700 pl-4 animate-in slide-in-from-left-2 duration-300">
                                    {menuAnalysis.map(item => (
                                        <button 
                                            key={item.mode}
                                            onClick={() => { setView(item.mode); setIsMenuOpen(false); }}
                                            className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${currentView === item.mode ? 'text-[#dd9933] bg-[#dd9933]/10' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button 
                            onClick={() => { setView(ViewMode.ACADEMY); setIsMenuOpen(false); }}
                            className={`w-full text-left px-4 py-3 rounded-xl font-bold flex items-center gap-3 transition-all ${currentView === ViewMode.ACADEMY ? 'bg-[#dd9933] text-black shadow-lg shadow-orange-500/20' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-tech-800'}`}
                        >
                            <Globe size={18} /> {t.academy}
                        </button>
                   </nav>
               </div>

               <div className="p-4 border-t border-gray-200 dark:border-tech-800 bg-gray-50 dark:bg-tech-950/30">
                   <div className="flex justify-center gap-4 mb-4">
                       <button onClick={toggleTheme} className="p-2 rounded-full bg-white dark:bg-tech-800 text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-tech-700">
                           {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                       </button>
                       {user && (
                           <button onClick={() => { onLogoutClick(); setIsMenuOpen(false); }} className="p-2 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 hover:bg-red-200 transition-colors">
                               <Power size={18} />
                           </button>
                       )}
                   </div>
                   <div className="flex justify-center gap-3">
                       {socialLinks.map((s, i) => (
                           <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#dd9933] transition-colors">{s.icon}</a>
                       ))}
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* DESKTOP HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-tech-900 border-b border-gray-200 dark:border-tech-800 transition-colors h-[152px]">
         {/* TOP ROW: Logo, Search, User, Theme */}
         <div className="h-[60px] flex items-center justify-between px-6 border-b border-gray-100 dark:border-tech-800/50">
             <div className="flex items-center gap-8">
                 {/* Logo */}
                 <div onClick={() => setView(ViewMode.DASHBOARD)} className="flex items-center gap-3 cursor-pointer group">
                     <img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" className="h-9 w-auto" alt="Logo" />
                     <div className="flex flex-col leading-none">
                         <span className="text-gray-800 dark:text-white font-bold text-lg uppercase tracking-tight group-hover:text-[#dd9933] transition-colors">Central</span>
                         <span className="text-[#dd9933] font-bold text-lg uppercase tracking-widest text-[10px]">CryptoTraders</span>
                     </div>
                 </div>

                 {/* Search Bar (Desktop) */}
                 <div className="hidden md:flex items-center relative group">
                     <Search size={16} className="absolute left-3 text-gray-400 group-focus-within:text-[#dd9933] transition-colors" />
                     <input 
                        type="text" 
                        placeholder={common.search}
                        className="bg-gray-100 dark:bg-tech-800 text-sm py-2 pl-10 pr-4 rounded-full w-64 focus:w-80 transition-all border-none focus:ring-2 focus:ring-[#dd9933] outline-none text-gray-700 dark:text-gray-200"
                        onKeyDown={(e) => { if(e.key === 'Enter') onSearch(e.currentTarget.value); }}
                     />
                 </div>
             </div>

             <div className="flex items-center gap-4">
                 {/* Lang Switcher */}
                 <div className="relative" ref={langMenuRef}>
                     <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-tech-800 transition-colors">
                         <Flag lang={language} />
                         <ChevronDown size={12} className="text-gray-400" />
                     </button>
                     {isLangMenuOpen && (
                         <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-tech-900 rounded-xl shadow-xl border border-gray-100 dark:border-tech-800 overflow-hidden py-1 animate-in fade-in zoom-in-95">
                             {LANGUAGES_CONFIG.map(l => (
                                 <button 
                                    key={l.code} 
                                    onClick={() => { onLanguageChange(l.code); setIsLangMenuOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-tech-800 transition-colors ${language === l.code ? 'bg-gray-50 dark:bg-tech-800 font-bold text-[#dd9933]' : 'text-gray-600 dark:text-gray-300'}`}
                                 >
                                     <img src={l.flag} className="w-4 h-4 rounded-full object-cover" /> {l.label}
                                 </button>
                             ))}
                         </div>
                     )}
                 </div>

                 {/* Theme Toggle */}
                 <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-tech-800 text-gray-500 dark:text-gray-400 transition-colors">
                     {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                 </button>

                 {/* User Menu */}
                 {user ? (
                     <div className="relative" ref={userMenuRef}>
                         <button onClick={() => setUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-tech-800 p-1 pr-3 rounded-full transition-colors border border-transparent hover:border-gray-200 dark:hover:border-tech-700">
                             <div className="w-8 h-8 rounded-full border border-[#dd9933] overflow-hidden"><img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.user_display_name}`} className="w-full h-full object-cover" /></div>
                             <div className="hidden md:flex flex-col items-start">
                                 <span className="text-xs font-bold text-gray-800 dark:text-white leading-none max-w-[100px] truncate">{user.user_display_name}</span>
                                 <span className="text-[9px] font-bold text-[#dd9933] uppercase tracking-widest">{t.profile}</span>
                             </div>
                             <ChevronDown size={14} className="text-gray-400" />
                         </button>
                         
                         {isUserMenuOpen && (
                             <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-tech-900 rounded-xl shadow-xl border border-gray-100 dark:border-tech-800 overflow-hidden py-1 animate-in fade-in zoom-in-95">
                                 <div className="px-4 py-3 border-b border-gray-100 dark:border-tech-800 mb-1">
                                     <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.user_display_name}</p>
                                     <p className="text-xs text-gray-500 truncate">{user.user_email}</p>
                                 </div>
                                 <button onClick={() => { setView(ViewMode.PROFILE); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-tech-800 flex items-center gap-2"><User size={16}/> {t.profile}</button>
                                 <button className="w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-tech-800 flex items-center gap-2"><CreditCard size={16}/> {t.subscription}</button>
                                 <div className="border-t border-gray-100 dark:border-tech-800 my-1"></div>
                                 <button onClick={() => { onLogoutClick(); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2"><Power size={16}/> {t.logout}</button>
                             </div>
                         )}
                     </div>
                 ) : (
                     <button onClick={onLoginClick} className="bg-[#dd9933] hover:bg-amber-600 text-black text-xs font-bold uppercase tracking-widest px-5 py-2 rounded-full shadow-lg transition-all flex items-center gap-2 transform active:scale-95">
                         <LogIn size={16} /> {t.login}
                     </button>
                 )}

                 {/* Mobile Menu Toggle */}
                 <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-gray-600 dark:text-gray-300">
                     <Menu size={24} />
                 </button>
             </div>
         </div>

         {/* TICKER ROW */}
         <div className="h-[40px] bg-gray-50 dark:bg-black/20 border-b border-gray-100 dark:border-tech-800/50 flex items-center overflow-hidden relative">
             <div className="animate-ticker flex items-center whitespace-nowrap hover:pause">
                 {/* Duplicado para loop infinito suave */}
                 <TickerList tickers={globalTickers} coinMeta={coinMeta} onHover={handleTickerHover} onLeave={hideTooltip} />
                 <TickerList tickers={globalTickers} coinMeta={coinMeta} onHover={handleTickerHover} onLeave={hideTooltip} />
             </div>
             {/* Fade masks */}
             <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-gray-50 dark:from-tech-900 to-transparent pointer-events-none"></div>
             <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-gray-50 dark:from-tech-900 to-transparent pointer-events-none"></div>
         </div>

         {/* NAVIGATION ROW */}
         <div className="h-[52px] flex items-center justify-center px-4 overflow-x-auto scrollbar-hide">
             <nav className="flex items-center gap-1">
                 <button onClick={() => setView(ViewMode.DASHBOARD)} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${currentView === ViewMode.DASHBOARD ? 'bg-gray-100 dark:bg-tech-800 text-[#dd9933]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-tech-800/50'}`}>
                     <Activity size={14} /> Dashboard
                 </button>
                 
                 {/* Analysis Dropdown */}
                 <div className="relative group" onMouseEnter={() => setAnalysisExpanded(true)} onMouseLeave={() => setAnalysisExpanded(false)}>
                     <button className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${[ViewMode.COCKPIT, ViewMode.WORKSPACE, ViewMode.INDICATORS, ViewMode.MARKET].includes(currentView) ? 'bg-gray-100 dark:bg-tech-800 text-[#dd9933]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-tech-800/50'}`}>
                         <BarChart3 size={14} /> {t.analysisCenter} <ChevronDown size={10} />
                     </button>
                     
                     <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 w-48 transition-all duration-200 ${analysisExpanded ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}>
                         <div className="bg-white dark:bg-tech-900 rounded-xl shadow-xl border border-gray-100 dark:border-tech-800 overflow-hidden py-1">
                             {menuAnalysis.map(item => (
                                 <button 
                                     key={item.mode}
                                     onClick={() => { setView(item.mode); setAnalysisExpanded(false); }}
                                     className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-tech-800 transition-colors flex items-center gap-2 ${currentView === item.mode ? 'text-[#dd9933] bg-[#dd9933]/5' : 'text-gray-600 dark:text-gray-300'}`}
                                 >
                                     <div className="w-1 h-1 rounded-full bg-current opacity-50"></div> {item.label}
                                 </button>
                             ))}
                         </div>
                     </div>
                 </div>

                 <button onClick={() => setView(ViewMode.ACADEMY)} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${currentView === ViewMode.ACADEMY ? 'bg-gray-100 dark:bg-tech-800 text-[#dd9933]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-tech-800/50'}`}>
                     <Globe size={14} /> {t.academy}
                 </button>
             </nav>
         </div>
      </header>
    </>
  );
};