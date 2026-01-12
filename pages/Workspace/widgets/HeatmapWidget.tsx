import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import { X } from 'lucide-react';

TreemapModule(Highcharts);

type HeatPoint = {
id: string;
name: string;
value: number; // tamanho do tile (marketcap OU abs(var), conforme teu modo)
change24h?: number; // % para cor
price?: number;
symbol?: string;
logo?: string;
marketCap?: number;
volume24h?: number;
rank?: number;
category?: string;
};

type Props = {
title?: string;
data: HeatPoint[];
onClose?: () => void;
};

const fmtPrice = (n?: number) => {
const v = Number(n);
if (!isFinite(v)) return '-';
if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
if (v >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
return `$${v.toPrecision(3)}`;
};

const fmtCompact = (n?: number) => {
const v = Number(n);
if (!isFinite(v)) return '-';
const abs = Math.abs(v);
if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
return `$${v.toFixed(0)}`;
};

const fmtPct = (n?: number) => {
const v = Number(n);
if (!isFinite(v)) return '-';
return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
};

const POS_BG = '#123a2b';
const NEG_BG = '#3a1f24';
const NEU_BG = '#1f2a33';

const priceBadgeBg = (pct?: number) => {
const v = Number(pct);
if (!isFinite(v) || v === 0) return NEU_BG;
return v > 0 ? POS_BG : NEG_BG;
};

export default function HeatmapWidget({ title = '', data, onClose }: Props) {
const containerRef = useRef<HTMLDivElement>(null);
const chartRef = useRef<Highcharts.Chart | null>(null);

const [selected, setSelected] = useState<HeatPoint | null>(null);

// Normaliza/defende dados (ids únicos, números válidos)
const points = useMemo(() => {
const seen = new Set<string>();
const out: HeatPoint[] = [];

for (const d of (Array.isArray(data) ? data : [])) {
if (!d || !d.id) continue;

let id = String(d.id);
if (seen.has(id)) {
let k = 2;
while (seen.has(`${id}__${k}`)) k++;
id = `${id}__${k}`;
}
seen.add(id);

out.push({
...d,
id,
value: Math.max(0.000001, Number(d.value) || 0),
change24h: Number.isFinite(Number(d.change24h)) ? Number(d.change24h) : 0
});
}

return out;
}, [data]);

const options = useMemo<Highcharts.Options>(() => {
return {
chart: {
type: 'treemap',
backgroundColor: '#0b1118',
spacing: [0, 0, 0, 0],
margin: 0,
animation: false,
style: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial' }
},
title: { text: null },
credits: { enabled: false },
legend: { enabled: false },
tooltip: { enabled: false }, // tooltip do hover OFF (você quer card no clique)
colorAxis: {
min: -50,
max: 50,
minColor: '#f73539',
maxColor: '#2ecc59',
stops: [
[0, '#f73539'],
[0.5, '#414555'],
[1, '#2ecc59']
],
gridLineWidth: 0,
labels: { enabled: false }
},
plotOptions: {
series: {
animation: false,
states: {
hover: { enabled: false },
inactive: { enabled: false }
},
point: {
events: {
click: function () {
const p: any = this;
setSelected({
id: p.id,
name: p.custom?.fullName || p.name,
value: p.value,
change24h: p.colorValue,
price: p.custom?.price,
symbol: p.name,
logo: p.custom?.logo,
marketCap: p.custom?.marketCap,
volume24h: p.custom?.volume24h,
rank: p.custom?.rank,
category: p.custom?.category
});
}
}
},
dataLabels: {
enabled: true,
useHTML: true,
allowOverlap: true,
defer: false,
formatter: function () {
const p: any = this.point;
const shape = p.shapeArgs || {};
const w = Number(shape.width) || 0;
const h = Number(shape.height) || 0;
const area = w * h;

if (w < 55 || h < 40 || area < 2600) return '';

const logo = p.custom?.logo;
const showLogo = !!logo && w >= 90 && h >= 70;

const pct = Number(p.colorValue);
const pctTxt = Number.isFinite(pct) ? fmtPct(pct) : '-';
const pctColor = Number.isFinite(pct) ? (pct > 0 ? '#2ecc59' : '#f73539') : '#9aa4b2';

const sym = String(p.name || '').toUpperCase();

return `
<div style="pointer-events:none; text-align:center; line-height:1.05;">
${showLogo ? `<img src="${logo}" style="width:20px;height:20px;border-radius:999px; margin:0 auto 4px auto; opacity:.95; box-shadow:0 2px 6px rgba(0,0,0,.35);" />` : ``}
<div style="font-weight:900;font-size:12px;color:#f2f6ff;text-shadow:0 1px 2px rgba(0,0,0,.65);">
${sym}
</div>
<div style="font-weight:900;font-size:11px;color:${pctColor};text-shadow:0 1px 2px rgba(0,0,0,.65);">
${pctTxt}
</div>
</div>
`;
}
}
}
},
series: [{
type: 'treemap',
layoutAlgorithm: 'squarified',
allowTraversingTree: false,
turboThreshold: 0, // CRÍTICO com 2000+ pontos
borderColor: '#0b1118',
borderWidth: 1,
colorByPoint: false,
colorAxis: 0 as any,
colorKey: 'colorValue' as any,
data: points.map(p => ({
id: p.id,
name: (p.symbol ? String(p.symbol) : String(p.name)).toUpperCase(),
value: p.value,
colorValue: Number(p.change24h) || 0,
custom: {
fullName: p.name,
logo: p.logo,
price: p.price,
marketCap: p.marketCap,
volume24h: p.volume24h,
rank: p.rank,
category: p.category
}
})) as any
}] as any
};
}, [points]);

// cria/atualiza o chart
useEffect(() => {
if (!containerRef.current) return;

const el = containerRef.current;
const rect = el.getBoundingClientRect();
if (rect.width < 10 || rect.height < 10) return;

if (!chartRef.current) {
chartRef.current = Highcharts.chart(el, options as any);
} else {
chartRef.current.update(options as any, true, false, false);
}
}, [options]);

// reflow no resize (evita “vazar pra baixo” e scroll)
useEffect(() => {
if (!containerRef.current) return;

const ro = new ResizeObserver(() => {
if (chartRef.current) chartRef.current.reflow();
});
ro.observe(containerRef.current);

return () => ro.disconnect();
}, []);

useEffect(() => {
return () => {
if (chartRef.current) {
chartRef.current.destroy();
chartRef.current = null;
}
};
}, []);

return (
<div className="w-full h-full overflow-hidden flex flex-col bg-[#0b1118]">
{/* Header minimalista (sem “Heatmap” texto se title vazio) */}
<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
<div className="text-white font-black text-sm">{title || ''}</div>
{onClose ? (
<button
onClick={onClose}
className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-xs"
title="Fechar"
>
<X size={16} />
Fechar
</button>
) : null}
</div>

{/* Área do gráfico (SEM scroll) */}
<div className="relative flex-1 min-h-0 overflow-hidden">
<div ref={containerRef} className="absolute inset-0 overflow-hidden" />
</div>

{/* Card (clique) */}
{selected && (
<div
className="fixed inset-0 z-[9999] flex items-center justify-center"
onMouseDown={() => setSelected(null)}
>
<div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
<div
className="relative w-[520px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#0b1118] shadow-2xl"
onMouseDown={(e) => e.stopPropagation()}
>
<div className="flex items-start justify-between gap-3 p-4 border-b border-white/10">
<div className="flex items-center gap-3 min-w-0">
{selected.logo ? (
<img src={selected.logo} className="w-10 h-10 rounded-xl border border-white/10" />
) : (
<div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5" />
)}
<div className="min-w-0">
<div className="flex items-center gap-2">
<div className="text-white font-black truncate">{selected.name}</div>
<div className="text-white/60 font-black text-sm">{selected.symbol?.toUpperCase()}</div>
{selected.rank ? <div className="text-white/60 font-black text-sm">#{selected.rank}</div> : null}
</div>
<div
className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10"
style={{ background: priceBadgeBg(selected.change24h) }}
>
<div className="text-white/80 font-black text-xs">Preço</div>
<div className="text-white font-black text-sm">{fmtPrice(selected.price)}</div>
<div className="text-white/70 font-black text-xs ml-2">{fmtPct(selected.change24h)}</div>
</div>
</div>
</div>

<button
onClick={() => setSelected(null)}
className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white"
title="Fechar"
>
<X size={18} />
</button>
</div>

<div className="p-4 grid grid-cols-2 gap-3">
<div className="rounded-xl border border-white/10 bg-white/5 p-3">
<div className="text-white/60 font-black text-xs">Market Cap</div>
<div className="text-white font-black text-base">{fmtCompact(selected.marketCap)}</div>
</div>
<div className="rounded-xl border border-white/10 bg-white/5 p-3">
<div className="text-white/60 font-black text-xs">Volume 24h</div>
<div className="text-white font-black text-base">{fmtCompact(selected.volume24h)}</div>
</div>
<div className="rounded-xl border border-white/10 bg-white/5 p-3 col-span-2">
<div className="text-white/60 font-black text-xs">Categoria</div>
<div className="text-white font-black text-base">{selected.category || '-'}</div>
</div>
</div>
</div>
</div>
)}
</div>
);
}
