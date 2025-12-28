
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
    fetchEconomicCalendar,
    fetchFearAndGreed
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

const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "", language = 'pt' }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(payload[0].payload.date || payload[0].payload.timestamp || label);
    const dayName = date.toLocaleDateString(language, { weekday: 'long' });
    const fullDate = date.toLocaleDateString(language, { day: '2-digit', month: 'short', year: 'numeric' });
    
    return (
      <div className="bg-white dark:bg-[#1e2022] border border-gray-200 dark:border-tech-700 p-4 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] font-sans min-w-[180px]">
        <p className="text-[10px] text-[#dd9933] font-black uppercase tracking-[0.2em] mb-1">{dayName}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mb-3 border-b border-gray-100 dark:border-white/5 pb-2 uppercase tracking-widest">{fullDate}</p>
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tech-success"></div>
            <p className="text-base font-black text-gray-900 dark:text-white font-mono">{prefix}{payload[0].value.toLocaleString()}{suffix}</p>
        </div>
      </div>
    );
  }
  return null;
};

const HorizontalHistoryRow = ({ data, labels }: { data: (string | number)[], labels: string[] }) => (
  <div className="flex justify-between pt-1 px-1 text-center border-t border-tech-700/50 mt-1 w-full">
      {labels.map((label, i) => (
          <div key={label}>
              <div className="text-[9px] text-gray-500 font-bold uppercase">{label}</div>
              <div className="text-sm font-bold text-gray-400 dark:text-gray-300 font-mono">{data[i] !== undefined ? data[i] : '-'}</div>
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
    return v >= 1e12 ? `$${(v/1e12).toFixed(2)}T` : `$${(v/1e9).toFixed(2)}B`;
  };

  const strokeColor = theme === 'dark' ? '#548f3f' : '#1a1c1e';
  const fillColor = theme === 'dark' ? '#548f3f' : '#1a1c1e';

  // Processamento simplificado dos pontos para evitar "NADA" na tela
  const chartPoints = useMemo(() => {
    const rawData = Array.isArray(data) ? data[0] : data;
    const history = rawData?.history || [];
    if (!Array.isArray(history) || history.length === 0) return [];
    
    return history.map((val: number, i: number) => {
        const d = new Date();
        d.setDate(d.getDate() - (history.length - 1 - i));
        return { date: d.getTime(), value: val };
    });
  }, [data]);

  const rawData = Array.isArray(data) ? data[0] : data;

  return (
    <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative overflow-hidden transition-all duration-700">
      <div className="shrink-0 flex justify-between items-start mb-1">
        <div className="flex flex-col"><span className="font-black text-[11px] leading-tight text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.title}</span><span className="text-[10px] font-bold text-gray-600 dark:text-gray-200">Global</span></div>
        <div className="text-right flex items-start gap-2"><span className="text-lg font-bold text-tech-accent font-mono">{rawData ? formatVal(rawData.current || rawData.history?.slice(-1)[0]) : '---'}</span><WorkspaceLink onClick={onNavigate} /></div>
      </div>
      <div className="relative flex-1 bg-white/50 dark:bg-black/40 rounded-lg mb-1 overflow-hidden min-h-[110px] w-full">
        {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#dd9933]" size={16} /></div>
        ) : chartPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartPoints}>
                    <defs><linearGradient id="colorMkt" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={fillColor} stopOpacity={0.3}/><stop offset="95%" stopColor={fillColor} stopOpacity={0}/></linearGradient></defs>
                    <Tooltip content={<CustomTooltip language={language} prefix="$" />} cursor={{ stroke: strokeColor, strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="value" stroke={strokeColor} fill="url(#colorMkt)" strokeWidth={2} dot={false} isAnimationActive={true} />
                </AreaChart>
            </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-500 italic uppercase">Sem Dados de Histórico</div>
        )}
      </div>
      <HorizontalHistoryRow labels={[t.yesterday, t.week, t.month]} data={[formatVal(rawData?.yesterday), formatVal(rawData?.lastWeek), formatVal(rawData?.lastMonth)]} />
    </div>
  );
};

const GAUGE_CX = 100;
const GAUGE_CY = 75; 
const GAUGE_R = 65;  
const GAUGE_RY = 65; 
const TEXT_VAL_Y = 104; 
const TEXT_LBL_Y = 122; 
const GAUGE_STROKE = 10; 

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
      <div className="flex justify-between items-start absolute top-2 left-2 right-2 z-10">
          <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider truncate">{t.title}</span>
          <WorkspaceLink onClick={onNavigate} />
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500 animate-pulse">Loading...</div>
      ) : (
        <>
           <div className="flex-1 relative w-full flex justify-center items-end pb-1 mt-4">
             <svg viewBox="0 0 200 135" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
               <defs>
                 <linearGradient id="fngGradient" x1="0" y1="0" x2="1" y2="0">
                   <stop offset="0%" stopColor="#CD534B" />
                   <stop offset="50%" stopColor="#FFD700" />
                   <stop offset="100%" stopColor="#548f3f" />
                 </linearGradient>
               </defs>
               <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-700" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
               <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="url(#fngGradient)" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
               <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                 <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                 <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
               </g>
               <text x={GAUGE_CX} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="24" fontWeight="900" fontFamily="monospace">{val}</text>
               <text x={GAUGE_CX} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-main)" fontSize="12" fontWeight="900" letterSpacing="1" style={{ textTransform: 'uppercase' }}>{classification}</text>
             </svg>
           </div>
           <HorizontalHistoryRow 
             labels={[timeT.yesterday, timeT.d7, timeT.d30]} 
             data={[data[1]?.value || '-', data[7]?.value || '-', data[29]?.value || '-']} 
           />
        </>
      )}
    </div>
  );
};

const RsiWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState({ averageRsi: 50, yesterday: 50, days7Ago: 50, days30Ago: 50 });
  const [loading, setLoading] = useState(true);
  const timeT = getTranslations(language).dashboard.widgets.time;
  const t = getTranslations(language).dashboard.widgets.rsi;

  useEffect(() => {
    fetchRsiAverage().then(res => { if(res) setData(res); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const rsiVal = data.averageRsi ?? 50;
  const rotation = -90 + (rsiVal / 100) * 180;
  const label = rsiVal < 30 ? t.oversold : rsiVal > 70 ? t.overbought : t.neutral;

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full relative overflow-hidden bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all">
      <div className="flex justify-between items-start absolute top-2 left-2 right-2 z-10">
          <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider truncate">RSI Tracker</span>
          <WorkspaceLink onClick={onNavigate} />
      </div>
      {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-500 animate-pulse">Loading...</div>
      ) : (
      <>
          <div className="flex-1 relative w-full flex justify-center items-end pb-1 mt-4">
            <svg viewBox="0 0 200 125" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
              <defs>
                <linearGradient id="rsiGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#548f3f" />
                  <stop offset="50%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#CD534B" />
                </linearGradient>
              </defs>
              <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-700" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
              <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="url(#rsiGradient)" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
              <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
              </g>
              <text x={GAUGE_CX} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="24" fontWeight="900" fontFamily="monospace">{(rsiVal).toFixed(0)}</text>
              <text x={GAUGE_CX} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-main)" fontSize="12" fontWeight="900" letterSpacing="1" className="uppercase">{label}</text>
            </svg>
          </div>
          <HorizontalHistoryRow labels={[timeT.yesterday, timeT.d7, timeT.d30]} data={[(data.yesterday ?? 0).toFixed(0), (data.days7Ago ?? 0).toFixed(0), (data.days30Ago ?? 0).toFixed(0)]} />
      </>
      )}
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
  const label = val > 1.1 ? t.longs : val < 0.9 ? t.shorts : t.neutral;

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all relative">
        <div className="w-full flex justify-between items-center mb-1">
            <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400 uppercase tracking-wider font-black ml-1">{t.title}</span>
            <WorkspaceLink onClick={onNavigate} />
        </div>
        <div className="flex justify-center gap-1 mb-1">
            <select value={symbol} onChange={e => setSymbol(e.target.value)} className="bg-gray-100 dark:bg-tech-900 text-gray-800 dark:text-gray-200 text-sm font-bold rounded px-2 py-1 border border-transparent dark:border-tech-700 outline-none">
                <option value="BTCUSDT">BTC</option><option value="ETHUSDT">ETH</option><option value="SOLUSDT">SOL</option>
            </select>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-gray-100 dark:bg-tech-900 text-gray-800 dark:text-gray-200 text-sm font-bold rounded px-2 py-1 border border-transparent dark:border-tech-700 outline-none">
                <option value="5m">5m</option><option value="1h">1h</option><option value="1D">1D</option>
            </select>
        </div>
        <div className="flex-1 relative w-full flex justify-center items-end pb-1">
            <svg viewBox="0 0 200 135" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
                <defs><linearGradient id="lsrGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#CD534B" /><stop offset="50%" stopColor="#eab308" /><stop offset="100%" stopColor="#548f3f" /></linearGradient></defs>
                <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-700" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
                
                {[1, 2, 3, 4, 5].map(v => {
                    const angle = ((v - 1) / 4) * 180;
                    const rad = (angle - 180) * (Math.PI / 180);
                    const tx = GAUGE_CX + (GAUGE_R + 12) * Math.cos(rad);
                    const ty = GAUGE_CY + (GAUGE_R + 12) * Math.sin(rad);
                    return (
                        <text key={v} x={tx} y={ty} textAnchor="middle" fill="currentColor" className="text-gray-500 font-black" fontSize="9">{v}</text>
                    );
                })}

                <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="url(#lsrGradient)" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
                
                <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                    <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                    <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
                </g>
                <text x={GAUGE_CX} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="24" fontWeight="900" fontFamily="monospace">{val.toFixed(2)}</text>
                <text x={GAUGE_CX} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-main)" fontSize="12" fontWeight="900" letterSpacing="1" className="uppercase">{label}</text>
            </svg>
        </div>
    </div>
  );
};

