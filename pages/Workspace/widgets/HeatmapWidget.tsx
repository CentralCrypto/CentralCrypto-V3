
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2, Layers, ZoomOut } from 'lucide-react';
import { fetchTopCoins } from '../services/api';
import { DashboardItem, Language } from '../../../types';
import CoinLogo from '../../../components/CoinLogo';
import { getBestLocalLogo } from '../../../services/logo';

interface Props {
  item: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: Language;
}

const COLORS = {
  g1: '#14532d', // green-900
  g2: '#15803d', // green-700
  g3: '#22c55e', // green-500
  n: '#475569',  // slate-600
  r1: '#ef4444', // red-500
  r2: '#b91c1c', // red-700
  r3: '#7f1d1d', // red-900
};

const getColor = (change: number) => {
  if (change >= 7) return COLORS.g1;
  if (change >= 3) return COLORS.g2;
  if (change >= 0) return COLORS.g3;
  if (change >= -3) return COLORS.r1;
  if (change >= -7) return COLORS.r2;
  return COLORS.r3;
};

const CustomTreemapContent = (props: any) => {
  const { 
      x, y, width, height, 
      change, symbol, price, name,
      id
  } = props;
  
  // Resolve best local logo for the SVG image
  const localLogo = getBestLocalLogo({ id: id || symbol?.toLowerCase(), symbol: symbol });
  
  const fontSize = Math.min(width / 5, height / 5, 24);
  const showLogo = width > 40 && height > 40;
  const logoSize = Math.min(width / 2.5, height / 2.5, 64);
  const centerX = x + width / 2;
  const logoY = y + height / 2 - (showLogo ? logoSize / 1.5 : 0);
  const textY = showLogo ? logoY + logoSize + fontSize / 2 : y + height / 2;

  if (width < 30 || height < 30) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: getColor(change),
          stroke: '#fff',
          strokeWidth: 2 / (props.depth || 1),
          strokeOpacity: 0.2,
        }}
      />
      {showLogo && (
        <image
            x={centerX - logoSize / 2}
            y={logoY - logoSize / 4}
            width={logoSize}
            height={logoSize}
            href={localLogo}
            style={{ opacity: 0.3, pointerEvents: 'none' }}
        />
      )}
      <text
        x={centerX}
        y={textY}
        textAnchor="middle"
        fill="#fff"
        fontSize={fontSize}
        fontWeight="bold"
        style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
      >
        {symbol}
      </text>
      {height > 60 && (
        <text
            x={centerX}
            y={textY + fontSize}
            textAnchor="middle"
            fill="#fff"
            fontSize={fontSize * 0.7}
            fontWeight="normal"
            style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
            {change.toFixed(2)}%
        </text>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-[#1a1c1e]/95 backdrop-blur-xl border border-gray-200 dark:border-slate-700 p-3 rounded-xl shadow-2xl z-50">
        <div className="flex items-center gap-3 mb-2">
            <CoinLogo 
                coin={{ id: data.id, symbol: data.symbol, name: data.name }} 
                className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/10"
            />
            <div>
                <p className="font-black text-gray-900 dark:text-white leading-none">{data.name}</p>
                <p className="text-xs font-bold text-gray-500 dark:text-slate-400">{data.symbol}</p>
            </div>
        </div>
        <div className="space-y-1 text-sm font-mono">
            <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-slate-400">Price:</span>
                <span className="font-bold text-gray-900 dark:text-white">${data.price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-slate-400">24h:</span>
                <span className={`font-bold ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)}%
                </span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-gray-500 dark:text-slate-400">Mkt Cap:</span>
                <span className="font-bold text-blue-500">${(data.size / 1e9).toFixed(2)}B</span>
            </div>
        </div>
      </div>
    );
  }
  return null;
};

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const coins = await fetchTopCoins();
                if (coins && coins.length > 0) {
                    const treeData = [{
                        name: 'Market',
                        children: coins.slice(0, 50).map(c => ({
                            id: c.id,
                            name: c.name,
                            symbol: c.symbol?.toUpperCase(),
                            size: c.market_cap || 0,
                            change: c.price_change_percentage_24h || 0,
                            price: c.current_price || 0,
                            image: c.image
                        }))
                    }];
                    setData(treeData);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-[#1a1c1e] relative overflow-hidden">
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={data}
                        dataKey="size"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        fill="#8884d8"
                        content={<CustomTreemapContent />}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default HeatmapWidget;
