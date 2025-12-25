
import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, Zap, Eye, EyeOff, ArrowDownRight, Activity, Loader2, ChevronDown, ExternalLink, ArrowUp, ArrowDown, LayoutDashboard, Calendar, Server, RefreshCw, Search, Clock } from '../components/Icons';
import NewsGrid from '../components/NewsGrid';
import NewsFeed from '../components/NewsFeed';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, CartesianGrid, Tooltip, AreaChart, Area, Brush } from 'recharts';
import { WPPost, Language, ViewMode } from '../types';
import MagazineTicker from '../components/MagazineTicker';
import { getTranslations } from '../locales';
import { 
    fetchTopCoins, 
    fetchAltcoinSeason, 
    fetchAltcoinSeasonHistory, 
    fetchTrumpData, 
    fetchGainersLosers,
    fetchRsiAverage,
    TrumpData,
    fetchLongShortRatio,
    fetchEtfFlow,
    fetchMarketCapHistory,
    MktCapHistoryData,
    fetchEconomicCalendar,
    EconEvent
} from './Workspace/services/api';

// --- COMPACT HELPERS ---

const WorkspaceLink = ({ onClick }: { onClick: () => void }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }} 
        className="text-gray-500 hover:text-tech-accent transition-colors p-0.5 ml-2" 
        title="Open in Workspace"
    >
        <LayoutDashboard size={12} />
    </button>
);

const HorizontalHistoryRow = ({ data, labels }: { data: (string | number)[], labels: string[] }) => (
  <div className="flex justify-between pt-1 px-1 text-center border-t border-tech-700/50 mt-1 w-full">
      {labels.map((label, i) => (
          <div key={label}>
              <div className="text-[8px] text-gray-500 font-bold uppercase">{label}</div>
              <div className="text-xs font-bold text-gray-300 font-mono">{data[i] || '-'}</div>
          </div>
      ))}
  </div>
);

// Constants for F&G and RSI (Adjusted Down by 5px)
const GAUGE_CX = 100;
const GAUGE_CY = 55; // Lowered by 5px (was 50)
const GAUGE_R = 75;  
const GAUGE_RY = 55; 
// Text positions kept EXACTLY the same
const TEXT_VAL_Y = 90; 
const TEXT_LBL_Y = 105;

const FearAndGreedWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState<{ value: string; timestamp: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language).dashboard.widgets.fng;
  const timeT = getTranslations(language).dashboard.widgets.time;

  const classify = (v: number) => {
    if (v >= 0 && v <= 25)  return t.s0;
    if (v > 25 && v <= 40)  return t.s1;
    if (v > 40 && v <= 60)  return t.s2;
    if (v > 60 && v <= 75)  return t.s3;
    if (v > 75 && v <= 95) return t.s4;
    if (v > 95 && v <= 100) return t.s5;
    return '';
  };

  useEffect(() => {
    const fetchFNG = async () => {
      try {
        const res = await fetch('https://api.alternative.me/fng/?limit=31');
        const json = await res.json();
        if (json.data) setData(json.data);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchFNG();
  }, []);

  const todayVal = data[0] ? parseInt(data[0].value) : 50;
  const classification = classify(todayVal);
  const rotation = -90 + (todayVal / 100) * 180;

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full relative overflow-hidden bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all">
      <div className="flex justify-between items-start absolute top-2 left-2 right-2 z-10">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{t.title}</span>
          <WorkspaceLink onClick={onNavigate} />
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[10px] text-gray-500 animate-pulse">Loading...</div>
      ) : (
        <>
           <div className="flex-1 relative w-full flex justify-center items-end pb-1 mt-2">
             <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
               <defs>
                 {/* Fixed: Removed duplicate x2 attribute and correctly set y2 to 0 */}
                 <linearGradient id="fngGradient" x1="0" y1="0" x2="1" y2="0">
                   <stop offset="0%" stopColor="#E03A3E" />
                   <stop offset="25%" stopColor="#F47C20" />
                   <stop offset="50%" stopColor="#FFD700" />
                   <stop offset="75%" stopColor="#7AC74F" />
                   <stop offset="100%" stopColor="#009E4F" />
                 </linearGradient>
               </defs>
               <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-tech-700" strokeWidth="10" strokeLinecap="round" />
               <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="url(#fngGradient)" strokeWidth="10" strokeLinecap="round" />
               <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                 <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                 <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
               </g>
               <text x={GAUGE_CX} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="26" fontWeight="900" fontFamily="monospace">
                  {todayVal}
               </text>
               <text x={GAUGE_CX} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-main)" fontSize="10" fontWeight="900" letterSpacing="0.5">
                  {classification}
               </text>
             </svg>
           </div>
           <HorizontalHistoryRow labels={[timeT.yesterday, timeT.d7, timeT.d30]} data={[data[1]?.value, data[7]?.value, data[29]?.value]} />
        </>
      )}
    </div>
  );
};

const RsiWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState({ averageRsi: 50, yesterday: 0, days7Ago: 0, days30Ago: 0 });
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language).dashboard.widgets.rsi;
  const timeT = getTranslations(language).dashboard.widgets.time;

  const classify = (v: number) => {
    if (v < 20) return t.oversold;
    if (v >= 20 && v < 40) return t.bearish;
    if (v >= 40 && v < 60) return t.neutral;
    if (v >= 60 && v < 80) return t.bullish;
    if (v >= 80) return t.overbought;
    return '';
  };

  useEffect(() => {
    fetchRsiAverage().then(res => {
        if(res) setData(res);
        setLoading(false);
    });
  }, []);

  const rotation = -90 + ((data.averageRsi || 50) / 100) * 180;

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full relative overflow-hidden bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all">
      <div className="flex justify-between items-start absolute top-2 left-2 right-2 z-10">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{t.title}</span>
          <WorkspaceLink onClick={onNavigate} />
      </div>
      {loading ? (
          <div className="flex-1 flex items-center justify-center text-[10px] text-gray-500 animate-pulse">Loading...</div>
      ) : (
      <>
          <div className="flex-1 relative w-full flex justify-center items-end pb-1 mt-2">
            <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
              <defs>
                <linearGradient id="rsiGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#009E4F" />
                  <stop offset="25%" stopColor="#7AC74F" />
                  <stop offset="50%" stopColor="#FFD700" />
                  <stop offset="75%" stopColor="#F47C20" />
                  <stop offset="100%" stopColor="#E03A3E" />
                </linearGradient>
              </defs>
              <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-tech-700" strokeWidth="10" strokeLinecap="round" />
              <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="url(#rsiGradient)" strokeWidth="10" strokeLinecap="round" />
              <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                <circle cx={GAUGE_CX} cy={GAUGE_CY} r="4" fill="var(--color-text-main)" />
              </g>
              <text x={GAUGE_CX} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="26" fontWeight="bold" fontFamily="monospace">
                {(data.averageRsi || 0).toFixed(1)}
              </text>
              <text x={GAUGE_CX} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-main)" fontSize="10" fontWeight="900" letterSpacing="0.5">
                {classify(data.averageRsi || 50)}
              </text>
            </svg>
          </div>
          <HorizontalHistoryRow labels={[timeT.yesterday, timeT.d7, timeT.d30]} data={[data.yesterday?.toFixed(1), data.days7Ago?.toFixed(1), data.days30Ago?.toFixed(1)]} />
      </>
      )}
    </div>
  );
};

const AltSeasonWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState({ index: 0, yesterday: 0, lastWeek: 0, lastMonth: 0, history: [] });
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language).dashboard.widgets.altseason;

  useEffect(() => {
    const loadData = async () => {
       try {
         setLoading(true);
         const [current, history] = await Promise.all([
             fetchAltcoinSeason(),
             fetchAltcoinSeasonHistory()
         ]);
         
         if (current) {
             setData({ 
                 index: current.index || 0, 
                 yesterday: current.yesterday || 0, 
                 lastWeek: current.lastWeek || 0, 
                 lastMonth: current.lastMonth || 0, 
                 history: history || [] 
             });
         }
       } catch (e) {
         console.error("Failed to load ASI", e);
       } finally { setLoading(false); }
    };
    loadData();
  }, []);

  let status = t.transition;
  if (data.index <= 25) status = t.bitcoinSeason;
  else if (data.index >= 75) status = t.altcoinSeason;
  else if (data.index > 25 && data.index <= 45) status = t.btcDomZone;

  return (
    <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative">
      <div className="shrink-0 flex justify-between items-start mb-1">
        <div className="flex flex-col">
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">{t.title}</span>
            <span className="text-xs font-bold text-gray-200">{status}</span>
        </div>
        <div className="text-right flex items-start gap-2">
            <span className="text-2xl font-bold text-gray-200 font-mono">{data.index}</span>
            <WorkspaceLink onClick={onNavigate} />
        </div>
      </div>
      <div className="relative flex-1 bg-tech-900/50 rounded-lg -mx-1 mb-1">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.history}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis 
                    dataKey="date" 
                    hide 
                    type="number" 
                    domain={['dataMin', 'dataMax']} 
                />
                <YAxis domain={[0, 100]} hide />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1c1e', borderColor: '#334155', color: '#fff', fontSize: '10px' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#94a3b8' }}
                    labelFormatter={(label) => {
                       const d = new Date(Number(label));
                       return d.toLocaleDateString('pt-BR');
                    }}
                />
                <Line type="monotone" dataKey="value" stroke="#dd9933" strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveContainer>
      </div>
      <HorizontalHistoryRow labels={[t.yesterday, t.week, t.month]} data={[data.yesterday, data.lastWeek, data.lastMonth]} />
    </div>
  );
};

const MarketCapHistoryWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState<MktCapHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language).dashboard.widgets.mktcapHistory;

  useEffect(() => {
    fetchMarketCapHistory().then(d => {
        setData(d);
        setLoading(false);
    });
  }, []);

  const formatVal = (val: number) => {
      if (val === undefined || val === null) return '---';
      if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
      if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
      return `$${val.toFixed(0)}`;
  };

  return (
    <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative">
      <div className="shrink-0 flex justify-between items-start mb-1">
        <div className="flex flex-col">
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider">{t.title}</span>
            <span className="text-xs font-bold text-gray-200">Global</span>
        </div>
        <div className="text-right flex items-start gap-2">
            <span className="text-lg font-bold text-tech-accent font-mono">{data ? formatVal(data.current) : '---'}</span>
            <WorkspaceLink onClick={onNavigate} />
        </div>
      </div>
      <div className="relative flex-1 bg-tech-900/50 rounded-lg -mx-1 mb-1">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.history || []}>
                <defs>
                    <linearGradient id="colorMkt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis 
                    dataKey="date" 
                    hide 
                    type="number" 
                    domain={['dataMin', 'dataMax']}
                />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1c1e', borderColor: '#334155', color: '#fff', fontSize: '10px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [formatVal(value), 'Mkt Cap']}
                    labelFormatter={(label) => new Date(Number(label)).toLocaleDateString('pt-BR')} 
                />
                <Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#colorMkt)" strokeWidth={2} />
            </AreaChart>
        </ResponsiveContainer>
      </div>
      <HorizontalHistoryRow labels={[t.yesterday, t.week, t.month]} data={[data ? formatVal(data.yesterday) : '-', data ? formatVal(data.lastWeek) : '-', data ? formatVal(data.lastMonth) : '-']} />
    </div>
  );
};

