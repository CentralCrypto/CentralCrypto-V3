
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUpRight, Zap, Eye, EyeOff, ArrowDownRight, Activity, Loader2, ChevronDown, ExternalLink, ArrowUp, ArrowDown, LayoutDashboard, Calendar, Server, RefreshCw, Search, Clock } from '../components/Icons';
import NewsGrid from '../components/NewsGrid';
import NewsFeed from '../components/NewsFeed';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, CartesianGrid, Tooltip, AreaChart, Area, Brush } from 'recharts';
import { WPPost, Language, ViewMode, WidgetType } from '../types';
import MagazineTicker from '../components/MagazineTicker';
import { getTranslations } from '../locales';
import CryptoWidget from './Workspace/components/CryptoWidget';
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
    fetchFearAndGreed,
    // Fix: Added missing fetchEconomicCalendar to the imports from Workspace API services
    fetchEconomicCalendar
} from './Workspace/services/api';

interface DashboardProps {
  onPostClick: (postId: number) => void;
  language: Language;
  setView: (view: ViewMode) => void;
  theme: 'dark' | 'light';
}

const WorkspaceLink = ({ onClick }: { onClick: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-gray-500 hover:text-tech-accent transition-colors p-0.5 ml-2" title="Open in Workspace">
        <LayoutDashboard size={14} />
    </button>
);

const HorizontalHistoryRow = ({ data, labels }: { data: (string | number)[], labels: string[] }) => (
  <div className="flex justify-between pt-1 px-1 text-center border-t border-tech-700/50 mt-1 w-full shrink-0">
      {labels.map((label, i) => (
          <div key={label}>
              <div className="text-[8px] text-gray-500 font-bold uppercase">{label}</div>
              <div className="text-xs font-bold text-gray-400 dark:text-gray-300 font-mono">{data[i] !== undefined ? data[i] : '-'}</div>
          </div>
      ))}
  </div>
);

const MarketCapHistoryWidget = ({ language, onNavigate, theme }: { language: Language; onNavigate: () => void; theme: 'dark' | 'light' }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language as Language).dashboard.widgets.mktcapHistory;

  useEffect(() => { 
    setLoading(true);
    fetchMarketCapHistory().then(res => {
        setData(res);
        setLoading(false);
    }).catch(() => setLoading(false)); 
  }, []);
  
  const formatVal = (v?: number) => {
    if (v === undefined || v === null) return '-';
    return v >= 1e12 ? `$${(v/1e12).toFixed(2)}T` : `$${(v/1e9).toFixed(1)}B`;
  };

  const chartPoints = useMemo(() => {
    // Lógica 100% robusta para qualquer formato do JSON de histórico
    if (!data) return [];
    const history = Array.isArray(data) 
        ? (data[0]?.history || data) 
        : (data?.history || []);
    
    if (!Array.isArray(history) || history.length === 0) return [];

    return history.slice(-30).map((p: any) => ({
        date: p.timestamp || p.date,
        value: p.market_cap || p.value || 0
    }));
  }, [data]);

  const latestHistory = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? (data[0]?.history || data) : (data?.history || []);
  }, [data]);

  const latestValue = latestHistory.length > 0 ? latestHistory[latestHistory.length - 1]?.market_cap : undefined;

  return (
    <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative overflow-hidden transition-all duration-700">
      <div className="shrink-0 flex justify-between items-start mb-1">
        <div className="flex flex-col">
            <span className="font-black text-[11px] leading-tight text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.title}</span>
            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-200">Global 30D</span>
        </div>
        <div className="text-right flex items-start gap-2">
            <span className="text-base font-bold text-tech-accent font-mono">{formatVal(latestValue)}</span>
            <WorkspaceLink onClick={onNavigate} />
        </div>
      </div>
      <div className="relative flex-1 bg-white/50 dark:bg-black/40 rounded-lg mb-1 overflow-hidden min-h-[90px] w-full">
        {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#dd9933]" size={16} /></div>
        ) : chartPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartPoints}>
                    <defs><linearGradient id="colorMkt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dd9933" stopOpacity={0.3}/><stop offset="95%" stopColor="#dd9933" stopOpacity={0}/></linearGradient></defs>
                    <Area type="monotone" dataKey="value" stroke="#dd9933" fill="url(#colorMkt)" strokeWidth={2} dot={false} isAnimationActive={true} />
                </AreaChart>
            </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-500 italic uppercase">Sem Dados Históricos</div>
        )}
      </div>
      <HorizontalHistoryRow 
        labels={[t.yesterday, t.week, t.month]} 
        data={[
            formatVal(latestHistory[latestHistory.length - 2]?.market_cap), 
            formatVal(latestHistory[latestHistory.length - 7]?.market_cap), 
            formatVal(latestHistory[latestHistory.length - 30]?.market_cap)
        ]} 
      />
    </div>
  );
};

const FearAndGreedWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language as Language).dashboard.widgets.fng;
  const timeT = getTranslations(language as Language).dashboard.widgets.time;

  useEffect(() => {
    fetchFearAndGreed().then(res => {
      if (res && Array.isArray(res)) setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const current = data[0];
  const val = current ? (parseInt(current.value) || 50) : 50;
  const getSarcasticLabel = (v: number) => {
    if (v <= 25) return t.s0; 
    if (v <= 45) return t.s1; 
    if (v <= 55) return t.s2; 
    if (v <= 75) return t.s3; 
    if (v <= 94) return t.s4; 
    return t.s5; 
  };
  const classification = getSarcasticLabel(val);
  const rotation = -90 + (val / 100) * 180;

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full relative overflow-hidden bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all">
      <div className="flex justify-between items-start mb-1 shrink-0">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider truncate">{t.title}</span>
          <WorkspaceLink onClick={onNavigate} />
      </div>
      <div className="flex-1 relative w-full flex justify-center items-end pb-1 overflow-visible">
        <svg viewBox="0 0 200 120" className="w-full h-full overflow-visible">
          <defs><linearGradient id="fngGrad" x1="0" x2="1"><stop offset="0%" stopColor="#CD534B" /><stop offset="50%" stopColor="#FFD700" /><stop offset="100%" stopColor="#548f3f" /></linearGradient></defs>
          <path d="M 35 85 A 65 65 0 0 1 165 85" fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-700" strokeWidth="10" strokeLinecap="round" />
          <path d="M 35 85 A 65 65 0 0 1 165 85" fill="none" stroke="url(#fngGrad)" strokeWidth="10" strokeLinecap="round" />
          <g transform={`rotate(${rotation} 100 85)`}><path d="M 100 85 L 100 25" stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" /><circle cx="100" cy="85" r="5" fill="var(--color-text-main)" /></g>
          <text x="100" y="110" textAnchor="middle" fill="var(--color-gauge-val)" fontSize="26" fontWeight="900" fontFamily="monospace">{val}</text>
          <text x="100" y="125" textAnchor="middle" fill="var(--color-text-main)" fontSize="10" fontWeight="900" className="uppercase">{classification}</text>
        </svg>
      </div>
      <HorizontalHistoryRow labels={[timeT.yesterday, timeT.d7, timeT.d30]} data={[data[1]?.value || '-', data[7]?.value || '-', data[29]?.value || '-']} />
    </div>
  );
};

const LongShortRatioWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [period, setPeriod] = useState('5m');
  const [data, setData] = useState<any>(null);
  const t = getTranslations(language as Language).dashboard.widgets.lsr;

  useEffect(() => {
    fetchLongShortRatio(symbol, period).then(setData).catch(() => setData(null));
  }, [symbol, period]);

  const val = data?.lsr ?? 1;
  const clampedVal = Math.min(Math.max(val, 1), 5);
  const rotation = -90 + ((clampedVal - 1) / 4) * 180;
  
  const GAUGE_CX = 100;
  const GAUGE_CY = 72; // Centro do arco ligeiramente subido
  const R = 50; // Raio mais compacto para dar respiro ao ranking

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all relative overflow-hidden">
        <div className="w-full flex justify-between items-center mb-1 shrink-0 px-1">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-black">{t.title}</span>
            <WorkspaceLink onClick={onNavigate} />
        </div>
        <div className="flex justify-center gap-1 mb-1 shrink-0">
            <select value={symbol} onChange={e => setSymbol(e.target.value)} className="bg-gray-100 dark:bg-tech-900 text-gray-800 dark:text-gray-200 text-[9px] font-black rounded px-1.5 py-0.5 outline-none border border-transparent dark:border-tech-700">
                <option value="BTCUSDT">BTC</option><option value="ETHUSDT">ETH</option><option value="SOLUSDT">SOL</option>
            </select>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-gray-100 dark:bg-tech-900 text-gray-800 dark:text-gray-200 text-[9px] font-black rounded px-1.5 py-0.5 outline-none border border-transparent dark:border-tech-700">
                <option value="5m">5m</option><option value="1h">1h</option><option value="1D">1D</option>
            </select>
        </div>
        <div className="flex-1 relative w-full flex justify-center items-end pb-1 overflow-visible">
            <svg viewBox="0 0 200 105" className="w-full h-full overflow-visible">
                <defs><linearGradient id="lsrGrad" x1="0" x2="1"><stop offset="0%" stopColor="#CD534B" /><stop offset="50%" stopColor="#eab308" /><stop offset="100%" stopColor="#548f3f" /></linearGradient></defs>
                <path d={`M ${GAUGE_CX-R} ${GAUGE_CY} A ${R} ${R} 0 0 1 ${GAUGE_CX+R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-700" strokeWidth="10" strokeLinecap="round" />
                
                {[1, 2, 3, 4, 5].map(v => {
                    const angle = ((v - 1) / 4) * 180;
                    const rad = (angle - 180) * (Math.PI / 180);
                    // Afastado mais o ranking (R+20) do ponteiro
                    const tx = GAUGE_CX + (R + 20) * Math.cos(rad);
                    const ty = GAUGE_CY + (R + 20) * Math.sin(rad);
                    return (
                        <text key={v} x={tx} y={ty} textAnchor="middle" fill="currentColor" className="text-gray-400 font-black" fontSize="8" alignmentBaseline="middle">{v}</text>
                    );
                })}

                <path d={`M ${GAUGE_CX-R} ${GAUGE_CY} A ${R} ${R} 0 0 1 ${GAUGE_CX+R} ${GAUGE_CY}`} fill="none" stroke="url(#lsrGrad)" strokeWidth="10" strokeLinecap="round" />
                
                <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                    <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - R + 5}`} stroke="var(--color-text-main)" strokeWidth="3" strokeLinecap="round" />
                    <circle cx={GAUGE_CX} cy={GAUGE_CY} r="4" fill="var(--color-text-main)" />
                </g>
                <text x={GAUGE_CX} y={GAUGE_CY + 18} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="26" fontWeight="900" fontFamily="monospace">{val.toFixed(2)}</text>
            </svg>
        </div>
        <div className="flex justify-between px-3 pt-1 border-t border-tech-700/50 mt-1 shrink-0 bg-white/5">
            <div className="text-center">
                <div className="text-[7px] text-gray-500 font-black uppercase">Shorts</div>
                <div className="text-xs font-mono font-black text-tech-danger">{data?.shorts ? `${data.shorts.toFixed(1)}%` : '--'}</div>
            </div>
            <div className="text-center">
                <div className="text-[7px] text-gray-500 font-black uppercase">Longs</div>
                <div className="text-xs font-mono font-black text-tech-success">{data?.longs ? `${data.longs.toFixed(1)}%` : '--'}</div>
            </div>
        </div>
    </div>
  );
};

const EtfFlowWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState({ btc: 0, eth: 0, net: 0 });
    const [loading, setLoading] = useState(true);
    const t = getTranslations(language as Language).dashboard.widgets.etf;

    useEffect(() => { 
        setLoading(true);
        fetchEtfFlow().then(res => { 
            // Fix: res object is already mapped from raw response in fetchEtfFlow (api.ts).
            // Using btcValue, ethValue, and netFlow properties directly.
            if(res) {
                setData({ 
                    btc: res.btcValue || 0, 
                    eth: res.ethValue || 0, 
                    net: res.netFlow || 0 
                });
            }
            setLoading(false);
        }).catch(() => setLoading(false)); 
    }, []);

    const formatNet = (v: number) => `$${(Math.abs(v) / 1e6).toFixed(1)}M`;
    
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative overflow-hidden">
            <div className="flex justify-between items-center mb-1 shrink-0 px-1">
                <div className="font-black text-gray-500 dark:text-gray-400 text-[11px] leading-tight uppercase tracking-wider">{t.title}</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            {loading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-tech-accent" /></div>
            ) : (
                <>
                    <div className="flex-1 flex flex-col items-center justify-center py-2 animate-in fade-in zoom-in duration-500">
                        <div className={`text-[11px] font-black uppercase tracking-widest ${data.net >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>{t.netFlow}</div>
                        <div className="flex items-center gap-1">
                            {data.net >= 0 ? <ArrowUp size={28} className="text-tech-success"/> : <ArrowDown size={28} className="text-tech-danger"/>}
                            <span className={`text-3xl font-mono font-black ${data.net >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>{formatNet(data.net)}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 border-t border-tech-700/50 pt-2 shrink-0">
                        <div className="text-center"><div className="text-[8px] text-[#dd9933] font-black uppercase">BTC ETF</div><div className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{(data.btc / 1e6).toFixed(1)}M</div></div>
                        <div className="text-center"><div className="text-[8px] text-[#627eea] font-black uppercase">ETH ETF</div><div className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{(data.eth / 1e6).toFixed(1)}M</div></div>
                    </div>
                </>
            )}
        </div>
    );
};

const GainersLosersWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState({ gainers: [], losers: [] });
    const [tab, setTab] = useState('gainers');
    useEffect(() => { fetchGainersLosers().then(setData).catch(() => {}); }, []);
    const list = tab === 'gainers' ? data.gainers : data.losers;
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 transition-colors overflow-hidden">
            <div className="flex justify-between items-center mb-2 px-1">
                <div className="font-black text-gray-500 dark:text-gray-400 text-[11px] leading-tight uppercase tracking-wider">Top Movers</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            <div className="flex bg-gray-100 dark:bg-tech-900 rounded p-1 mb-2 border border-transparent dark:border-tech-700 shrink-0">
                <button onClick={() => setTab('gainers')} className={`flex-1 py-1 text-[10px] font-black uppercase rounded transition-all ${tab==='gainers'?'bg-tech-success text-white shadow':'text-gray-500'}`}>Gainers</button>
                <button onClick={() => setTab('losers')} className={`flex-1 py-1 text-[10px] font-black uppercase rounded transition-all ${tab==='losers'?'bg-tech-danger text-white shadow':'text-gray-500'}`}>Losers</button>
            </div>
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                {list?.slice(0, 5).map((coin: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors group">
                        <div className="flex items-center gap-3">
                            <img src={coin.image} className="w-7 h-7 rounded-full bg-white p-0.5 border border-gray-100 dark:border-transparent" alt="" />
                            <div className="flex flex-col"><span className="text-base font-black text-gray-900 dark:text-white leading-none group-hover:text-tech-accent uppercase tracking-tighter">{coin.symbol}</span><span className="text-[10px] text-gray-500 font-mono font-bold">${(coin.current_price ?? 0).toFixed(4)}</span></div>
                        </div>
                        <div className={`text-base font-black font-mono ${(coin.price_change_percentage_24h ?? 0) >=0 ?'text-tech-success':'text-tech-danger'}`}>{(coin.price_change_percentage_24h ?? 0).toFixed(2)}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MarketCapWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const t = getTranslations(language as Language).dashboard.widgets.mktcapHistory;

    useEffect(() => {
        fetchMarketCapHistory().then(res => {
            // Mapeamento robusto para evitar quebras de gráfico
            const history = Array.isArray(res) 
                ? (res[0]?.history || res) 
                : (res?.history || []);
            
            if (Array.isArray(history)) setData(history);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const Watermark = () => <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-[0.05] z-0"><img src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" alt="watermark" className="w-3/4 h-auto grayscale filter" /></div>;

    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative overflow-hidden">
            <div className="flex justify-between items-center mb-1 shrink-0 px-1">
                <div className="font-black text-gray-500 dark:text-gray-400 text-[11px] leading-tight uppercase tracking-wider">{t.title}</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            {loading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-tech-accent" /></div>
            ) : (
                <div className="flex-1 relative w-full">
                    <Watermark />
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.slice(-30)}>
                            <defs>
                                <linearGradient id="colorMcap" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="market_cap" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMcap)" strokeWidth={2} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                                itemStyle={{ color: '#fff' }}
                                labelFormatter={(val) => new Date(val).toLocaleDateString()}
                                formatter={(val: number) => [`$${(val/1e12).toFixed(2)}T`, 'Market Cap']}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

const EconomicCalendarWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'USD' | 'BRL'>('ALL');
    const [dateFilter, setDateFilter] = useState<'ALL' | 'YESTERDAY' | 'TODAY' | 'TOMORROW'>('ALL');
    const t = getTranslations(language as Language).dashboard.widgets.calendar;

    useEffect(() => { 
        // Fix: fetchEconomicCalendar is now imported from Workspace services
        fetchEconomicCalendar().then(res => { if(res) setEvents(res); setLoading(false); }).catch(() => setLoading(false)); 
    }, []);

    const filteredEvents = useMemo(() => {
        let list = events.filter(e => filter === 'ALL' || e.country === filter);
        const now = new Date();
        const todayStr = now.toDateString();
        const yesterdayStr = new Date(new Date().setDate(now.getDate() - 1)).toDateString();
        const tomorrowStr = new Date(new Date().setDate(now.getDate() + 1)).toDateString();
        if (dateFilter !== 'ALL') {
            list = list.filter(e => {
                const d = new Date(e.date).toDateString();
                if (dateFilter === 'TODAY') return d === todayStr;
                if (dateFilter === 'YESTERDAY') return d === yesterdayStr;
                if (dateFilter === 'TOMORROW') return d === tomorrowStr;
                return true;
            });
        }
        return list.slice(0, 15);
    }, [events, filter, dateFilter]);

    const getImpactColor = (imp: string) => imp === 'High' ? 'bg-tech-danger' : imp === 'Medium' ? 'bg-orange-500' : 'bg-yellow-500';
    const getFlag = (c: string) => c === 'BRL' ? "https://hatscripts.github.io/circle-flags/flags/br.svg" : "https://hatscripts.github.io/circle-flags/flags/us.svg";

    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 overflow-hidden">
             <div className="flex justify-between items-center mb-2 px-1">
                <div className="font-black text-[11px] leading-tight uppercase tracking-wider text-gray-500 dark:text-gray-400">{t.title}</div>
                <div className="flex items-center gap-3">
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="bg-gray-100 dark:bg-tech-900 text-gray-700 dark:text-gray-300 text-[10px] font-black uppercase rounded px-2 py-1 border-none outline-none">
                        <option value="ALL">ALL</option>
                        <option value="YESTERDAY">{t.yesterday}</option>
                        <option value="TODAY">{t.today}</option>
                        <option value="TOMORROW">{t.tomorrow}</option>
                    </select>
                    <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-tech-700 pl-3">
                        <button onClick={() => setFilter('BRL')} className={`transition-all ${filter==='BRL'?'ring-2 ring-[#dd9933] rounded-full':'opacity-40 grayscale'}`}><img src={getFlag('BRL')} className="w-5 h-5 rounded-full" /></button>
                        <button onClick={() => setFilter('USD')} className={`transition-all ${filter==='USD'?'ring-2 ring-[#dd9933] rounded-full':'opacity-40 grayscale'}`}><img src={getFlag('USD')} className="w-5 h-5 rounded-full" /></button>
                    </div>
                    <WorkspaceLink onClick={onNavigate} />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                 {loading ? <div className="animate-pulse h-full bg-black/5 dark:bg-white/5 rounded" /> : filteredEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors group">
                        <div className="w-20 flex flex-col shrink-0 text-center">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-200 leading-none">{new Date(e.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            <span className="text-[11px] font-bold text-gray-500 mt-1">{new Date(e.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className={`w-1 h-8 rounded-full shrink-0 ${getImpactColor(e.impact)}`} />
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                            <img src={getFlag(e.country)} className="w-4 h-4 rounded-full shadow-sm" />
                            <span className="text-base font-bold text-gray-800 dark:text-gray-200 truncate leading-none uppercase">{e.title}</span>
                        </div>
                        <div className="w-[180px] grid grid-cols-3 gap-2 shrink-0 text-right">
                            <span className="text-sm font-mono font-bold text-gray-500">{e.previous || '--'}</span>
                            <span className="text-sm font-mono font-bold text-[#dd9933]">{e.forecast || '--'}</span>
                            <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">--</span>
                        </div>
                    </div>
                 ))}
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onPostClick, language, setView, theme }) => {
  const [showStats, setShowStats] = useState(true);
  const navigateToWorkspace = () => setView(ViewMode.WORKSPACE);

  return (
    <div className="w-full flex-1 flex flex-col transition-colors duration-700 pb-20">
      <div className="container mx-auto px-4 mt-6">
        <div className="flex items-center justify-center mb-6">
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
            <div className="flex items-center gap-4 px-4 py-1 bg-tech-800 border border-tech-700 rounded-lg shadow-xl">
               <button onClick={() => setView(ViewMode.WORKSPACE)} className="text-gray-900 dark:text-[#dd9933] hover:text-[#dd9933] font-black tracking-[0.2em] text-lg uppercase flex items-center gap-2">
                   ANALYTICS WORKSPACE <LayoutDashboard size={16} />
               </button>
               <div className="w-px h-4 bg-tech-600/50"></div>
               <button onClick={() => setShowStats(!showStats)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-[#dd9933]">
                    {showStats ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
            </div>
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
        </div>

        {showStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-[repeat(7,minmax(0,1fr))] gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="h-[210px]"><FearAndGreedWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[210px]"><div className="h-full w-full rounded-xl overflow-hidden"><CryptoWidget item={{ id: 'rsi-dash', type: WidgetType.RSI_AVG, title: 'RSI Average', symbol: 'MARKET', isMaximized: false }} language={language} /></div></div>
                <div className="h-[210px]"><LongShortRatioWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[210px]"><div className="h-full w-full rounded-xl overflow-hidden"><CryptoWidget item={{ id: 'alt-dash', type: WidgetType.ALTCOIN_SEASON, title: 'Altcoin Season', symbol: 'GLOBAL', isMaximized: false }} language={language} /></div></div>
                <div className="h-[210px]"><MarketCapHistoryWidget language={language} onNavigate={navigateToWorkspace} theme={theme} /></div>
                <div className="h-[210px]"><EtfFlowWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[210px]"><div className="h-full w-full rounded-xl overflow-hidden"><CryptoWidget item={{ id: 'trump-dash', type: WidgetType.TRUMP_METER, title: 'Trump-o-Meter', symbol: 'SENTIMENT', isMaximized: false }} language={language} /></div></div>
                
                <div className="h-[320px] md:col-span-1 xl:col-span-2"><GainersLosersWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[320px] md:col-span-2 xl:col-span-2"><MarketCapWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[320px] md:col-span-3 xl:col-span-3"><EconomicCalendarWidget language={language} onNavigate={navigateToWorkspace} /></div>
            </div>
        )}
      </div>

      <div className="container mx-auto px-4 mt-16 flex flex-col">
        <div className="flex items-center justify-center mb-8">
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
            <div className="px-6 py-2 bg-tech-800 border border-tech-700 rounded-lg shadow-xl"><h2 className="text-gray-900 dark:text-[#dd9933] font-black tracking-[0.2em] text-lg uppercase">CENTRAL MAGAZINE</h2></div>
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
        </div>
        <div className="flex flex-col gap-5">
            <div className="min-h-[100px]"><MagazineTicker onPostClick={onPostClick} /></div>
            <div className="min-h-[600px]"><NewsGrid onPostClick={onPostClick} language={language} /></div>
            <div className="w-full"><NewsFeed onPostClick={onPostClick} language={language} /></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
