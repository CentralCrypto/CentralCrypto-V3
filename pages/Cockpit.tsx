
import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// @ts-ignore
import * as RGL from 'react-grid-layout';
import * as uuidModule from 'uuid';
import { CheckCircle, Loader2, Plus, Save, RotateCcw, Layout as LayoutIcon } from 'lucide-react';
import { DashboardItem, WidgetType, ApiCoin, Language, Layout } from '../types';
import { fetchTopCoins } from './Workspace/services/api';
import GridHeader from './Workspace/components/GridHeader';
import TVChartContainer from './Cockpit/components/TVChartContainer';

// Robust Import handling
// @ts-ignore
const Responsive = RGL.Responsive || (RGL as any).default?.Responsive || (RGL as any).default;
// @ts-ignore
const WidthProvider = RGL.WidthProvider || (RGL as any).default?.WidthProvider;
// @ts-ignore
const uuidv4 = uuidModule.v4 || (uuidModule as any).default?.v4 || (uuidModule as any).default;

// If RGL failed completely, create a dummy component to prevent crash
const ResponsiveGridLayout = WidthProvider ? WidthProvider(Responsive) : (props: any) => <div className="text-red-500 p-4 border border-red-500 rounded">Grid Layout Failed to Load</div>;

const STORAGE_KEY = 'cct-cockpit-layout-v11'; // Nova versão para forçar reset absoluto

