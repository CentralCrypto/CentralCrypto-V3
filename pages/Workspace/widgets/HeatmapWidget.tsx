import React, { useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts";
import TreemapModule from "highcharts/modules/treemap";
import ColorAxisModule from "highcharts/modules/coloraxis";
import AccessibilityModule from "highcharts/modules/accessibility";

type CoinLite = {
  id: string;
  symbol?: string;
  name?: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  fully_diluted_valuation?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_24h_in_currency?: number;
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number | null;
  ath?: number;
  ath_change_percentage?: number;
  ath_date?: string;
  atl?: number;
  atl_change_percentage?: number;
  atl_date?: string;
  last_updated?: string;
};

type CacheckoLiteEnvelope =
  | { updated_at?: string; data?: CoinLite[] }
  | { updated_at?: string; data?: CoinLite[] }[]
  | CoinLite[];

type ValueMode = "marketcap" | "var24h";

let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  try { (TreemapModule as any)(Highcharts); } catch (e) { console.error(e); }
  try { (ColorAxisModule as any)(Highcharts); } catch (e) { console.error(e); }
  try { (AccessibilityModule as any)(Highcharts); } catch (e) {}

  Highcharts.setOptions({
    chart: { style: { fontFamily: "Inter, system-ui, sans-serif" } },
    lang: { thousandsSep: "," }
  });
}

const ENDPOINTS = {
  COINS_LITE: "/cachecko/cachecko_lite.json"
};