// Compact layout for LSR (Title Top, Dropdowns Below, Gauge Bottom)
const LongShortRatioWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [period, setPeriod] = useState('5m');
  const [data, setData] = useState<{lsr: number, longs: number, shorts: number} | null>(null);
  const [hovered, setHovered] = useState(false);
  const t = getTranslations(language).dashboard.widgets.lsr;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const d = await fetchLongShortRatio(symbol, period);
        setData(d);
      } catch (e) {
        setData({ lsr: 1.45, longs: 59.2, shorts: 40.8 });
      }
    };
    fetchData();
  }, [symbol, period]);

  const val = data?.lsr || 0;
  const rotation = -90 + (Math.min(Math.max(val, 0), 3) / 3) * 180;
  
  const symbolsList = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT'
  ];
  const periodsList = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1D'];

  const lsrCx = 100;
  const lsrCy = 55; // Lowered by 5px (was 50)
  const lsrR = 75;  
  const lsrRy = 55; 

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all relative">
        <div className="w-full flex justify-between items-center mb-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold ml-1">{t.title}</span>
            <WorkspaceLink onClick={onNavigate} />
        </div>
        
        <div className="flex justify-center gap-1 mb-1">
            <select value={symbol} onChange={e => setSymbol(e.target.value)} className="bg-tech-900 text-gray-200 text-[9px] font-bold rounded px-1 py-0.5 border border-tech-700 outline-none cursor-pointer max-w-[70px]">
                {symbolsList.map(s => <option key={s} value={s}>{s.replace('USDT', '')}</option>)}
            </select>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-tech-900 text-gray-200 text-[9px] font-bold rounded px-1 py-0.5 border border-tech-700 outline-none cursor-pointer">
                {periodsList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
        </div>
        
        <div className="flex-1 relative w-full flex justify-center items-end overflow-hidden pb-1">
            <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
                <defs><linearGradient id="lsrGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ef4444" /><stop offset="50%" stopColor="#eab308" /><stop offset="100%" stopColor="#22c55e" /></linearGradient></defs>
                <path d={`M ${lsrCx-lsrR} ${lsrCy} A ${lsrR} ${lsrRy} 0 0 1 ${lsrCx+lsrR} ${lsrCy}`} fill="none" stroke="currentColor" className="text-tech-700" strokeWidth="10" strokeLinecap="round" />
                <path d={`M ${lsrCx-lsrR} ${lsrCy} A ${lsrR} ${lsrRy} 0 0 1 ${lsrCx+lsrR} ${lsrCy}`} fill="none" stroke="url(#lsrGradient)" strokeWidth="10" strokeLinecap="round" />
                <g transform={`rotate(${rotation} ${lsrCx} ${lsrCy})`}>
                    <path d={`M ${lsrCx} ${lsrCy} L ${lsrCx} ${lsrCy - lsrRy + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                    <circle cx={lsrCx} cy={lsrCy} r="5" fill="var(--color-text-main)" />
                </g>
                <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="cursor-help">
                    <rect x={lsrCx - 40} y={lsrCy + 5} width="80" height="35" fill="transparent" />
                    {hovered ? (
                        <><text x={lsrCx} y={TEXT_VAL_Y} textAnchor="middle" fill="#22c55e" fontSize="12" fontWeight="bold">L: {data?.longs?.toFixed(0)}%</text><text x={lsrCx} y={TEXT_LBL_Y} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">S: {data?.shorts?.toFixed(0)}%</text></>
                    ) : (
                        <><text x={lsrCx} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="26" fontWeight="bold" fontFamily="monospace">{val.toFixed(2)}</text><text x={lsrCx} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-muted)" fontSize="10" fontWeight="900" letterSpacing="0.5">{val > 1.1 ? t.longs : val < 0.9 ? t.shorts : t.neutral}</text></>
                    )}
                </g>
            </svg>
        </div>
    </div>
  );
};

const EtfFlowWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState({ btc: 0, eth: 0, net: 0, d7: 0, d30: 0 });
    const t = getTranslations(language).dashboard.widgets.etf;
    useEffect(() => {
        fetchEtfFlow().then(res => {
            if (res) {
               setData({ 
                   btc: res.btcValue || 0, 
                   eth: res.ethValue || 0, 
                   net: ((res.btcValue || 0) + (res.ethValue || 0) + (res.solValue || 0) + (res.xrpValue || 0)), 
                   d7: res.history?.lastWeek || 0, 
                   d30: res.history?.lastMonth || 0 
               });
            }
        });
    }, []);
    const totalFlow = data.net;
    const isPos = totalFlow >= 0;
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative">
            <div className="flex justify-between items-center mb-1">
                <div className="font-bold text-gray-400 text-[10px] uppercase tracking-wider">{t.title}</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center py-2">
                <div className={`text-[10px] font-bold uppercase tracking-widest ${isPos ? 'text-green-500' : 'text-red-500'}`}>{t.netFlow}</div>
                <div className="flex items-center gap-1">
                    {isPos ? <ArrowUp size={24} className="text-green-500"/> : <ArrowDown size={24} className="text-red-500"/>}
                    <span className={`text-2xl font-mono font-black ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                        ${(Math.abs(totalFlow) / 1e6).toFixed(1)}M
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1 border-t border-tech-700/50 pt-2">
                <div className="text-center">
                    <div className="text-[8px] text-[#dd9933] font-bold uppercase">BTC ETF</div>
                    <div className="text-xs font-mono font-bold text-gray-300">{(data.btc / 1e6).toFixed(1)}M</div>
                </div>
                <div className="text-center">
                    <div className="text-[8px] text-[#627eea] font-bold uppercase">ETH ETF</div>
                    <div className="text-xs font-mono font-bold text-gray-300">{(data.eth / 1e6).toFixed(1)}M</div>
                </div>
            </div>
        </div>
    );
};

const TrumpOMeterWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState<TrumpData | null>(null);
    const t = getTranslations(language).dashboard.widgets.trump;
    
    useEffect(() => {
        fetchTrumpData().then(fetchedData => {
            if (fetchedData) setData(fetchedData);
        });
    }, [language]);
    
    if (!data) return <div className="glass-panel p-4 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 animate-pulse text-gray-400 items-center justify-center text-xs">Loading Trump...</div>;
    
    const val = data.impact_value || 0;
    const percent = val + 50;
    let label = t.fallback;
    if (val > 5) label = t.sarcastic.positiveMedium;
    else if (val < -5) label = t.sarcastic.negativeMedium;
    else label = t.sarcastic.neutral;
    const color = data.impact_color || '#dd9933';
    const isMinLit = val <= -45;
    const isMidLit = val >= -5 && val <= 5;
    const isMaxLit = val >= 45;
    
    return (
        <div className="glass-panel p-2 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative group/trump overflow-hidden">
        <div className="flex justify-between items-start mb-1 shrink-0">
            <div className="text-left font-bold text-[var(--color-widget-title)] text-[10px] uppercase tracking-wider">{t.title}</div>
            <div className="flex gap-2">
                <a href={data.post_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#dd9933] transition-colors"><ExternalLink size={12}/></a>
                <WorkspaceLink onClick={onNavigate} />
            </div>
        </div>
        
        {/* Updated Gauge - No Big Number */}
        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-['#E03A3E'] via-['#FFD700'] to-['#009E4F'] shadow-inner mt-4 mb-5 shrink-0" style={{backgroundImage: 'linear-gradient(to right, #E03A3E, #FFD700, #009E4F)'}}>
            <div className="absolute top-0 bottom-0 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-tech-950 drop-shadow-md transition-all duration-700" style={{ left: `calc(${percent}% - 5px)`, top: '100%' }}></div>
            
            <div className="absolute w-full h-4 top-3.5 left-0 text-[8px] font-bold select-none pointer-events-none">
                <span className={`absolute left-0 transition-all duration-300 ${isMinLit ? 'opacity-100 scale-125' : 'text-gray-600 opacity-60'}`} style={isMinLit ? { color: color, textShadow: `0 0 5px ${color}` } : {}}>-50</span>
                <span className={`absolute left-1/2 -translate-x-1/2 transition-all duration-300 ${isMidLit ? 'opacity-100 scale-125' : 'text-gray-600 opacity-60'}`} style={isMidLit ? { color: color, textShadow: `0 0 5px ${color}` } : {}}>0</span>
                <span className={`absolute right-0 transition-all duration-300 ${isMaxLit ? 'opacity-100 scale-125' : 'text-gray-600 opacity-60'}`} style={isMaxLit ? { color: color, textShadow: `0 0 5px ${color}` } : {}}>+50</span>
            </div>
        </div>

        <div className="text-center mb-2 shrink-0">
            <div className="text-[10px] font-black uppercase tracking-tight leading-tight mt-2 truncate" style={{ color }}>{label}</div>
        </div>
        
        <div className="flex-1 flex flex-col border border-dashed border-gray-600 rounded-lg p-1.5 bg-black/10 hover:bg-black/20 transition-colors min-h-0 overflow-hidden" style={{ borderColor: color }}>
            <div className="flex items-center gap-2 mb-1 shrink-0">
                <img src={data.image_url} alt="Trump" className="w-4 h-4 rounded-full object-cover shrink-0 border border-gray-500" />
                <span className="text-[9px] font-bold text-gray-400 truncate">{data.author_name}</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                <p className="text-[9px] leading-snug text-gray-300 select-none font-medium whitespace-pre-wrap">{data.post_text}</p>
            </div>
        </div>
        </div>
    );
};

const GainersLosersWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState({ gainers: [], losers: [] });
    const [tab, setTab] = useState('gainers');
    const [flashingRow, setFlashingRow] = useState<number | null>(null);
    const t = getTranslations(language).dashboard.widgets.gainers;

    useEffect(() => {
        fetchGainersLosers().then(d => {
            if (d && (d.gainers.length > 0 || d.losers.length > 0)) {
                setData({ gainers: d.gainers as any, losers: d.losers as any });
            } else {
                setData({ 
                    gainers: [{symbol: "PEPE", price: 0.000008, change: 12.5, logo: "https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg"}, {symbol: "RNDR", price: 7.85, change: 8.2, logo: "https://assets.coingecko.com/coins/images/11636/small/rndr.png"}, {symbol: "NEAR", price: 6.34, change: 6.1, logo: "https://assets.coingecko.com/coins/images/10365/small/near.png"}, {symbol: "FET", price: 2.28, change: 5.75, logo: "https://assets.coingecko.com/coins/images/5681/small/fet.png"}, {symbol: "SOL", price: 145.6, change: 4.5, logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png"}, {symbol: "AGIX", price: 0.88, change: 4.2, logo: "https://assets.coingecko.com/coins/images/2438/small/singularitynet.png"}, {symbol: "OCEAN", price: 0.95, change: 3.8, logo: "https://assets.coingecko.com/coins/images/3687/small/ocean-protocol-logo.jpg"}, {symbol: "GRT", price: 0.32, change: 3.5, logo: "https://assets.coingecko.com/coins/images/13397/small/Graph_Token.png"}, {symbol: "INJ", price: 35.20, change: 3.2, logo: "https://assets.coingecko.com/coins/images/12882/small/Secondary_Symbol.png"}, {symbol: "RUNE", price: 5.40, change: 2.9, logo: "https://assets.coingecko.com/coins/images/13677/small/thorchain.jpg"}] as any, 
                    losers: [{symbol: "WIF", price: 2.45, change: -8.5, logo: "https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpeg"}, {symbol: "BONK", price: 0.00002, change: -6.2, logo: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpeg"}, {symbol: "ENA", price: 0.85, change: -5.1, logo: "https://assets.coingecko.com/coins/images/36531/small/ethena.jpeg"}, {symbol: "TIA", price: 9.20, change: -4.5, logo: "https://assets.coingecko.com/coins/images/31967/small/tia.png"}, {symbol: "ARB", price: 1.10, change: -3.8, logo: "https://assets.coingecko.com/coins/images/16547/small/arbitrum.jpg"}, {symbol: "OP", price: 2.25, change: -3.5, logo: "https://assets.coingecko.com/coins/images/19429/small/optimism.png"}, {symbol: "STRK", price: 1.20, change: -3.2, logo: "https://assets.coingecko.com/coins/images/32828/small/starknet.png"}, {symbol: "ALT", price: 0.45, change: -3.0, logo: "https://assets.coingecko.com/coins/images/34626/small/altlayer.jpeg"}, {symbol: "DYM", price: 4.50, change: -2.8, logo: "https://assets.coingecko.com/coins/images/34190/small/dymension.png"}, {symbol: "MANTA", price: 1.80, change: -2.5, logo: "https://assets.coingecko.com/coins/images/33534/small/manta.jpg"}] as any 
                });
            }
        });
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const row = Math.floor(Math.random() * 10);
            setFlashingRow(row);
            setTimeout(() => setFlashingRow(null), 500);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const list = tab === 'gainers' ? data.gainers : data.losers;
    
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative">
            <div className="absolute top-2 right-2 z-10"><WorkspaceLink onClick={onNavigate} /></div>
            <div className="flex bg-tech-900 rounded p-1 mb-2 mr-6">
                <button onClick={() => setTab('gainers')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-all shadow-sm ${tab==='gainers'?'bg-green-500 text-black shadow-green-500/20':'text-gray-500 hover:bg-white/5'}`}>{t.gainers}</button>
                <button onClick={() => setTab('losers')} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-all shadow-sm ${tab==='losers'?'bg-red-500 text-black shadow-red-500/20':'text-gray-500 hover:bg-white/5'}`}>{t.losers}</button>
            </div>
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-1">
                {list && list.slice(0, 10).map((coin: any, i) => (
                    <div key={i} className={`flex items-center justify-between px-2 py-1.5 transition-colors rounded ${flashingRow === i ? ((coin.change || 0) >= 0 ? 'bg-green-500/20' : 'bg-red-500/20') : 'hover:bg-white/5'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden flex-shrink-0"><img src={coin.logo} className="w-full h-full object-cover" alt="" /></div>
                            <div className="flex flex-col"><span className="text-sm font-bold text-gray-900 dark:text-white leading-none">{coin.symbol}</span><span className="text-[10px] text-gray-500 font-mono">${parseFloat(coin.price || 0).toFixed(4)}</span></div>
                        </div>
                        <div className={`text-sm font-bold font-mono ${coin.change>=0?'text-green-400':'text-red-400'}`}>{coin.change > 0 ? '+' : ''}{parseFloat(coin.change || 0).toFixed(2)}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MarketCapWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const t = getTranslations(language).dashboard.widgets.mktcap;
    const [list, setList] = useState<any[]>([]);
    const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE', 'GUSD'];

    useEffect(() => {
        const load = async () => {
            const data = await fetchTopCoins();
            const filteredData = data.filter((coin: any) => coin && coin.symbol && !STABLECOINS.includes(coin.symbol.toUpperCase()));
            setList(filteredData.slice(0, 10));
        }
        load();
    }, []);

    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative">
            <div className="flex justify-between items-center mb-2">
                <div className="text-center font-bold text-[var(--color-widget-title)] text-xs uppercase tracking-wider flex-1 ml-4">TOP 10 MARKET CAP</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                {list.map((coin, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 transition-colors rounded hover:bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden flex-shrink-0"><img src={coin.image} className="w-full h-full object-cover" alt="" onError={(e)=>(e.target as HTMLImageElement).style.display='none'} /></div>
                            <div className="flex flex-col"><span className="text-sm font-bold text-gray-900 dark:text-white leading-none">{coin.name}</span><span className="text-[10px] text-gray-500 font-mono uppercase">{coin.symbol}</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-gray-900 dark:text-white font-mono">${coin.current_price?.toLocaleString()}</div>
                            <div className={`text-[10px] font-mono ${coin.price_change_percentage_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>{coin.price_change_percentage_24h > 0 ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}%</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- CUSTOM ECONOMIC CALENDAR COMPONENT (No Logos, Pure React) ---
const EconomicCalendarWidget = ({ language, onNavigate, theme }: { language: Language; onNavigate: () => void; theme: 'dark' | 'light' }) => {
    const [events, setEvents] = useState<EconEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'USD' | 'BRL'>('ALL');
    const t = getTranslations(language).dashboard.widgets.calendar;

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const allEvents = await fetchEconomicCalendar();
            
            // Filter: Only USD and BRL (ForexFactory often uses 'USD' as country code for US)
            // Filter: Only Today and Tomorrow
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const isToday = (d: Date) => d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            const isTomorrow = (d: Date) => d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();

            const filtered = allEvents.filter(e => {
                const eventDate = new Date(e.date);
                // Country Filter: FF uses currency codes mostly
                const isRelevantCountry = e.country === 'USD' || e.country === 'BRL'; 
                const isRelevantDate = isToday(eventDate) || isTomorrow(eventDate);
                return isRelevantCountry && isRelevantDate;
            });
            
            // Sort by date
            filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setEvents(filtered);
            setLoading(false);
        };
        load();
        const interval = setInterval(load, 300000); // 5 min refresh
        return () => clearInterval(interval);
    }, []);

    const getImpactColor = (impact: string) => {
        if (impact === 'High') return 'bg-red-500';
        if (impact === 'Medium') return 'bg-orange-500';
        return 'bg-yellow-500';
    };

    const getFlag = (country: string) => {
        if (country === 'BRL') return "https://hatscripts.github.io/circle-flags/flags/br.svg";
        return "https://hatscripts.github.io/circle-flags/flags/us.svg";
    }

    const filteredEvents = events.filter(e => filter === 'ALL' || e.country === filter);

    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative overflow-hidden transition-colors">
             <div className="flex justify-between items-center mb-2 relative z-20 h-6 shrink-0">
                <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#dd9933]" />
                    <span className="font-bold text-[var(--color-widget-title)] text-xs uppercase tracking-wider">{t.title}</span>
                </div>
                
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setFilter(prev => prev === 'BRL' ? 'ALL' : 'BRL')} 
                        className={`transition-opacity hover:scale-110 ${filter === 'BRL' ? 'opacity-100 scale-110' : filter === 'ALL' ? 'opacity-100' : 'opacity-30 grayscale'}`}
                        title="Filtrar Brasil"
                    >
                        <img src="https://hatscripts.github.io/circle-flags/flags/br.svg" className="w-4 h-4 rounded-full shadow-sm" alt="BRL" />
                    </button>
                    <button 
                        onClick={() => setFilter(prev => prev === 'USD' ? 'ALL' : 'USD')} 
                        className={`transition-opacity hover:scale-110 ${filter === 'USD' ? 'opacity-100 scale-110' : filter === 'ALL' ? 'opacity-100' : 'opacity-30 grayscale'}`}
                        title="Filtrar EUA"
                    >
                        <img src="https://hatscripts.github.io/circle-flags/flags/us.svg" className="w-4 h-4 rounded-full shadow-sm" alt="USD" />
                    </button>
                    <WorkspaceLink onClick={onNavigate} />
                </div>
            </div>
            
            <div className="flex-1 w-full relative z-10 overflow-y-auto custom-scrollbar pr-1">
                 {loading ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                         <Loader2 className="animate-spin w-4 h-4 mr-2" /> Carregando eventos...
                     </div>
                 ) : filteredEvents.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-gray-500 text-xs text-center px-4">
                         Nenhum evento encontrado.
                     </div>
                 ) : (
                     <div className="flex flex-col gap-1">
                         {filteredEvents.map((e, i) => {
                             const date = new Date(e.date);
                             const timeStr = date.toLocaleTimeString(language === 'pt' ? 'pt-BR' : 'en-US', {hour: '2-digit', minute:'2-digit'});
                             const isToday = date.getDate() === new Date().getDate();
                             
                             return (
                                 <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-white/5 border border-transparent hover:border-gray-700 transition-colors">
                                     {/* Left: Time */}
                                     <div className="flex flex-col items-center w-10 shrink-0">
                                         <span className="text-[10px] font-bold text-gray-400 dark:text-gray-300">{timeStr}</span>
                                         <span className="text-[8px] uppercase text-gray-500 dark:text-gray-400">{isToday ? t.today : t.tomorrow}</span>
                                     </div>
                                     
                                     {/* Middle: Bar + Flag + Title */}
                                     <div className={`w-1 h-8 rounded-full shrink-0 ${getImpactColor(e.impact)}`}></div>
                                     <div className="flex-1 min-w-0 flex items-center gap-2">
                                         <img src={getFlag(e.country)} className="w-4 h-4 rounded-full shadow-sm shrink-0" alt={e.country} />
                                         <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate leading-tight">{e.title}</span>
                                     </div>

                                     {/* Right: Data Columns - Widened to 180px for spacing */}
                                     <div className="grid grid-cols-3 gap-4 w-[180px] shrink-0 text-right">
                                         <div className="flex flex-col">
                                             <span className="text-[8px] text-gray-600 dark:text-gray-400 font-bold uppercase">{t.previous}</span>
                                             <span className="text-[9px] text-gray-800 dark:text-gray-200 font-mono font-bold">{e.previous}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[8px] text-gray-600 dark:text-gray-400 font-bold uppercase">{t.forecast}</span>
                                             <span className="text-[9px] text-gray-800 dark:text-gray-200 font-mono font-bold">{e.forecast || '--'}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="text-[8px] text-gray-600 dark:text-gray-400 font-bold uppercase">{t.actual}</span>
                                             <span className="text-[9px] text-gray-800 dark:text-gray-200 font-mono font-bold">--</span>
                                         </div>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 )}
            </div>
        </div>
    );
};

interface DashboardProps {
  onPostClick: (postId: number) => void;
  language?: Language;
  setView: (view: ViewMode) => void;
  theme: 'dark' | 'light';
}

const Dashboard: React.FC<DashboardProps> = ({ onPostClick, language = 'pt' as Language, setView, theme }) => {
  const [showStats, setShowStats] = useState(true);
  const t = getTranslations(language).dashboard;

  const navigateToWorkspace = () => setView(ViewMode.WORKSPACE);

  return (
    <div className="w-full flex-1 flex flex-col transition-colors duration-700">
      
      <div className="container mx-auto px-4 mt-6">
        {/* SEPARATOR */}
        <div className="flex items-center justify-center mb-6">
            <div className="h-px bg-tech-600 flex-1"></div>
            <div className="flex items-center gap-4 px-4 py-1 bg-tech-800 border border-tech-700 rounded-lg shadow-xl">
               <button onClick={() => setView(ViewMode.WORKSPACE)} className="text-black dark:text-[#dd9933] hover:text-[#dd9933] transition-colors font-black tracking-[0.2em] text-lg uppercase shadow-[#dd9933]/20 drop-shadow-lg flex items-center gap-2">
                   ANALYTICS WORKSPACE <LayoutDashboard size={16} />
               </button>
               <div className="w-px h-4 bg-tech-600/50"></div>
               <button onClick={() => setShowStats(!showStats)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-[#dd9933] transition-colors" title={showStats ? t.hideStats : t.showStats}>
                    {showStats ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
            </div>
            <div className="h-px bg-tech-600 flex-1"></div>
        </div>

        {showStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-[repeat(7,minmax(0,1fr))] gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
                {/* ROW 1: 7 ITEMS (160px height) - Each taking 1 column */}
                <div className="h-[160px]"><FearAndGreedWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[160px]"><RsiWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[160px]"><LongShortRatioWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[160px]"><AltSeasonWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[160px]"><MarketCapHistoryWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[160px]"><EtfFlowWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[160px]"><TrumpOMeterWidget language={language} onNavigate={navigateToWorkspace} /></div>

                {/* ROW 2: Gainers (2 cols) + MarketCap (2 cols) + Calendar (3 cols) = 7 Cols Total */}
                <div className="h-[260px] md:col-span-1 xl:col-span-2"><GainersLosersWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[260px] md:col-span-2 xl:col-span-2"><MarketCapWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[260px] md:col-span-3 xl:col-span-3"><EconomicCalendarWidget language={language} onNavigate={navigateToWorkspace} theme={theme} /></div>
            </div>
        )}
      </div>

      <div className="container mx-auto px-4 flex flex-col">
        <div className={`flex items-center justify-center ${showStats ? 'mt-16' : 'mt-6'} mb-8 transition-all duration-500`}>
            <div className="h-px bg-tech-600 flex-1"></div>
            <div className="px-6 py-2 bg-tech-800 border border-tech-700 rounded-lg shadow-xl">
               <h2 className="text-black dark:text-[#dd9933] hover:text-[#dd9933] transition-colors font-black tracking-[0.2em] text-lg uppercase shadow-[#dd9933]/20 drop-shadow-lg">{t.magazineTitle}</h2>
            </div>
            <div className="h-px bg-tech-600 flex-1"></div>
        </div>

        <div className="flex flex-col gap-5 pb-20">
            <div><MagazineTicker onPostClick={onPostClick} /></div>
            <div className="min-h-[600px]"><NewsGrid onPostClick={onPostClick} language={language} /></div>
            <div className="w-full"><NewsFeed onPostClick={onPostClick} language={language} /></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