const COLS = { lg: 20, md: 10, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 100;

// FORÇAR UM ÚNICO GRID QUE OCUPA TUDO
const INITIAL_LAYOUT: Layout[] = [
    { i: 'main-btc-chart', x: 0, y: 0, w: 20, h: 7, minW: 4, minH: 3 }
];

const INITIAL_ITEMS: DashboardItem[] = [
    { id: 'main-btc-chart', type: WidgetType.TV_CHART, title: 'Bitcoin / USDT (Binance)', symbol: 'BTCUSDT' }
];

interface CockpitProps {
  language: Language;
  theme: 'dark' | 'light';
}

const Cockpit: React.FC<CockpitProps> = ({ language, theme }) => {
  const [items, setItems] = useState<DashboardItem[]>(INITIAL_ITEMS);
  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>({ lg: INITIAL_LAYOUT });
  const [availableCoins, setAvailableCoins] = useState<ApiCoin[]>([]);
  const [selectedCoin, setSelectedCoin] = useState('BTCUSDT');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [layoutVersion, setLayoutVersion] = useState(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
            setItems(parsed.items);
            setLayouts(parsed.layouts || { lg: INITIAL_LAYOUT });
        }
      } catch (e) { 
          console.error("Layout load error", e);
          setItems(INITIAL_ITEMS);
          setLayouts({ lg: INITIAL_LAYOUT });
      }
    }
    
    fetchTopCoins().then(coins => {
        if (coins) setAvailableCoins(coins);
    });
  }, []);

  const handleLayoutChange = (currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    setLayouts(allLayouts);
  };

  const onSave = () => {
    setSaveStatus('saving');
    const state = { items, layouts };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  const onReset = () => {
      if(confirm("Deseja resetar o cockpit para o padrão (BTC Único)?")) {
          setItems(INITIAL_ITEMS);
          setLayouts({ lg: INITIAL_LAYOUT });
          setLayoutVersion(Date.now());
          localStorage.removeItem(STORAGE_KEY);
      }
  };

  const addChart = () => {
      const id = uuidv4();
      const newItem: DashboardItem = {
          id,
          type: WidgetType.TV_CHART,
          title: `${selectedCoin} (Binance)`,
          symbol: selectedCoin
      };
      
      const newItems = [...items, newItem];
      const lgLayout = [...(layouts.lg || [])];
      
      lgLayout.push({ i: id, x: 0, y: 100, w: 10, h: 5, minW: 4, minH: 3 });
      
      setItems(newItems);
      setLayouts({ ...layouts, lg: lgLayout });
  };

  const removeChart = (id: string) => {
      setItems(prev => prev.filter(i => i.id !== id));
      setLayouts(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(k => {
              next[k] = next[k].filter(l => l.i !== id);
          });
          return next;
      });
  };

  const toggleMaximize = (id: string) => {
      setItems(prev => prev.map(i => i.id === id ? { ...i, isMaximized: !i.isMaximized } : i));
  };

  const maximizedItem = items.find(i => i.isMaximized);

  return (
    <div className="min-h-screen bg-[#eeeeee] dark:bg-tech-950 pb-20 relative font-sans text-gray-900 dark:text-slate-100 transition-colors duration-500">
      
      <div className="bg-white dark:bg-[#1a1c1e] border-b border-gray-200 dark:border-slate-700/50 p-2 fixed top-[133px] left-0 right-0 z-[900] shadow-sm transition-colors">
          <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-tech-accent rounded-lg text-white shadow-lg">
                      <LayoutIcon size={18} />
                  </div>
                  <div>
                      <h1 className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Central Cockpit</h1>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase">Binance Direct Data</p>
                  </div>
              </div>

              <div className="flex items-center gap-2">
                  <div className="flex bg-gray-100 dark:bg-[#2f3032] p-1 rounded-lg border border-gray-200 dark:border-slate-700 items-center gap-2">
                      <select 
                        value={selectedCoin} 
                        onChange={e => setSelectedCoin(e.target.value)}
                        className="bg-white dark:bg-[#1a1c1e] text-xs font-bold px-2 py-1.5 rounded outline-none border-none dark:text-white"
                      >
                          {availableCoins.map(c => (
                              <option key={c.id} value={`${c.symbol.toUpperCase()}USDT`}>
                                  {c.symbol.toUpperCase()}USDT
                              </option>
                          ))}
                      </select>
                      <button onClick={addChart} className="flex items-center gap-1 bg-[#dd9933] hover:bg-amber-600 text-black px-3 py-1.5 rounded text-xs font-bold transition-all shadow-md">
                          <Plus size={14}/> Novo Gráfico
                      </button>
                  </div>
                  <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-2"></div>
                  <button onClick={onSave} className="flex items-center gap-1 text-xs font-bold bg-gray-100 dark:bg-[#2f3032] hover:bg-gray-200 dark:hover:bg-[#3f4144] text-gray-600 dark:text-slate-300 px-3 py-1.5 rounded transition-colors">
                      <Save size={14} /> Salvar
                  </button>
                  <button onClick={onReset} className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-slate-500 hover:text-red-500 px-3 py-1.5 rounded transition-colors">
                      <RotateCcw size={14} /> Resetar
                  </button>
              </div>
          </div>
      </div>

      <div className="max-w-[1920px] mx-auto p-4 pt-48 h-full min-h-screen flex flex-col">
          {maximizedItem && (
              <div className="fixed inset-4 top-[140px] z-[9999] bg-white dark:bg-[#1a1c1e] rounded-xl border-2 border-[#dd9933] shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
                  <GridHeader item={maximizedItem} onRemove={() => toggleMaximize(maximizedItem.id)} onToggleMaximize={toggleMaximize} language={language} />
                  <div className="flex-1 p-0 min-h-0 bg-black overflow-hidden relative rounded-b-xl">
                      <TVChartContainer symbol={maximizedItem.symbol} containerId={`max-${maximizedItem.id}`} theme={theme} />
                  </div>
              </div>
          )}

          <ResponsiveGridLayout
              key={layoutVersion}
              className="layout"
              layouts={layouts}
              breakpoints={BREAKPOINTS}
              cols={COLS}
              rowHeight={ROW_HEIGHT}
              draggableHandle=".grid-drag-handle"
              onLayoutChange={handleLayoutChange}
              margin={[16, 16]}
              isDraggable={!maximizedItem}
              isResizable={!maximizedItem}
              compactType="vertical"
          >
              {items.map(item => (
                  <div key={item.id} className="bg-white dark:bg-[#2f3032] rounded-xl border-0 dark:border dark:border-slate-700/50 shadow-md flex flex-col overflow-hidden">
                      <GridHeader item={item} onRemove={removeChart} onToggleMaximize={toggleMaximize} language={language} />
                      <div className="flex-1 min-h-0 bg-black overflow-hidden rounded-b-xl relative">
                          <TVChartContainer symbol={item.symbol} containerId={`chart-${item.id}`} theme={theme} />
                      </div>
                  </div>
              ))}
          </ResponsiveGridLayout>
      </div>
    </div>
  );
};

export default Cockpit;