async function httpGetJson(url: string, opts?: { timeoutMs?: number; retries?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 20000;
  const retries = opts?.retries ?? 2;

  const salt = Math.floor(Date.now() / 60000);
  const finalUrl = url.includes("?") ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(finalUrl, { cache: "no-store", signal: ctrl.signal });
      if (!r.ok) throw new Error(`${finalUrl} -> ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === retries) throw e;
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("httpGetJson: unreachable");
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function upper(s?: string) {
  return (s || "").toUpperCase();
}
function fmtPct(v: number) {
  const n = safeNum(v);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function fmtMoney(v: number) {
  const n = safeNum(v);
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toLocaleString()}`;
}
function fmtPrice(v: number) {
  const n = safeNum(v);
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtNumber(v: number) {
  const n = safeNum(v);
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n.toLocaleString()}`;
}

export default function HeatmapWidget() {
  const [isOpen, setIsOpen] = useState(true);
  const [valueMode, setValueMode] = useState<ValueMode>("marketcap");
  const [coins, setCoins] = useState<CoinLite[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [buildingChart, setBuildingChart] = useState(false);
  const [err, setErr] = useState<string>("");

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => { initHighchartsOnce(); }, []);

  // trava scroll do body quando popup está aberto
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const load = async () => {
    setErr("");
    setLoadingData(true);
    try {
      const raw: CacheckoLiteEnvelope = await httpGetJson(ENDPOINTS.COINS_LITE, { timeoutMs: 20000, retries: 2 });

      let arr: CoinLite[] = [];
      if (Array.isArray(raw)) {
        // caso envelope array [{data:[...]}]
        if (raw.length > 0 && (raw as any)[0]?.data && Array.isArray((raw as any)[0].data)) {
          arr = (raw as any)[0].data as CoinLite[];
        } else {
          // caso já seja array de coins
          arr = raw as CoinLite[];
        }
      } else if ((raw as any)?.data && Array.isArray((raw as any).data)) {
        arr = (raw as any).data as CoinLite[];
      }

      setCoins(arr);
    } catch (e: any) {
      console.error("Heatmap load error", e);
      setErr(String(e?.message || e));
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { load(); }, []);

  const treemapData = useMemo(() => {
    const list = Array.isArray(coins) ? coins : [];
    if (list.length === 0) return { points: [] as any[], topIds: new Set<string>() };

    // ordena por marketcap (pra label/ícone nos maiores)
    const byMcap = [...list]
      .filter(c => c?.id && c?.symbol)
      .sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap));

    const topN = 260; // labels + logo só nos maiores
    const topIds = new Set(byMcap.slice(0, topN).map(c => String(c.id)));

    // pontos finais (SEM FILTRO: todos os 2000)
    const points = byMcap.map(c => {
      const change =
        safeNum(c.price_change_percentage_24h_in_currency) ||
        safeNum(c.price_change_percentage_24h);

      const mcap = Math.max(1, safeNum(c.market_cap));

      // tamanho depende do modo
      const value =
        valueMode === "marketcap"
          ? mcap
          : Math.max(1, Math.abs(change)); // tamanho = abs(var)

      return {
        id: String(c.id),
        name: upper(c.symbol),
        value,
        // COR depende do colorAxis (precisa do módulo coloraxis!)
        colorValue: change,
        custom: {
          id: String(c.id),
          symbol: upper(c.symbol),
          name: c.name || "",
          logo: c.image || "",
          price: safeNum(c.current_price),
          rank: safeNum(c.market_cap_rank),
          change24: change,
          priceChange24: safeNum(c.price_change_24h),
          high24: safeNum(c.high_24h),
          low24: safeNum(c.low_24h),
          mcap,
          mcapChange24: safeNum(c.market_cap_change_24h),
          mcapChangePct24: safeNum(c.market_cap_change_percentage_24h),
          vol: safeNum(c.total_volume),
          fdv: safeNum(c.fully_diluted_valuation),
          circ: safeNum(c.circulating_supply),
          total: safeNum(c.total_supply),
          max: c.max_supply ?? null,
          ath: safeNum(c.ath),
          athChg: safeNum(c.ath_change_percentage),
          athDate: c.ath_date || "",
          atl: safeNum(c.atl),
          atlChg: safeNum(c.atl_change_percentage),
          atlDate: c.atl_date || "",
          last: c.last_updated || ""
        }
      };
    });

    return { points, topIds };
  }, [coins, valueMode]);

  // monta chart
  useEffect(() => {
    if (!isOpen) return;
    if (!containerRef.current) return;
    if (loadingData) return;
    if (!treemapData.points || treemapData.points.length === 0) return;

    setBuildingChart(true);

    // deixa a UI respirar 1 frame antes de travar montando o chart
    requestAnimationFrame(() => {
      try {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }

        chartRef.current = Highcharts.chart(containerRef.current as any, {
          chart: {
            backgroundColor: "#111216",
            margin: [0, 0, 0, 0],
            spacing: [0, 0, 0, 0],
            height: "100%",
            animation: false
          },
          title: { text: undefined as any },
          subtitle: { text: undefined as any },
          credits: { enabled: false },
          exporting: { enabled: false },

          // >>>>>>>>>>>> AQUI É O QUE TIRA O “TUDO AZUL” <<<<<<<<<<<<
          colorAxis: {
            min: -50,
            max: 50,
            stops: [
              [0, "#f73539"],   // vermelho
              [0.5, "#414555"], // neutro
              [1, "#2ecc59"]    // verde
            ],
            gridLineWidth: 0
          },

          tooltip: {
            useHTML: true,
            outside: false,
            followPointer: true,
            backgroundColor: "rgba(20,20,25,0.96)",
            borderColor: "rgba(255,255,255,0.12)",
            borderRadius: 12,
            shadow: true,
            padding: 0,
            formatter: function () {
              // @ts-ignore
              const p = this.point;
              const c = p.custom || {};
              const clr = (v: number) => (safeNum(v) >= 0 ? "#2ecc59" : "#f73539");

              return `
                <div style="padding:12px; min-width: 260px; color:#fff; font-family:Inter,system-ui,sans-serif">
                  <div style="display:flex; align-items:center; gap:10px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08)">
                    ${c.logo ? `<img src="${c.logo}" style="width:28px; height:28px; border-radius:50%;" />` : ""}
                    <div style="min-width:0">
                      <div style="font-weight:900; font-size:14px; letter-spacing:0.2px">${c.symbol || p.name}</div>
                      <div style="font-size:11px; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                        ${c.name || ""}${c.rank ? ` • #${c.rank}` : ""}
                      </div>
                    </div>
                    <div style="margin-left:auto; text-align:right">
                      <div style="font-weight:900; font-size:14px">${fmtPrice(c.price)}</div>
                      <div style="font-size:12px; font-weight:800; color:${clr(c.change24)}">${fmtPct(c.change24)}</div>
                    </div>
                  </div>

                  <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px">
                    <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px">
                      <div style="color:#9aa0aa; font-size:10px">Market Cap</div>
                      <div style="font-weight:800">${fmtMoney(c.mcap)}</div>
                      <div style="color:#9aa0aa; font-size:10px; margin-top:4px">Δ 24h</div>
                      <div style="font-weight:800; color:${clr(c.mcapChangePct24)}">${fmtMoney(c.mcapChange24)} (${fmtPct(c.mcapChangePct24)})</div>
                    </div>

                    <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px">
                      <div style="color:#9aa0aa; font-size:10px">Volume 24h</div>
                      <div style="font-weight:800">${fmtMoney(c.vol)}</div>
                      <div style="color:#9aa0aa; font-size:10px; margin-top:4px">High / Low 24h</div>
                      <div style="font-weight:800">${fmtPrice(c.high24)} / ${fmtPrice(c.low24)}</div>
                    </div>

                    <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px">
                      <div style="color:#9aa0aa; font-size:10px">Supply</div>
                      <div style="font-weight:800">Circ: ${fmtNumber(c.circ)}</div>
                      <div style="font-weight:800">Total: ${fmtNumber(c.total)}${c.max ? ` • Max: ${fmtNumber(c.max)}` : ""}</div>
                    </div>

                    <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:10px">
                      <div style="color:#9aa0aa; font-size:10px">ATH / ATL</div>
                      <div style="font-weight:800">ATH: ${fmtPrice(c.ath)} (${fmtPct(c.athChg)})</div>
                      <div style="font-weight:800">ATL: ${fmtPrice(c.atl)} (${fmtPct(c.atlChg)})</div>
                    </div>
                  </div>

                  <div style="margin-top:10px; color:#7f8792; font-size:10px">
                    ${c.last ? `Atualizado: ${String(c.last).replace("T", " ").replace("Z", "")}` : ""}
                  </div>
                </div>
              `;
            }
          },

          series: [
            {
              type: "treemap",
              layoutAlgorithm: "squarified",
              animation: false,
              borderColor: "#0b0c10",
              borderWidth: 1,
              // liga explicitamente ao colorAxis e usa colorValue
              colorAxis: 0,
              colorKey: "colorValue",
              data: treemapData.points as any,
              dataLabels: {
                enabled: true,
                useHTML: true,
                allowOverlap: true,
                crop: true,
                overflow: "justify",
                formatter: function () {
                  // @ts-ignore
                  const p = this.point;
                  const c = p.custom || {};
                  const w = p.shapeArgs?.width || 0;
                  const h = p.shapeArgs?.height || 0;

                  // só desenha label/logo nos maiores (performance + não poluir)
                  const show = treemapData.topIds.has(String(p.id));
                  if (!show) return "";

                  // se ficou pequeno, não desenha nada (mas tooltip funciona)
                  if (w < 70 || h < 55) return "";

                  const logoOk = c.logo && w >= 90 && h >= 75;

                  // fonte baseada na área
                  const area = w * h;
                  const font = Math.min(34, Math.max(12, 10 + Math.round(area * 0.00012)));
                  const sub = Math.max(10, Math.round(font * 0.72));
                  const logo = Math.min(30, Math.max(16, Math.round(font * 0.9)));

                  return `
                    <div style="pointer-events:none; text-align:center; line-height:1; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.75)">
                      ${logoOk ? `<img src="${c.logo}" style="width:${logo}px; height:${logo}px; border-radius:50%; margin:0 auto 4px auto" />` : ""}
                      <div style="font-weight:900; font-size:${font}px">${p.name}</div>
                      <div style="font-weight:800; font-size:${sub}px; opacity:0.95">${fmtPct(c.change24)}</div>
                      <div style="font-weight:800; font-size:${Math.max(10, Math.round(sub * 0.9))}px; opacity:0.85">${fmtPrice(c.price)}</div>
                    </div>
                  `;
                }
              }
            } as any
          ]
        } as any);
      } finally {
        setBuildingChart(false);
      }
    });
  }, [isOpen, loadingData, treemapData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-black/70">
      <div className="absolute inset-0 bg-[#111216] overflow-hidden">
        {/* Header */}
        <div className="h-[44px] flex items-center justify-between px-3 border-b border-white/10 bg-[#0f1014]">
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 rounded p-0.5">
              <button
                onClick={() => setValueMode("marketcap")}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-colors ${
                  valueMode === "marketcap" ? "bg-[#dd9933] text-black" : "text-gray-300 hover:text-white"
                }`}
              >
                MarketCap
              </button>
              <button
                onClick={() => setValueMode("var24h")}
                className={`px-3 py-1 text-[11px] font-bold rounded transition-colors ${
                  valueMode === "var24h" ? "bg-[#dd9933] text-black" : "text-gray-300 hover:text-white"
                }`}
              >
                Var.Preço 24Hs
              </button>
            </div>

            {/* escala visual (só UI) */}
            <div className="ml-2 flex items-center gap-2 text-[11px] text-gray-300 select-none">
              <span>-50%</span>
              <div
                className="h-[6px] w-[220px] rounded"
                style={{ background: "linear-gradient(90deg, #f73539 0%, #414555 50%, #2ecc59 100%)" }}
              />
              <span>+50%</span>
              <span className="ml-2 text-gray-500">{coins.length.toLocaleString()} moedas</span>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-200 flex items-center justify-center"
            aria-label="Fechar"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Chart */}
        <div className="absolute left-0 right-0 bottom-0 top-[44px] overflow-hidden">
          <div ref={containerRef} className="absolute inset-0" />

          {(loadingData || buildingChart) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#dd9933] animate-spin" />
                <div className="text-[12px] text-gray-200 font-semibold">
                  {loadingData ? "Carregando dados..." : "Renderizando heatmap..."}
                </div>
                {err ? <div className="text-[11px] text-red-300 max-w-[70vw] break-words">{err}</div> : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
