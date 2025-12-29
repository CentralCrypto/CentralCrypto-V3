
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, RotateCcw, Layout, Search, ChevronDown, Filter, FileText, Minus } from 'lucide-react';
import { Dashboard, ApiCoin, UserTier, WidgetType, Language } from '../../../types';
import { AVAILABLE_WIDGETS } from '../constants';
import { getTranslations } from '../../../locales';

interface ToolbarProps {
  mode: 'boards' | 'pages';
  setMode: (mode: 'boards' | 'pages') => void;
  dashboards: Dashboard[];
  activeDashboardId: string;
  availableCoins: ApiCoin[];
  userTier: UserTier;
  language: Language;
  onSwitchDashboard: (id: string) => void;
  onAddDashboard: () => void;
  onRemoveDashboard: (id: string) => void;
  onRenameDashboard: (id: string, name: string) => void;
  onAddWidget: (type: WidgetType, symbol: string) => void;
  onSave: () => void;
  onReset: () => void;
  onChangeTier: (tier: UserTier) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const SearchableSelect: React.FC<{
  options: ApiCoin[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}> = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => {
    const s = (opt?.symbol || '').toLowerCase();
    const n = (opt?.name || '').toLowerCase();
    const q = (searchTerm || '').toLowerCase();
    return s.includes(q) || n.includes(q);
  });

