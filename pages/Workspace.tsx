
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// @ts-ignore
import { Responsive, WidthProvider } from 'react-grid-layout';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle, Loader2, Lock, Crown, AlertTriangle, X } from 'lucide-react';

import { Dashboard, DashboardItem, WidgetType, DashboardState, UserTier, ApiCoin, Language, Layout } from '../types';
import { createNewDashboard, COLS, ROW_HEIGHT, BREAKPOINTS, AVAILABLE_WIDGETS, TIER_LIMITS, FALLBACK_COINS } from './Workspace/constants';
import { fetchTopCoins } from './Workspace/services/api';

import Toolbar from './Workspace/components/Toolbar';
import GridHeader from './Workspace/components/GridHeader';
import CryptoWidget from './Workspace/components/CryptoWidget';
import IndicatorPage from './Workspace/components/IndicatorPage';

const ResponsiveGridLayout = WidthProvider(Responsive);
const STABLECOINS = ['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'USDE'];
const STORAGE_KEY = 'crypto-workspace-v3';

interface WorkspaceProps {
  language: Language;
}

type WorkspaceMode = 'boards' | 'pages';

const PremiumLockOverlay = () => (
    <div className="absolute inset-0 bg-gray-100/90 dark:bg-[#1a1c1e]/90 backdrop-blur-[2px] z-[60] flex flex-col items-center justify-center p-6 text-center rounded-xl border border-[#dd9933]/30">
        <div className="bg-gradient-to-br from-[#dd9933] to-amber-600 text-white p-4 rounded-full mb-4 shadow-xl shadow-orange-500/20 animate-in zoom-in duration-300">
            <Lock size={28} />
        </div>
        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2 flex items-center gap-2">
            <Crown size={20} className="text-[#dd9933]" fill="currentColor" />
            Faça seu Upgrade!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium max-w-[240px] mb-6 leading-relaxed">
            Desbloqueie o acesso completo a todos os indicadores, gráficos avançados e boards ilimitados.
        </p>
        <button className="bg-[#dd9933] hover:bg-amber-600 text-white font-bold py-2.5 px-8 rounded-lg text-xs uppercase tracking-widest shadow-lg hover:shadow-orange-500/30 transition-all transform hover:scale-105 active:scale-95">
            Liberar Acesso Agora
        </button>
    </div>
);

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, boardName }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, boardName: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-700 w-full max-w-sm rounded-xl shadow-2xl p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={20}/></button>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Excluir Board?</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Tem certeza que deseja excluir <strong>"{boardName}"</strong>? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-lg shadow-red-500/20">
                            Excluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Workspace: React.FC<WorkspaceProps> = ({ language }) => {
  // DEFAULT MODE IS NOW PAGES
  const [mode, setMode] = useState<WorkspaceMode>('pages');

  // Create main board once
  const initialMainRef = useRef<Dashboard | null>(null);
  if (!initialMainRef.current) {
    initialMainRef.current = createNewDashboard('Main Board', false, true);
  }

  const [dashboards, setDashboards] = useState<Dashboard[]>(() => [initialMainRef.current!]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>(() => initialMainRef.current!.id);

  const [userTier, setUserTier] = useState<UserTier>(UserTier.TIER_1);
  const [availableCoins, setAvailableCoins] = useState<ApiCoin[]>([]);
  const [coinMap, setCoinMap] = useState<Record<string, ApiCoin>>({});

  // Grid State
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>({});

  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Layout Version controls the `key` of the Grid. Changing it forces a remount.
  // We ONLY want to change this when switching boards, NOT when updating data.
  const [layoutVersion, setLayoutVersion] = useState(0);

  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<string | null>(null);

  const persistState = useCallback((nextDashboards: Dashboard[], nextActiveId: string, nextTier: UserTier) => {
    const state: DashboardState = {
      dashboards: nextDashboards,
      activeDashboardId: nextActiveId,
      userTier: nextTier,
    };
    // Fix: Remove process.env access or use standard localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, []);

  // Init coins
  useEffect(() => {
    const initData = async () => {
      const coins = await fetchTopCoins();
      if (coins.length > 0) {
        const filteredCoins = coins.filter(c => c && c.symbol && !STABLECOINS.includes(c.symbol.toUpperCase()));
        setAvailableCoins(filteredCoins.slice(0, 100));

        const map: Record<string, ApiCoin> = {};
        coins.forEach(c => { 
          if (c && c.symbol) {
            map[c.symbol.toUpperCase()] = c; 
          }
        });
        setCoinMap(map);
      } else {
        /* Add missing numeric properties required by ApiCoin interface */
        const fallbackApiCoins = FALLBACK_COINS.map(c => ({
          id: c.symbol.toLowerCase(),
          symbol: c.symbol,
          name: c.name,
          current_price: 0,
          price_change_percentage_24h: 0,
          market_cap: 0,
          total_volume: 0,
          image: '',
          ath: 0,
          ath_change_percentage: 0,
          atl: 0,
          atl_change_percentage: 0,
          high_24h: 0,
          low_24h: 0,
        }));
        setAvailableCoins(fallbackApiCoins);
      }
    };
    initData();
  }, []);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as DashboardState;

      if (parsed.dashboards && parsed.dashboards.length > 0) {
        setDashboards(parsed.dashboards);
        setActiveDashboardId(parsed.activeDashboardId || parsed.dashboards[0].id);
        if (parsed.userTier) setUserTier(parsed.userTier);
      } else {
        const main = createNewDashboard('Main Board', false, true);
        setDashboards([main]);
        setActiveDashboardId(main.id);
      }
    } catch {
      setDashboards([initialMainRef.current!]);
      setActiveDashboardId(initialMainRef.current!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If active id becomes invalid, fix via effect
  useEffect(() => {
    if (!dashboards.length) return;
    const exists = dashboards.some(d => d.id === activeDashboardId);
    if (!exists) setActiveDashboardId(dashboards[0].id);
  }, [dashboards, activeDashboardId]);

  // Sync items/layouts ONLY when SWITCHING dashboards
  const prevActiveIdRef = useRef(activeDashboardId);
  
  useEffect(() => {
    // Check if we actually switched boards or if it's initial load
    // We compare with Ref to avoid reacting to dashboard content updates
    const isSwitching = prevActiveIdRef.current !== activeDashboardId || items.length === 0;
    
    if (isSwitching) {
        const active = dashboards.find(d => d.id === activeDashboardId);
        if (active) {
            const safeItems = (active.items || []).map(i => ({ ...i, isMaximized: false }));
            setItems(safeItems);
            setLayouts(active.layouts || {});
            // Only force remount grid when switching boards to prevent freezing
            setLayoutVersion(Date.now());
        }
        prevActiveIdRef.current = activeDashboardId;
    }
  }, [activeDashboardId, dashboards]);

  const commitCurrentState = useCallback(() => {
    setDashboards(prev =>
      prev.map(d =>
        d.id === activeDashboardId ? { ...d, items, layouts, lastUpdated: Date.now() } : d
      )
    );
  }, [activeDashboardId, items, layouts]);

  const handleLayoutChange = (currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (items.some(i => i.isMaximized)) return;
    if (activeFilter !== 'ALL') return;

    // Update local layout state immediately for smooth dragging
    setLayouts(allLayouts);

    // Update dashboard state for persistence, BUT DO NOT trigger a layoutVersion change
    // This prevents the grid from unmounting/remounting (which caused the freezing)
    setDashboards(prev =>
      prev.map(d => (d.id === activeDashboardId ? { ...d, layouts: allLayouts, lastUpdated: Date.now() } : d))
    );
  };

  const saveDashboard = () => {
    commitCurrentState();
    setSaveStatus('saving');

    setTimeout(() => {
      try {
        setDashboards(currentDashboards => {
          const nextDashboards = currentDashboards.map(d =>
            d.id === activeDashboardId ? { ...d, items, layouts } : d
          );
          persistState(nextDashboards, activeDashboardId, userTier);
          return nextDashboards;
        });

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
        alert('Failed to save layout.');
      }
    }, 600);
  };

  const resetDashboard = () => {
    const activeIdx = dashboards.findIndex(d => d.id === activeDashboardId);
    if (activeIdx === -1) return;

    const currentDash = dashboards[activeIdx];
    const isMain = Boolean((currentDash as any).isLocked) || activeIdx === 0;

    const freshDash = createNewDashboard(currentDash.name, !isMain, isMain);
    freshDash.id = currentDash.id;

    const updatedDashboards = [...dashboards];
    updatedDashboards[activeIdx] = freshDash;

    setDashboards(updatedDashboards);
    setItems(freshDash.items || []);
    setLayouts(freshDash.layouts || {});
    setLayoutVersion(Date.now());

    persistState(updatedDashboards, activeDashboardId, userTier);
  };

  const addDashboard = () => {
    const limit = TIER_LIMITS[userTier];
    if (dashboards.length >= limit) {
      alert(`Upgrade para Tier ${userTier === 'TIER_1' ? '2' : '3'} para criar mais boards. Limite atual: ${limit} (incluindo Main Board).`);
      return;
    }

    commitCurrentState();

    const newDash = createNewDashboard(`Board ${dashboards.length + 1}`, true);
    const nextDashboards = [...dashboards, newDash];

    setDashboards(nextDashboards);
    setActiveDashboardId(newDash.id);
    setMode('boards');

    persistState(nextDashboards, newDash.id, userTier);
  };

  const requestDeleteDashboard = (idToDelete: string) => {
      const board = dashboards.find(d => d.id === idToDelete);
      if (!board) return;
      if (board.isLocked) {
          alert("O Main Board não pode ser excluído.");
          return;
      }
      setBoardToDelete(idToDelete);
      setShowDeleteModal(true);
  };

  const confirmDeleteDashboard = () => {
    if (!boardToDelete) return;

    // 1. Determine new active ID
    let newActiveId = activeDashboardId;
    if (activeDashboardId === boardToDelete) {
        const mainBoard = dashboards.find(d => d.isLocked) || dashboards[0];
        newActiveId = mainBoard.id;
    }

    // 2. Filter out
    const newDashboards = dashboards.filter(d => d.id !== boardToDelete);

    // 3. Update State
    setDashboards(newDashboards);
    setActiveDashboardId(newActiveId);
    
    // Force reload items if switched
    if (newActiveId !== activeDashboardId) {
        const nextBoard = newDashboards.find(d => d.id === newActiveId);
        if (nextBoard) {
            setItems(nextBoard.items);
            setLayouts(nextBoard.layouts);
            setLayoutVersion(Date.now());
        }
    }

    // 4. Persist & Cleanup
    persistState(newDashboards, newActiveId, userTier);
    setShowDeleteModal(false);
    setBoardToDelete(null);
  };

  const renameDashboard = (id: string, newName: string) => {
    setDashboards(prev => {
      const next = prev.map(d => (d.id === id ? { ...d, name: newName } : d));
      persistState(next, activeDashboardId, userTier);
      return next;
    });
  };

  const addWidget = (type: WidgetType, symbol: string) => {
    if (dashboards[0]?.id === activeDashboardId) return;

    const id = uuidv4();
    const widgetDef = AVAILABLE_WIDGETS.find(w => w.type === type);

    const currentLayout = layouts[currentBreakpoint] || [];
    const maxCols = COLS[currentBreakpoint as keyof typeof COLS] || 12;

    const w = 3;
    const h = 3;
    let x = 0;
    let y = 0;

    if (currentLayout.length > 0) {
      const sortedByY = [...currentLayout].sort((a, b) => b.y - a.y || b.x - a.x);
      const lastItem = sortedByY[0];
      if (lastItem.x + lastItem.w + w <= maxCols) {
        x = lastItem.x + lastItem.w;
        y = lastItem.y;
      } else {
        x = 0;
        y = lastItem.y + lastItem.h;
      }
    }

    const newItem: DashboardItem = { id, type, title: widgetDef?.label || 'Widget', symbol, isMaximized: false };
    const newItems = [...items, newItem];
    const newLayouts = {
      ...layouts,
      [currentBreakpoint]: [...currentLayout, { i: id, x, y, w, h, minW: 2, minH: 2 }],
    };

    setItems(newItems);
    setLayouts(newLayouts);

    setDashboards(prev => prev.map(d =>
      d.id === activeDashboardId ? { ...d, items: newItems, layouts: newLayouts, lastUpdated: Date.now() } : d
    ));
  };

  const removeWidget = (id: string) => {
    const newItems = items.filter(item => item.id !== id);

    const newLayouts = { ...layouts };
    Object.keys(newLayouts).forEach(bp => {
      newLayouts[bp] = newLayouts[bp].filter(l => l.i !== id);
    });

    setItems(newItems);
    setLayouts(newLayouts);

    setDashboards(prev => prev.map(d =>
      d.id === activeDashboardId ? { ...d, items: newItems, layouts: newLayouts, lastUpdated: Date.now() } : d
    ));
  };

  const toggleMaximize = useCallback((id: string) => {
    setItems(currentItems =>
      currentItems.map(item => (item.id === id ? { ...item, isMaximized: !item.isMaximized } : item))
    );
  }, []);

  const maximizedItem = items.find(i => i.isMaximized);

  const filteredItems = useMemo(() => {
    return items.filter(item => activeFilter === 'ALL' || item.symbol === activeFilter);
  }, [items, activeFilter]);

  const displayLayouts = useMemo(() => {
    if (activeFilter === 'ALL') return layouts;

    const cols = COLS[currentBreakpoint as keyof typeof COLS] || 12;
    const refLayout = layouts[currentBreakpoint] || layouts['lg'] || [];

    let x = 0;
    let y = 0;
    let rowHeight = 0;

    const packedLayout = filteredItems.map((item) => {
      const original = refLayout.find(l => l.i === item.id) || { w: 5, h: 3 };
      const w = original.w;
      const h = original.h;

      if (x + w > cols) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }

      const layoutItem = { i: item.id, x, y, w, h, minW: 2, minH: 2 };
      x += w;
      rowHeight = Math.max(rowHeight, h);

      return layoutItem;
    });

    return { ...layouts, [currentBreakpoint]: packedLayout };
  }, [activeFilter, filteredItems, layouts, currentBreakpoint]);

  return (
    <div className="min-h-screen bg-[#eeeeee] dark:bg-tech-950 pb-20 relative font-sans text-gray-900 dark:text-slate-100 transition-colors duration-500">
      <style>{`
        .react-grid-item.react-grid-placeholder { background: rgba(221, 153, 51, 0.3) !important; border-radius: 12px; opacity: 0.5; }
        .react-resizable-handle { position: absolute; width: 20px; height: 20px; bottom: 0; right: 0; cursor: se-resize; }
        .react-resizable-handle::after { content: ""; position: absolute; right: 3px; bottom: 3px; width: 5px; height: 5px; border-right: 2px solid #666; border-bottom: 2px solid #666; }
      `}</style>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDeleteModal 
          isOpen={showDeleteModal} 
          onClose={() => { setShowDeleteModal(false); setBoardToDelete(null); }} 
          onConfirm={confirmDeleteDashboard} 
          boardName={dashboards.find(d => d.id === boardToDelete)?.name || ''} 
      />

      <Toolbar
        mode={mode}
        setMode={setMode}
        dashboards={dashboards}
        activeDashboardId={activeDashboardId}
        availableCoins={availableCoins}
        userTier={userTier}
        onSwitchDashboard={(id) => { commitCurrentState(); setActiveDashboardId(id); setMode('boards'); }}
        onAddDashboard={addDashboard}
        onRemoveDashboard={requestDeleteDashboard} 
        onRenameDashboard={renameDashboard}
        onAddWidget={addWidget}
        onSave={saveDashboard}
        onReset={resetDashboard}
        onChangeTier={(tier) => { setUserTier(tier); persistState(dashboards, activeDashboardId, tier); }}
        language={language}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {saveStatus !== 'idle' && (
        <div className={`fixed bottom-24 right-8 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all duration-300 ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-white dark:bg-[#2f3032] text-[#dd9933] border border-[#dd9933]/30'}`}>
          {saveStatus === 'saving'
            ? <><Loader2 className="animate-spin" size={20} /><span className="font-semibold">Saving...</span></>
            : <><CheckCircle size={20} /><span className="font-semibold">Saved!</span></>
          }
        </div>
      )}

      <div className="w-[98%] mx-auto p-4 pt-32 h-full min-h-screen flex flex-col">
        {mode === 'pages' ? (
          <IndicatorPage language={language} coinMap={coinMap} userTier={userTier} />
        ) : (
          <>
            {maximizedItem && (
              <div className="fixed inset-4 top-[140px] z-[9999] bg-white dark:bg-[#1a1c1e] rounded-xl border-2 border-[#dd9933] shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
                <GridHeader
                  item={maximizedItem}
                  onRemove={() => toggleMaximize(maximizedItem.id)}
                  onToggleMaximize={toggleMaximize}
                  language={language}
                />
                <div className="flex-1 p-0 min-h-0 bg-white dark:bg-[#2f3032] overflow-hidden relative rounded-b-xl">
                  <div className="absolute inset-0">
                    <CryptoWidget
                      item={maximizedItem}
                      /* Fix: replace undefined 'item' with 'maximizedItem' */
                      currentPrice={maximizedItem.symbol ? coinMap[maximizedItem.symbol.toUpperCase()]?.current_price : undefined}
                      priceChange={maximizedItem.symbol ? coinMap[maximizedItem.symbol.toUpperCase()]?.price_change_percentage_24h : undefined}
                      sparkline={maximizedItem.symbol ? coinMap[maximizedItem.symbol.toUpperCase()]?.sparkline_in_7d?.price : undefined}
                      totalVolume={maximizedItem.symbol ? coinMap[maximizedItem.symbol.toUpperCase()]?.total_volume : undefined}
                      marketCap={maximizedItem.symbol ? coinMap[maximizedItem.symbol.toUpperCase()]?.market_cap : undefined}
                      coinName={maximizedItem.symbol ? coinMap[maximizedItem.symbol.toUpperCase()]?.name : undefined}
                      language={language}
                    />
                  </div>
                </div>
              </div>
            )}

            <ResponsiveGridLayout
              key={`${activeDashboardId}-${layoutVersion}`}
              className="layout"
              layouts={displayLayouts}
              breakpoints={BREAKPOINTS}
              cols={COLS}
              rowHeight={ROW_HEIGHT}
              draggableHandle=".grid-drag-handle"
              onLayoutChange={handleLayoutChange}
              onBreakpointChange={setCurrentBreakpoint}
              margin={[16, 16]}
              isDraggable={!maximizedItem && activeFilter === 'ALL'}
              isResizable={!maximizedItem && activeFilter === 'ALL'}
              compactType="vertical"
            >
              {filteredItems.map((item, idx) => {
                if (item.isMaximized) {
                  return (
                    <div key={item.id} className="bg-gray-200 dark:bg-[#2f3032]/20 border border-dashed border-gray-400 dark:border-slate-700 rounded-xl flex items-center justify-center opacity-50">
                      <span className="text-gray-500 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Maximized</span>
                    </div>
                  );
                }

                const coinInfo = item.symbol ? coinMap[item.symbol.toUpperCase()] : undefined;
                
                // --- TIER LOCK LOGIC ---
                let isLocked = false;
                const isMainBoard = activeDashboardId === dashboards[0].id;
                
                if (userTier === UserTier.TIER_1) {
                    if (isMainBoard) {
                        // On Main Board: Lock everything after the first 3 items (index 0, 1, 2 visible)
                        if (idx >= 3) isLocked = true;
                    } else {
                        // On Custom Boards: Lock EVERYTHING for Tier 1
                        isLocked = true;
                    }
                }

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-[#2f3032] rounded-xl border-0 dark:border dark:border-slate-700/50 shadow-md dark:shadow-xl flex flex-col transition-all duration-200 hover:shadow-lg hover:z-[50] relative overflow-hidden"
                  >
                    <GridHeader item={item} onRemove={removeWidget} onToggleMaximize={toggleMaximize} language={language} />
                    <div className="flex-1 min-h-0 bg-white dark:bg-[#2f3032] overflow-hidden rounded-b-xl relative">
                        {isLocked && <PremiumLockOverlay />}
                        <div className={isLocked ? 'blur-sm pointer-events-none select-none h-full' : 'h-full'}>
                            <CryptoWidget
                                item={item}
                                currentPrice={coinInfo?.current_price}
                                priceChange={coinInfo?.price_change_percentage_24h}
                                sparkline={coinInfo?.sparkline_in_7d?.price}
                                totalVolume={coinInfo?.total_volume}
                                marketCap={coinInfo?.market_cap}
                                coinName={coinInfo?.name}
                                language={language}
                            />
                        </div>
                    </div>
                  </div>
                );
              })}
            </ResponsiveGridLayout>
          </>
        )}
      </div>
    </div>
  );
};

export default Workspace;
