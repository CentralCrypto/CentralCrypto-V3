import React from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  Area 
} from 'recharts';

const data = Array.from({ length: 50 }, (_, i) => {
  const base = 42000 + Math.random() * 2000;
  return {
    time: `10:${i < 10 ? '0' + i : i}`,
    open: base,
    close: base + (Math.random() - 0.5) * 500,
    high: base + 300,
    low: base - 300,
    volume: Math.floor(Math.random() * 1000),
  };
});

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-tech-900 border border-tech-700 p-2 rounded shadow-xl text-xs font-mono">
        <p className="text-gray-400">{label}</p>
        <p className="text-tech-success">Preço: ${payload[0].value.toFixed(2)}</p>
        <p className="text-tech-500">Vol: {payload[1].value}</p>
      </div>
    );
  }
  return null;
};

const TradingChart: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-tech-800 bg-tech-900/50">
        <div className="flex items-center gap-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            BTC/USD <span className="text-xs font-mono text-tech-950 bg-tech-500 px-1.5 py-0.5 rounded font-bold">PERP</span>
          </h3>
          <div className="text-xs flex gap-2">
            <span className="text-tech-success font-mono">$64,231.45</span>
            <span className="text-tech-success font-mono text-[10px]">(+2.34%)</span>
          </div>
        </div>
        <div className="flex gap-2 text-[10px] font-mono text-gray-400">
          {['15m', '1H', '4H', '1D', '1W'].map(tf => (
            <button key={tf} className="hover:text-tech-500 hover:bg-tech-800 px-2 py-1 rounded transition-colors">
              {tf}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 min-h-[300px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dd9933" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#dd9933" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis dataKey="time" stroke="#525252" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
            <YAxis 
              domain={['auto', 'auto']} 
              orientation="right" 
              stroke="#525252" 
              tick={{fontSize: 10}} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(val) => `$${val.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="close" stroke="#dd9933" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
            <Bar dataKey="volume" barSize={4} fill="#525252" opacity={0.5} yAxisId={0} />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Watermark effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
           <img 
              src="https://centralcrypto.com.br/2/wp-content/uploads/elementor/thumbs/cropped-logo1-transp-rarkb9ju51up2mb9t4773kfh16lczp3fjifl8qx228.png" 
              className="w-1/2 grayscale"
           />
        </div>
      </div>
    </div>
  );
};

export default TradingChart;