  return (
    <div className="relative w-32" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-[#1a1c1e] text-gray-800 dark:text-white text-xs font-bold px-2 py-1.5 rounded flex items-center justify-between shadow-sm border border-transparent focus:border-[#dd9933]"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={12} className="text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-[9999] max-h-60 flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-slate-700/50">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#2f3032] px-2 py-1 rounded">
              <Search size={12} className="text-gray-400" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-gray-800 dark:text-white"
                placeholder="Search..."
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <button
                type="button"
                key={opt.id}
                onClick={() => { onChange((opt.symbol || '').toUpperCase()); setIsOpen(false); setSearchTerm(''); }}
                className={`w-full text-left px-2 py-1.5 text-xs font-bold rounded hover:bg-gray-100 dark:hover:bg-[#2f3032] transition-colors flex justify-between ${value === (opt.symbol || '').toUpperCase() ? 'text-[#dd9933]' : 'text-gray-600 dark:text-slate-300'}`}
              >
                <span>{(opt.symbol || '').toUpperCase()}</span>
                <span className="text-[10px] text-gray-400 font-normal truncate max-w-[80px]">{opt.name}</span>
              </button>
            )) : (
              <div className="text-center p-2 text-xs text-gray-400">No coins found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  setMode,
  dashboards,
  activeDashboardId,
  availableCoins,
  userTier,
  language,
  onSwitchDashboard,
  onAddDashboard,
  onRemoveDashboard,
  onRenameDashboard,
  onAddWidget,
  onSave,
  onReset,
  onChangeTier,
  activeFilter,
  onFilterChange
}) => {
  const activeDashboard = dashboards.find(d => d.id === activeDashboardId);
  const [selectedWidgetType, setSelectedWidgetType] = useState<WidgetType>(WidgetType.PRICE);
  const [selectedCoin, setSelectedCoin] = useState<string>('BTC');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const t = getTranslations(language).workspace.toolbar;

  const handleAdd = () => {
    onAddWidget(selectedWidgetType, selectedCoin);
  };

  const startEditing = () => {
    if (activeDashboard) {
      setTempName(activeDashboard.name);
      setIsEditingName(true);
    }
  };

  const saveName = () => {
    if (activeDashboard && tempName.trim()) {
      onRenameDashboard(activeDashboard.id, tempName);
    }
    setIsEditingName(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      onRemoveDashboard(id);
  };

  const FILTER_OPTIONS = ['ALL', 'MARKET', 'GLOBAL', 'SENTIMENT'];

  return (
    <div className="bg-white dark:bg-[#1a1c1e] p-2 fixed top-[152px] -mt-[19px] left-0 right-0 z-[900] shadow-sm transition-colors">
      <div className="w-[98%] mx-auto flex flex-col gap-2">

        {/* ROW 1: Tier, Save, Reset (Right Aligned) */}
        <div className="flex items-center justify-end gap-3 px-2 border-b border-gray-100 dark:border-slate-800/50 pb-2">
          <div className="hidden md:flex items-center gap-2 mr-4">
            <span className="text-gray-500 dark:text-slate-500 text-[10px] font-bold uppercase">{t.plan}:</span>
            <select
              value={userTier}
              onChange={(e) => onChangeTier(e.target.value as UserTier)}
              className="bg-transparent text-gray-600 dark:text-slate-400 text-xs font-bold outline-none cursor-pointer hover:text-black dark:hover:text-white text-right"
            >
              {Object.values(UserTier).map(t => <option key={t} value={t} className="bg-white dark:bg-[#1a1c1e]">{t}</option>)}
            </select>
          </div>

          <div className="h-4 w-px bg-gray-300 dark:bg-slate-700 hidden md:block"></div>

          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-1 text-xs font-bold bg-gray-100 dark:bg-[#2f3032] hover:bg-gray-200 dark:hover:bg-[#3f4144] text-gray-600 dark:text-slate-300 hover:text-black dark:hover:text-white px-3 py-1 rounded transition-colors"
          >
            <Save size={12} /> {t.saveLayout}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2f3032] px-3 py-1 rounded transition-colors"
          >
            <RotateCcw size={12} /> {t.resetLayout}
          </button>
        </div>

        {/* ROW 2: Boards (Left) & Filter/Controls (Right) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">

          {/* LEFT: Boards List */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full md:w-auto">

            {/* PAGES TAB */}
            <button
              type="button"
              onClick={() => setMode('pages')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shadow-sm border ${
                mode === 'pages'
                  ? 'bg-[#dd9933] text-black border-[#dd9933]'
                  : 'bg-white dark:bg-[#2f3032] border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#3f4144]'
              }`}
            >
              <FileText size={12} /> Pages
            </button>

            <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>

            {dashboards.map(d => (
              <div key={d.id} className="flex items-center group shrink-0 relative pr-1">
                <button
                  type="button"
                  onClick={() => onSwitchDashboard(d.id)}
                  onDoubleClick={() => { if (activeDashboardId === d.id && !d.isLocked) startEditing(); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shadow-sm border ${
                    activeDashboardId === d.id && mode === 'boards'
                      ? 'bg-[#dd9933] text-black border-[#dd9933]'
                      : 'bg-white dark:bg-[#2f3032] border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#3f4144]'
                  }`}
                >
                  <Layout size={12} />
                  {isEditingName && activeDashboardId === d.id && !d.isLocked ? (
                    <input
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      autoFocus
                      className="bg-white text-black w-20 outline-none px-1 rounded text-xs"
                    />
                  ) : d.name}
                </button>
              </div>
            ))}

            <div className="flex gap-1 ml-2">
              <button
                type="button"
                onClick={onAddDashboard}
                className="p-1.5 bg-[#dd9933] hover:bg-amber-600 text-black rounded-lg transition-colors shadow-sm"
                title={t.addBoard}
              >
                <Plus size={14} />
              </button>

              {activeDashboard && !activeDashboard.isLocked && (
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, activeDashboardId)}
                  className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
                  title={t.deleteBoard}
                >
                  <Minus size={14} />
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Controls & Filter */}
          {mode === 'boards' && (
            <div className="flex items-center gap-2">

              {/* FILTER DROPDOWN */}
              <div className="relative group">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#2f3032] p-1.5 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                  <Filter size={12} className="text-gray-500 dark:text-slate-400 ml-1" />
                  <select
                    value={activeFilter}
                    onChange={(e) => onFilterChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-gray-700 dark:text-white outline-none cursor-pointer border-none pl-1 pr-1 hover:text-[#dd9933]"
                  >
                    {FILTER_OPTIONS.map(opt => (
                      <option key={opt} value={opt} className="bg-white dark:bg-[#1a1c1e] text-gray-900 dark:text-white">
                        {opt === 'ALL' ? 'TODOS' : opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeDashboard && !activeDashboard.isLocked && (
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#2f3032] p-1.5 rounded-lg shadow-sm">
                  <select
                    value={selectedWidgetType}
                    onChange={(e) => setSelectedWidgetType(e.target.value as WidgetType)}
                    className="bg-white dark:bg-[#1a1c1e] text-gray-800 dark:text-white text-xs font-bold px-2 py-1.5 rounded border-none outline-none focus:ring-1 focus:ring-[#dd9933] cursor-pointer shadow-sm"
                  >
                    {AVAILABLE_WIDGETS.map(w => <option key={w.type} value={w.type}>{w.label}</option>)}
                  </select>

                  <SearchableSelect
                    options={availableCoins}
                    value={selectedCoin}
                    onChange={setSelectedCoin}
                  />

                  <button
                    type="button"
                    onClick={handleAdd}
                    className="flex items-center gap-1 bg-[#dd9933] hover:bg-amber-600 text-black px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-md"
                  >
                    <Plus size={12} /> {t.addWidget}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
