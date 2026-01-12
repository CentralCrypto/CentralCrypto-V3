import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import TreemapModule from 'highcharts/modules/treemap';
import { Maximize2, X } from 'lucide-react';

TreemapModule(Highcharts);

type HeatPoint = {
id: string;
name: string;
value: number; // tamanho
change24h?: number; // % (ou 1h/7d etc)
price?: number;
symbol?: string;
logo?: string; // url
marketCap?: number;
volume24h?: number;
rank?: number;
category?: string;
};

type Props = {
title?: string;
data: HeatPoint[];
onClose?: () => void; // se você quiser fechar a tela/popup do widget pai
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
return `${v.toFixed(2)}%`;
};

// cores: você pode trocar aqui sem mexer no resto
const POS_BG = '#123a2b';
const NEG_BG = '#3a1f24';
const NEU_BG = '#1f2a33';

const tileColorFromPct = (pct?: number) => {
const v = Number(pct);
if (!isFinite(v) || v === 0) return '#1d2a35';

const t = Math.min(1, Math.abs(v) / 20); // 20% satura
// Interpolação simples pra ficar vivo
if (v > 0) {
const base = { r: 18, g: 60, b: 43 }; // escuro
const top = { r: 24, g: 155, b: 81 }; // verde
const r = Math.round(base.r + (top.r - base.r) * t);
const g = Math.round(base.g + (top.g - base.g) * t);
const b = Math.round(base.b + (top.b - base.b) * t);
return `rgb(${r},${g},${b})`;
}

const base = { r: 58, g: 31, b: 36 };
const top = { r: 242, g: 54, b: 69 };
const r = Math.round(base.r + (top.r - base.r) * t);
const g = Math.round(base.g + (top.g - base.g) * t);
const b = Math.round(base.b + (top.b - base.b) * t);
return `rgb(${r},${g},${b})`;
};

const priceBadgeBg = (pct?: number) => {
const v = Number(pct);
if (!isFinite(v) || v === 0) return NEU_BG;
return v > 0 ? POS_BG : NEG_BG;
};

export default function HeatmapTreemap({ title = 'Heatmap', data, onClose }: Props) {
const chartRef = useRef<HighchartsReact.RefObject>(null);

const [isFullscreen, setIsFullscreen] = useState(false);

// card “tooltip” no clique
const [selected, setSelected] = useState<HeatPoint | null>(null);

const points = useMemo(() => {
return data.map((d) => ({
...d,
color: tileColorFromPct(d.change24h),
}));
}, [data]);

// fecha card com clique no vazio
useEffect(() => {
const onKey = (e: KeyboardEvent) => {
if (e.key === 'Escape') {
setSelected(null);
if (isFullscreen) setIsFullscreen(false);
}
};
window.addEventListener('keydown', onKey);
return () => window.removeEventListener('keydown', onKey);
}, [isFullscreen]);

const buildOptions = (fullscreen: boolean): Highcharts.Options => ({
chart: {
type: 'treemap',
backgroundColor: '#0b1118',
animation: true,
spacing: [8, 8, 8, 8],
style: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial' },
height: fullscreen ? (window.innerHeight - 120) : 520
},
title: { text: '' },
credits: { enabled: false },
legend: { enabled: false },
tooltip: {
enabled: false // ✅ DESLIGA tooltip do hover de vez
},
plotOptions: {
series: {
animation: { duration: 650 },
states: {
hover: { enabled: false }, // ✅ SEM hover
inactive: { enabled: false }
},
point: {
events: {
click: function () {
const p: any = this;
setSelected({
id: p.id,
name: p.name,
value: p.value,
change24h: p.change24h,
price: p.price,
symbol: p.symbol,
logo: p.logo,
marketCap: p.marketCap,
volume24h: p.volume24h,
rank: p.rank,
category: p.category
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
// ✅ Mostra logo só se couber
const p: any = this.point;
const shape = p.shapeArgs;
const w = shape?.width || 0;
const h = shape?.height || 0;
const area = w * h;

const showLogo = !!p.logo && area >= 2600 && w >= 48 && h >= 38; // regra
const showPct = area >= 1800;

const pct = Number(p.change24h);
const pctTxt = isFinite(pct) ? fmtPct(pct) : '-';
const pctColor = isFinite(pct) ? (pct > 0 ? '#25d07d' : '#ff5a6a') : '#9aa4b2';

return `
<div style="
display:flex;align-items:center;justify-content:center;
width:100%;height:100%;
text-align:center;line-height:1.05;
pointer-events:none;
">
<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
${showLogo ? `<img src="${p.logo}" style="width:18px;height:18px;border-radius:999px;opacity:.95" />` : ``}
<div style="font-weight:900;font-size:12px;color:#f2f6ff;text-shadow:0 1px 2px rgba(0,0,0,.65);">
${p.symbol ? String(p.symbol).toUpperCase() : p.name}
</div>
${showPct ? `<div style="font-weight:900;font-size:11px;color:${pctColor};text-shadow:0 1px 2px rgba(0,0,0,.65);">${pctTxt}</div>` : ``}
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
turboThreshold: 0,
borderColor: '#0b1118',
borderWidth: 1,
colorByPoint: false, // ✅ a cor vem por point.color
data: points.map((p) => ({
id: p.id,
name: p.name,
value: p.value,
color: (p as any).color,

change24h: p.change24h,
price: p.price,
symbol: p.symbol,
logo: p.logo,
marketCap: p.marketCap,
volume24h: p.volume24h,
rank: p.rank,
category: p.category
}))
}]
});

const optionsNormal = useMemo(() => buildOptions(false), [points]);
const optionsFull = useMemo(() => buildOptions(true), [points]);

return (
<div className="w-full">
{/* Header do widget */}
<div className="flex items-center justify-between gap-3 mb-3">
<div className="flex items-center gap-2">
<div className="text-lg font-black text-white">{title}</div>
</div>

<div className="flex items-center gap-2">
<button
onClick={() => setIsFullscreen(true)}
className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-xs"
title="Tela cheia"
>
<Maximize2 size={16} />
Tela cheia
</button>

{onClose ? (
<button
onClick={onClose}
className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-xs"
title="Fechar widget"
>
<X size={16} />
Fechar
</button>
) : null}
</div>
</div>

{/* Treemap normal */}
<div className="rounded-2xl overflow-hidden border border-white/10 bg-[#0b1118]">
<HighchartsReact
highcharts={Highcharts}
options={optionsNormal}
ref={chartRef}
/>
</div>

{/* Card Tooltip (clique) */}
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

<div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10"
style={{ background: priceBadgeBg(selected.change24h) }}  // ✅ FUNDO COLORIDO
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

{/* Fullscreen Modal */}
{isFullscreen && (
<div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-[2px]">
<div className="absolute inset-0" onMouseDown={() => setIsFullscreen(false)} />

<div className="relative w-[96vw] h-[92vh] mx-auto mt-[4vh] rounded-2xl overflow-hidden border border-white/10 bg-[#0b1118] shadow-2xl"
onMouseDown={(e) => e.stopPropagation()}
>
<div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
<div className="text-white font-black">{title} (Tela cheia)</div>
<button
onClick={() => setIsFullscreen(false)}
className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-xs"
title="Fechar tela cheia"
>
<X size={16} />
Fechar
</button>
</div>

<div className="p-3">
<HighchartsReact
highcharts={Highcharts}
options={optionsFull}
/>
</div>
</div>
</div>
)}
</div>
);
}