const AltSeasonWidget = ({ language, onNavigate, theme }: { language: Language; onNavigate: () => void; theme: 'dark' | 'light' }) => {
  const [data, setData] = useState({ index: 0, yesterday: 0, lastWeek: 0, lastMonth: 0, history: [] });
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language as Language).dashboard.widgets.altseason;

  useEffect(() => {
    Promise.all([fetchAltcoinSeason(), fetchAltcoinSeasonHistory()]).then(([curr, hist]) => {
      if (curr) {
          const mappedHist = (hist || []).map(p => ({
              date: p.timestamp * 1000,
              value: p.altcoinIndex
          }));
          setData({ ...curr, history: mappedHist as any });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const strokeColor = theme === 'dark' ? '#dd9933' : '#1a1c1e';

  return (
    <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative">
      <div className="shrink-0 flex justify-between items-start mb-1">
        <div className="flex flex-col"><span className="font-black text-[11px] leading-tight text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.title}</span><span className="text-[10px] font-bold text-gray-600 dark:text-gray-200">Index</span></div>
        <div className="text-right flex items-start gap-2"><span className="text-2xl font-bold text-gray-800 dark:text-gray-200 font-mono">{data.index ?? 0}</span><WorkspaceLink onClick={onNavigate} /></div>
      </div>
      <div className="relative flex-1 bg-white/50 dark:bg-black/40 rounded-lg mb-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.history} margin={{top:5, right:5, left:5, bottom:5}}>
                {/* TOOLTIP REMOVIDO PARA DASHBOARD CONFORME SOLICITADO */}
                <Line type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={1} dot={false} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
      </div>
      <HorizontalHistoryRow labels={[t.yesterday, t.week, t.month]} data={[data.yesterday ?? '-', data.lastWeek ?? '-', data.lastMonth ?? '-']} />
    </div>
  );
};

const EtfFlowWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState({ btc: 0, eth: 0, net: 0 });
    const t = getTranslations(language as Language).dashboard.widgets.etf;
    useEffect(() => { fetchEtfFlow().then(res => { if(res) setData({ btc: res.btcValue, eth: res.ethValue, net: res.btcValue + res.ethValue }); }).catch(() => {}); }, []);
    const formatNet = (v: number) => `$${(Math.abs(v) / 1e6).toFixed(1)}M`;
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative">
            <div className="flex justify-between items-center mb-1">
                <div className="font-black text-gray-500 dark:text-gray-400 text-[11px] leading-tight uppercase tracking-wider">{t.title}</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            <div className="flex-1 flex-col flex items-center justify-center py-2">
                <div className={`text-[11px] font-black uppercase tracking-widest ${data.net >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>{t.netFlow}</div>
                <div className="flex items-center gap-1">
                    {data.net >= 0 ? <ArrowUp size={24} className="text-tech-success"/> : <ArrowDown size={24} className="text-tech-danger"/>}
                    <span className={`text-2xl font-mono font-black ${data.net >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>{formatNet(data.net)}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-1 border-t border-tech-700/50 pt-2">
                <div className="text-center"><div className="text-[9px] text-[#dd9933] font-black uppercase">BTC ETF</div><div className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{(data.btc / 1e6).toFixed(1)}M</div></div>
                <div className="text-center"><div className="text-[9px] text-[#627eea] font-black uppercase">ETH ETF</div><div className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{(data.eth / 1e6).toFixed(1)}M</div></div>
            </div>
        </div>
    );
};

const TrumpOMeterWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState<TrumpData | null>(null);
    const t = getTranslations(language as Language).dashboard.widgets.trump;
    useEffect(() => { fetchTrumpData().then(setData).catch(() => setData(null)); }, []);
    
    if (!data) return <div className="glass-panel p-4 rounded-xl h-full animate-pulse bg-tech-800 border-tech-700" />;
    
    const score = data.trump_rank_50 || 0;
    const percent = ((score + 50) / 100) * 100;
    const impactColor = percent > 60 ? '#009E4F' : percent < 40 ? '#E03A3E' : '#dd9933';
    const ticks = [-50, -30, -15, 0, 15, 30, 50];

    const getTickColor = (tick: number) => {
        if (tick <= -30) return '#E03A3E';
        if (tick < 0) return '#eda05d';
        if (tick === 0) return '#FFD700';
        if (tick <= 30) return '#a4bd29';
        return '#009E4F';
    };

    return (
        <div className="glass-panel p-2 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative overflow-hidden">
            <div className="flex justify-between items-start mb-1 shrink-0">
                <div className="text-left font-black text-[11px] leading-tight uppercase tracking-wider text-gray-500 dark:text-gray-400">{t.title}</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            <div className="flex-1 flex flex-col justify-center px-2">
                <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-[#E03A3E] via-yellow-500 to-[#009E4F] mt-4">
                    <div className="absolute top-[-8px] transition-all duration-700 ease-out z-20" style={{ left: `calc(${percent}% - 6px)` }}>
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-gray-800 dark:border-t-white drop-shadow-md"></div>
                    </div>
                </div>
                <div className="relative h-4 w-full mt-1 flex justify-between px-0.5">
                    {ticks.map(tick => {
                        const isHighlighted = Math.abs(score - tick) < 8;
                        return (
                            <span key={tick} className={`text-[8px] font-black font-mono transition-all duration-500 ${isHighlighted ? 'scale-125' : 'opacity-40'}`} style={{ color: getTickColor(tick) }}>
                                {tick > 0 ? '+' : ''}{tick}
                            </span>
                        );
                    })}
                </div>
                <div className="text-center mt-2 mb-1 shrink-0 text-[10px] font-black uppercase tracking-tighter" style={{ color: impactColor }}>{data.sarcastic_label}</div>
            </div>
            <div 
                className="flex-1 flex flex-col border-2 border-dashed rounded-lg p-1.5 bg-black/5 dark:bg-black/10 min-h-0 overflow-hidden group/post relative" 
                style={{ borderColor: impactColor }}
            >
                <p className="text-[10px] text-gray-700 dark:text-gray-300 font-bold line-clamp-3 italic leading-snug">"{data.title}"</p>
                <div className="absolute inset-0 bg-white dark:bg-[#1a1c1e] opacity-0 group-hover/post:opacity-100 transition-all p-3 overflow-y-auto custom-scrollbar z-[60] shadow-2xl border border-tech-700 rounded-lg translate-y-2 group-hover/post:translate-y-0">
                    <div className="flex items-center gap-2 mb-2 border-b border-gray-100 dark:border-white/5 pb-2">
                        <img src="https://static-assets-1.truthsocial.com/tmtg:prime-ts-assets/accounts/avatars/107/780/257/626/128/497/original/454286ac07a6f6e6.jpeg" className="w-5 h-5 rounded-full" alt="Trump" />
                        <span className="text-[9px] font-black text-[#dd9933] uppercase tracking-widest">Trump Social Intelligence</span>
                    </div>
                    <p className="text-[11px] font-medium text-gray-800 dark:text-gray-200 leading-relaxed italic">"{data.title}"</p>
                </div>
            </div>
        </div>
    );
};

const GainersLosersWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [data, setData] = useState({ gainers: [], losers: [] });
    const [tab, setTab] = useState('gainers');
    const t = getTranslations(language as Language).dashboard.widgets.gainers;
    useEffect(() => { fetchGainersLosers().then(setData).catch(() => {}); }, []);
    const list = tab === 'gainers' ? data.gainers : data.losers;
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 transition-colors">
            <div className="flex bg-gray-100 dark:bg-tech-900 rounded p-1 mb-2 border border-transparent dark:border-tech-700">
                <button onClick={() => setTab('gainers')} className={`flex-1 py-1 text-sm font-black uppercase rounded transition-all ${tab==='gainers'?'bg-tech-success text-white shadow':'text-gray-500'}`}>{t.gainers}</button>
                <button onClick={() => setTab('losers')} className={`flex-1 py-1 text-sm font-black uppercase rounded transition-all ${tab==='losers'?'bg-tech-danger text-white shadow':'text-gray-500'}`}>{t.losers}</button>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                {list?.slice(0, 10).map((coin: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors group">
                        <div className="flex items-center gap-3">
                            <img src={coin.image} className="w-7 h-7 rounded-full bg-white p-0.5 border border-gray-100 dark:border-transparent" alt="" />
                            <div className="flex flex-col"><span className="text-lg font-black text-gray-900 dark:text-white leading-none group-hover:text-tech-accent">{coin.symbol?.toUpperCase()}</span><span className="text-[11px] text-gray-500 font-mono font-bold">${(coin.current_price ?? 0).toFixed(4)}</span></div>
                        </div>
                        <div className={`text-lg font-black font-mono ${(coin.price_change_percentage_24h ?? 0) >=0 ?'text-tech-success':'text-tech-danger'}`}>{(coin.price_change_percentage_24h ?? 0).toFixed(2)}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MarketCapWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [list, setList] = useState<any[]>([]);
    useEffect(() => { fetchTopCoins().then(data => setList(data.slice(0, 10))).catch(() => {}); }, []);
    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 transition-colors">
            <div className="flex justify-between items-center mb-2">
                <div className="font-black text-gray-500 dark:text-gray-400 text-[11px] leading-tight uppercase tracking-wider">TOP 10 MARKET CAP</div>
                <WorkspaceLink onClick={onNavigate} />
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                {list.map((coin, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors group">
                        <div className="flex items-center gap-3">
                            <img src={coin.image} className="w-7 h-7 rounded-full bg-white p-0.5 border border-gray-100 dark:border-transparent" alt="" />
                            <div className="flex flex-col"><span className="text-lg font-black text-gray-900 dark:text-white leading-none group-hover:text-tech-accent">{coin.name}</span><span className="text-[11px] font-bold text-gray-500 uppercase">{coin.symbol}</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-black text-gray-900 dark:text-white font-mono leading-none">${(coin.current_price ?? 0).toLocaleString()}</div>
                            <div className={`text-[11px] font-black font-mono ${(coin.price_change_percentage_24h ?? 0) >= 0 ? 'text-tech-success' : 'text-tech-danger'}`}>{(coin.price_change_percentage_24h ?? 0).toFixed(2)}%</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const EconomicCalendarWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'USD' | 'BRL'>('ALL');
    const t = getTranslations(language as Language).dashboard.widgets.calendar;

    useEffect(() => { 
        fetchEconomicCalendar().then(res => { 
            if(res) setEvents(res); 
            setLoading(false); 
        }).catch(() => setLoading(false)); 
    }, []);

    const filteredEvents = events.filter(e => filter === 'ALL' || e.country === filter).slice(0, 15);
    const getImpactColor = (imp: string) => imp === 'High' ? 'bg-tech-danger' : imp === 'Medium' ? 'bg-orange-500' : 'bg-yellow-500';
    const getFlag = (c: string) => c === 'BRL' ? "https://hatscripts.github.io/circle-flags/flags/br.svg" : "https://hatscripts.github.io/circle-flags/flags/us.svg";

    return (
        <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700">
             <div className="flex justify-between items-center mb-2">
                <div className="font-black text-[11px] leading-tight uppercase tracking-wider text-gray-500 dark:text-gray-400">{t.title}</div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setFilter('BRL')} className={`transition-all ${filter==='BRL'?'ring-2 ring-[#dd9933] rounded-full':'opacity-40 grayscale'}`}><img src={getFlag('BRL')} className="w-5 h-5 rounded-full" /></button>
                        <button onClick={() => setFilter('USD')} className={`transition-all ${filter==='USD'?'ring-2 ring-[#dd9933] rounded-full':'opacity-40 grayscale'}`}><img src={getFlag('USD')} className="w-5 h-5 rounded-full" /></button>
                        <button onClick={() => setFilter('ALL')} className={`text-[10px] font-black uppercase ${filter==='ALL'?'text-[#dd9933]':'text-gray-500'}`}>ALL</button>
                    </div>
                    <WorkspaceLink onClick={onNavigate} />
                </div>
            </div>
            
            <div className="grid grid-cols-[80px_2px_1fr_180px] gap-3 px-2 py-1 mb-1 border-b border-gray-200 dark:border-white/10 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                <span>Horário</span><span></span><span>Evento</span>
                <div className="grid grid-cols-3 gap-2 text-right">
                    <span>{t.previous}</span><span>{t.forecast}</span><span>{t.actual}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                 {loading ? <div className="animate-pulse h-20 bg-black/5 dark:bg-white/5 rounded" /> : filteredEvents.map((e, i) => {
                    const date = new Date(e.date);
                    return (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors group">
                            <div className="w-16 flex flex-col shrink-0">
                                <span className="text-base font-black text-gray-900 dark:text-gray-200 leading-none">{date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase">{date.toLocaleDateString([], {day:'2-digit', month:'short'})}</span>
                            </div>
                            <div className={`w-1 h-8 rounded-full shrink-0 ${getImpactColor(e.impact)}`} />
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                <img src={getFlag(e.country)} className="w-4 h-4 rounded-full shadow-sm" />
                                <span className="text-base font-black text-gray-800 dark:text-gray-200 truncate leading-none group-hover:text-[#dd9933] transition-colors uppercase">{e.title}</span>
                            </div>
                            <div className="w-[180px] grid grid-cols-3 gap-2 shrink-0 text-right">
                                <span className="text-xs font-mono font-black text-gray-500">{e.previous || '--'}</span>
                                <span className="text-xs font-mono font-black text-[#dd9933]">{e.forecast || '--'}</span>
                                <span className="text-xs font-mono font-black text-gray-700 dark:text-gray-300">--</span>
                            </div>
                        </div>
                    );
                 })}
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ onPostClick, language = 'pt' as Language, setView, theme }) => {
  const [showStats, setShowStats] = useState(true);
  const t = getTranslations(language).dashboard;
  const navigateToWorkspace = () => setView(ViewMode.WORKSPACE);

  return (
    <div className="w-full flex-1 flex flex-col transition-colors duration-700 pb-20">
      <div className="container mx-auto px-4 mt-6">
        <div className="flex items-center justify-center mb-6">
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
            <div className="flex items-center gap-4 px-4 py-1 bg-tech-800 border border-tech-700 rounded-lg shadow-xl">
               <button onClick={() => setView(ViewMode.WORKSPACE)} className="text-gray-900 dark:text-[#dd9933] hover:text-[#dd9933] transition-colors font-black tracking-[0.2em] text-lg uppercase flex items-center gap-2">
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
                <div className="h-[210px]"><RsiWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[210px]"><LongShortRatioWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[210px]"><AltSeasonWidget language={language} onNavigate={navigateToWorkspace} theme={theme} /></div>
                <div className="h-[210px]"><MarketCapHistoryWidget language={language} onNavigate={navigateToWorkspace} theme={theme} /></div>
                <div className="h-[210px]"><EtfFlowWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[210px]"><TrumpOMeterWidget language={language} onNavigate={navigateToWorkspace} /></div>
                
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
            {/* TICKER DA MAGAZINE GARANTIDO AQUI */}
            <div className="min-h-[100px]"><MagazineTicker onPostClick={onPostClick} /></div>
            <div className="min-h-[600px]"><NewsGrid onPostClick={onPostClick} language={language} /></div>
            <div className="w-full"><NewsFeed onPostClick={onPostClick} language={language} /></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
