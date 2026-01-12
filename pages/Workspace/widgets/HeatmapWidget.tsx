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

const ENDPOINT = "/cachecko/cachecko_lite.json";

let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  try { (TreemapModule as any)(Highcharts); } catch (e) { console.error("Treemap module init error", e); }
  try { (ColorAxisModule as any)(Highcharts); } catch (e) { console.error("ColorAxis module init error", e); }
  try { (AccessibilityModule as any)(Highcharts); } catch (e) {}

  Highcharts.setOptions({
    chart: { style: { fontFamily: "Inter, system-ui, sans-serif" } },
    credits: { enabled: false }
  });

  // Debug: confirma que o tipo treemap existe
  // @ts-ignore
  console.log("[Heatmap] Highcharts.seriesTypes.treemap:", !!Highcharts.seriesTypes?.treemap);
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

async function httpGetJson(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  const finalUrl = url.includes("?") ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
  const r = await fetch(finalUrl, { cache: "no-store" });
  if (!r.ok) throw new Error(`${finalUrl} -> ${r.status}`);
  return r.json();
}

// dataset mínimo: se isso não renderizar, o problema é módulo/altura e não o JSON
const STATIC_TEST_DATA: any[] = [
  { id: "All", name: "All" },
  { id: "BTC", parent: "All", name: "BTC", value: 100, colorValue: 8, custom: { logo: "", price: 90000, change24: 8, fullName: "Bitcoin", mcap: 1000000, vol: 50000 } },
  { id: "ETH", parent: "All", name: "ETH", value: 60, colorValue: -4, custom: { logo: "", price: 3000, change24: -4, fullName: "Ethereum", mcap: 600000, vol: 30000 } },
  { id: "XRP", parent: "All", name: "XRP", value: 30, colorValue: 2.3, custom: { logo: "", price: 2.1, change24: 2.3, fullName: "XRP", mcap: 300000, vol: 10000 } }
];

export default function HeatmapWidget() {
  const [valueMode, setValueMode] = useState<ValueMode>("marketcap");
  const [coins, setCoins] = useState<CoinLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [err, setErr] = useState<string>("");

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    initHighchartsOnce();
  }, []);

  // trava scroll global (pra não “vazar”)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const raw: CacheckoLiteEnvelope = await httpGetJson(ENDPOINT);

        let arr: CoinLite[] = [];
        if (Array.isArray(raw)) {
          if (raw.length > 0 && (raw as any)[0]?.data && Array.isArray((raw as any)[0].data)) {
            arr = (raw as any)[0].data as CoinLite[];
          } else {
            arr = raw as CoinLite[];
          }
        } else if ((raw as any)?.data && Array.isArray((raw as any).data)) {
          arr = (raw as any).data as CoinLite[];
        }

        setCoins(arr || []);
      } catch (e: any) {
        console.error("[Heatmap] load error", e);
        setErr(String(e?.message || e));
        setCoins([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const treemapData = useMemo(() => {
    // SEM FILTRO: pega tudo
    const list = Array.isArray(coins) ? coins : [];
    if (list.length === 0) return null;

    // top-level raiz (igual demo)
    const data: any[] = [{ id: "All", name: "All" }];

    // ordena por marketcap pra ficar bonito
    const sorted = [...list]
      .filter(c => c?.id && c?.symbol)
      .sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap));

    for (const c of sorted) {
      const change =
        safeNum(c.price_change_percentage_24h_in_currency) ||
        safeNum(c.price_change_percentage_24h);

      const mcap = Math.max(1, safeNum(c.market_cap));
      const size =
        valueMode === "marketcap"
          ? mcap
          : Math.max(1, Math.abs(change)); // tamanho = abs(var) no modo var

      data.push({
        id: String(c.id),
        parent: "All",
        name: upper(c.symbol),
        value: size,
        colorValue: change,
        custom: {
          fullName: c.name || "",
          logo: c.image || "",
          price: safeNum(c.current_price),
          change24: change,
          mcap,
          rank: safeNum(c.market_cap_rank),
          vol: safeNum(c.total_volume),
          high24: safeNum(c.high_24h),
          low24: safeNum(c.low_24h),
          circ: safeNum(c.circulating_supply),
          total: safeNum(c.total_supply),
          max: c.max_supply ?? null,
          last: c.last_updated || ""
        }
      });
    }

    return data;
  }, [coins, valueMode]);

  // render chart
  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    console.log("[Heatmap] container size:", rect.width, rect.height);

    // Se altura = 0, Highcharts não desenha nada
    if (rect.height < 50 || rect.width < 50) {
      console.warn("[Heatmap] container too small, waiting for resize...");
    }

    const dataToUse = treemapData && treemapData.length > 1 ? treemapData : STATIC_TEST_DATA;
    console.log("[Heatmap] points:", dataToUse.length);

    setRendering(true);

    requestAnimationFrame(() => {
      try {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }

        chartRef.current = Highcharts.chart(el, {
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

          colorAxis: {
            min: -50,
            max: 50,
            stops: [
              [0, "#f73539"],
              [0.5, "#414555"],
              [1, "#2ecc59"]
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
              const col = safeNum(c.change24) >= 0 ? "#2ecc59" : "#f73539";
              return `
                <div style="padding:12px; min-width:240px; color:#fff; font-family:Inter,system-ui,sans-serif">
                  <div style="display:flex; gap:10px; align-items:center; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08)">
                    ${c.logo ? `<img src="${c.logo}" style="width:28px;height:28px;border-radius:50%" />` : ""}
                    <div style="min-width:0">
                      <div style="font-weight:900;font-size:14px">${p.name}</div>
                      <div style="font-size:11px;color:#9aa0aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        ${c.fullName || ""}${c.rank ? ` • #${c.rank}` : ""}
                      </div>
                    </div>
                    <div style="margin-left:auto;text-align:right">
                      <div style="font-weight:900;font-size:14px">${fmtPrice(c.price)}</div>
                      <div style="font-weight:900;font-size:12px;color:${col}">${fmtPct(c.change24)}</div>
                    </div>
                  </div>
                  <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px">
                    <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:10px">
                      <div style="color:#9aa0aa;font-size:10px">Market Cap</div>
                      <div style="font-weight:900">${fmtMoney(c.mcap)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:10px">
                      <div style="color:#9aa0aa;font-size:10px">Volume 24h</div>
                      <div style="font-weight:900">${fmtMoney(c.vol)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:10px">
                      <div style="color:#9aa0aa;font-size:10px">High / Low 24h</div>
                      <div style="font-weight:900">${fmtPrice(c.high24)} / ${fmtPrice(c.low24)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:10px">
                      <div style="color:#9aa0aa;font-size:10px">Supply</div>
                      <div style="font-weight:900">Circ ${fmtMoney(safeNum(c.circ))}</div>
                    </div>
                  </div>
                </div>
              `;
            }
          },

          series: [
            {
              type: "treemap",
              layoutAlgorithm: "squarified",
              allowDrillToNode: false,
              animation: false,
              borderColor: "#0b0c10",
              borderWidth: 1,
              colorAxis: 0,
              colorKey: "colorValue",
              data: dataToUse as any,
              dataLabels: {
                enabled: true,
                useHTML: true,
                allowOverlap: true,
                formatter: function () {
                  // @ts-ignore
                  const p = this.point;
                  const c = p.custom || {};
                  const w = p.shapeArgs?.width || 0;
                  const h = p.shapeArgs?.height || 0;

                  if (p.id === "All") return "";

                  // não polui: só tiles grandes
                  if (w < 85 || h < 65) return "";

                  const logoOk = !!c.logo && w >= 110 && h >= 85;
                  return `
                    <div style="pointer-events:none; text-align:center; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.75); line-height:1">
                      ${logoOk ? `<img src="${c.logo}" style="width:26px;height:26px;border-radius:50%;margin:0 auto 4px auto" />` : ""}
                      <div style="font-weight:900;font-size:20px">${p.name}</div>
                      <div style="font-weight:900;font-size:14px;opacity:0.95">${fmtPct(c.change24)}</div>
                      <div style="font-weight:800;font-size:12px;opacity:0.9">${fmtPrice(c.price)}</div>
                    </div>
                  `;
                }
              }
            } as any
          ]
        } as any);

        // ResizeObserver: garante reflow quando layout muda
        if (roRef.current) roRef.current.disconnect();
        roRef.current = new ResizeObserver(() => {
          if (chartRef.current) chartRef.current.reflow();
        });
        roRef.current.observe(el);

        // reflow extra (modal/absolute às vezes precisa)
        setTimeout(() => {
          if (chartRef.current) chartRef.current.reflow();
        }, 0);

      } catch (e) {
        console.error("[Heatmap] chart error", e);
      } finally {
        setRendering(false);
      }
    });

    return () => {
      if (roRef.current) roRef.current.disconnect();
    };
  }, [treemapData]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 overflow-hidden">
      <div className="absolute inset-0 bg-[#111216] overflow-hidden">
        {/* header */}
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

            <div className="ml-2 flex items-center gap-2 text-[11px] text-gray-300 select-none">
              <span>-50%</span>
              <div
                className="h-[6px] w-[220px] rounded"
                style={{ background: "linear-gradient(90deg, #f73539 0%, #414555 50%, #2ecc59 100%)" }}
              />
              <span>+50%</span>
              <span className="ml-2 text-gray-500">
                {loading ? "carregando..." : `${coins.length.toLocaleString()} moedas`}
              </span>
              {err ? <span className="ml-2 text-red-300">{err}</span> : null}
            </div>
          </div>

          {/* fecha no X do browser ou remove esse botão se quiser */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-200 flex items-center justify-center"
            title="(sem ação)"
          >
            ✕
          </a>
        </div>

        {/* chart */}
        <div className="absolute left-0 right-0 bottom-0 top-[44px] overflow-hidden">
          <div ref={containerRef} className="absolute inset-0" />

          {(loading || rendering) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-[#dd9933] animate-spin" />
                <div className="text-[12px] text-gray-200 font-semibold">
                  {loading ? "Carregando dados..." : "Renderizando heatmap..."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
