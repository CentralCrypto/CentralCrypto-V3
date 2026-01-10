import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import DataModule from 'highcharts/modules/data';
import ColorAxisModule from 'highcharts/modules/coloraxis';

// =============================
// FULLSCREEN DEMO (SÓ X PRA FECHAR)
// - Replica o demo ORIGINAL (S&P 500) pra você ver funcionando no site.
// =============================

let HC_INITED = false;
let TREEMAP_LABEL_PLUGIN_INITED = false;

function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;

  (TreemapModule as any)(Highcharts);
  (ExportingModule as any)(Highcharts);
  (AccessibilityModule as any)(Highcharts);
  (DataModule as any)(Highcharts);
  (ColorAxisModule as any)(Highcharts);

  Highcharts.setOptions({
    chart: {
      style: {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      }
    }
  });
}

function initTreemapRelativeFontPluginOnce() {
  if (TREEMAP_LABEL_PLUGIN_INITED) return;
  TREEMAP_LABEL_PLUGIN_INITED = true;

  Highcharts.addEvent(Highcharts.Series as any, 'drawDataLabels', function () {
    // @ts-ignore
    if (this.type !== 'treemap') return;

    // ✅ robusto: tenta pegar do Series, senão do Chart
    // @ts-ignore
    const ca = this.colorAxis || (this.chart && this.chart.colorAxis && this.chart.colorAxis[0]);

    // @ts-ignore
    this.points.forEach((point: any) => {
      // Color the level 2 headers with the combined performance of its children
      if (point?.node?.level === 2 && Number.isFinite(point.value)) {
        const previousValue = (point.node.children || []).reduce(
          (acc: number, child: any) =>
            acc +
            (child?.point?.value || 0) -
            (child?.point?.value || 0) * (child?.point?.colorValue || 0) / 100,
          0
        );

        const perf = 100 * (point.value - previousValue) / (previousValue || 1);

        point.custom = {
          ...(point.custom || {}),
          performance: (perf < 0 ? '' : '+') + perf.toFixed(2) + '%'
        };

        // ✅ só tenta se existir
        if (point.dlOptions && ca && typeof ca.toColor === 'function') {
          point.dlOptions.backgroundColor = ca.toColor(perf);
        }
      }

      // Set font size based on area of the point
      if (point?.node?.level === 3 && point.shapeArgs && point.dlOptions?.style) {
        const area = point.shapeArgs.width * point.shapeArgs.height;
        point.dlOptions.style.fontSize = `${Math.min(32, 7 + Math.round(area * 0.0008))}px`;
      }
    });
  });
}

const renderChart = (container: HTMLElement, data: any[]) => {
  return Highcharts.chart(container, {
    chart: {
      backgroundColor: '#252931'
    },
    series: [
      {
        name: 'All',
        type: 'treemap',
        layoutAlgorithm: 'squarified',
        allowDrillToNode: true,
        animationLimit: 1000,
        borderColor: '#252931',
        color: '#252931',
        opacity: 0.01,
        nodeSizeBy: 'leaf',
        dataLabels: {
          enabled: false,
          allowOverlap: true,
          style: {
            fontSize: '0.9em',
            textOutline: 'none'
          }
        },
        levels: [
          {
            level: 1,
            dataLabels: {
              enabled: true,
              headers: true,
              align: 'left',
              style: {
                fontWeight: 'bold',
                fontSize: '0.7em',
                lineClamp: 1,
                textTransform: 'uppercase'
              },
              padding: 3
            },
            borderWidth: 3,
            levelIsConstant: false
          },
          {
            level: 2,
            dataLabels: {
              enabled: true,
              headers: true,
              align: 'center',
              shape: 'callout',
              backgroundColor: 'gray',
              borderWidth: 1,
              borderColor: '#252931',
              padding: 0,
              style: {
                color: 'white',
                fontWeight: 'normal',
                fontSize: '0.6em',
                lineClamp: 1,
                textOutline: 'none',
                textTransform: 'uppercase'
              }
            },
            groupPadding: 1
          },
          {
            level: 3,
            dataLabels: {
              enabled: true,
              align: 'center',
              format:
                '{point.name}<br><span style="font-size: 0.7em">{point.custom.performance}</span>',
              style: {
                color: 'white'
              }
            }
          }
        ],
        accessibility: {
          exposeAsGroupOnly: true
        },
        breadcrumbs: {
          buttonTheme: {
            style: {
              color: 'silver'
            },
            states: {
              hover: {
                fill: '#333'
              },
              select: {
                style: {
                  color: 'white'
                }
              }
            }
          }
        },
        data
      } as any
    ],
    title: {
      text: 'S&P 500 Companies',
      align: 'left',
      style: {
        color: 'white'
      }
    },
    subtitle: {
      text: 'Click points to drill down. Source: <a href="http://okfn.org/">okfn.org</a>.',
      align: 'left',
      style: {
        color: 'silver'
      }
    },
    tooltip: {
      followPointer: true,
      outside: true,
      headerFormat: '<span style="font-size: 0.9em">{point.custom.fullName}</span><br/>',
      pointFormat:
        '<b>Market Cap:</b> USD {(divide point.value 1000000000):.1f} bln<br/>' +
        '{#if point.custom.performance}<b>1 month performance:</b> {point.custom.performance}{/if}'
    },
    colorAxis: {
      minColor: '#f73539',
      maxColor: '#2ecc59',
      stops: [
        [0, '#f73539'],
        [0.5, '#414555'],
        [1, '#2ecc59']
      ],
      min: -10,
      max: 10,
      gridLineWidth: 0,
      labels: {
        overflow: 'allow',
        format: '{#gt value 0}+{value}{else}{value}{/gt}%',
        style: {
          color: 'white'
        }
      }
    },
    legend: {
      itemStyle: {
        color: 'white'
      }
    },
    exporting: {
      enabled: false
    },
    credits: { enabled: false }
  });
};

async function getCSV(url: string) {
  const csv = await fetch(url).then(r => r.text());
  const data = new (Highcharts as any).Data({ csv });

  const arr = data.columns[0].map((_: any, i: number) =>
    data.columns.reduce((obj: any, column: any[]) => {
      obj[column[0]] = column[i];
      return obj;
    }, {})
  );

  return arr;
}

export default function DemoTreemapFullscreen() {
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string>('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    initHighchartsOnce();
    initTreemapRelativeFontPluginOnce();

    if (!containerRef.current) return;

    let alive = true;

    (async () => {
      try {
        setError('');

        const csvData = await getCSV(
          'https://cdn.jsdelivr.net/gh/datasets/s-and-p-500-companies-financials@67dd99e/data/constituents-financials.csv'
        );

        const oldData = await getCSV(
          'https://cdn.jsdelivr.net/gh/datasets/s-and-p-500-companies-financials@9f63bc5/data/constituents-financials.csv'
        );

        const data: any[] = [
          { id: 'Technology' },
          { id: 'Financial' },
          { id: 'Consumer Cyclical' },
          { id: 'Communication Services' },
          { id: 'Healthcare' },
          { id: 'Consumer Defensive' },
          { id: 'Industrials' },
          { id: 'Real Estate' },
          { id: 'Energy' },
          { id: 'Utilities' },
          { id: 'Basic Materials' }
        ];

        const sectorToIndustry: Record<string, string> = {
          'Industrial Conglomerates': 'Industrials',
          'Building Products': 'Industrials',
          'Health Care Equipment': 'Healthcare',
          Biotechnology: 'Healthcare',
          'IT Consulting & Other Services': 'Technology',
          'Application Software': 'Technology',
          Semiconductors: 'Technology',
          'Independent Power Producers & Energy Traders': 'Energy',
          'Life & Health Insurance': 'Financial',
          'Life Sciences Tools & Services': 'Healthcare',
          'Industrial Gases': 'Basic Materials',
          'Hotels, Resorts & Cruise Lines': 'Consumer Cyclical',
          'Internet Services & Infrastructure': 'Technology',
          'Specialty Chemicals': 'Basic Materials',
          'Office REITs': 'Real Estate',
          'Health Care Supplies': 'Healthcare',
          'Electric Utilities': 'Utilities',
          'Property & Casualty Insurance': 'Financial',
          'Interactive Media & Services': 'Communication Services',
          Tobacco: 'Consumer Defensive',
          'Broadline Retail': 'Consumer Cyclical',
          'Paper & Plastic Packaging Products & Materials': 'Basic Materials',
          'Diversified Support Services': 'Industrials',
          'Multi-Utilities': 'Utilities',
          'Consumer Finance': 'Financial',
          'Multi-line Insurance': 'Financial',
          'Telecom Tower REITs': 'Real Estate',
          'Water Utilities': 'Utilities',
          'Asset Management & Custody Banks': 'Financial',
          'Electrical Components & Equipment': 'Industrials',
          'Electronic Components': 'Technology',
          'Insurance Brokers': 'Financial',
          'Oil & Gas Exploration & Production': 'Energy',
          'Technology Hardware, Storage & Peripherals': 'Technology',
          'Semiconductor Materials & Equipment': 'Technology',
          'Automotive Parts & Equipment': 'Consumer Cyclical',
          'Agricultural Products & Services': 'Consumer Defensive',
          'Communications Equipment': 'Technology',
          'Integrated Telecommunication Services': 'Communication Services',
          'Gas Utilities': 'Utilities',
          'Human Resource & Employment Services': 'Industrials',
          'Automotive Retail': 'Consumer Cyclical',
          'Multi-Family Residential REITs': 'Real Estate',
          'Aerospace & Defense': 'Industrials',
          'Oil & Gas Equipment & Services': 'Energy',
          'Metal, Glass & Plastic Containers': 'Basic Materials',
          'Diversified Banks': 'Financial',
          'Multi-Sector Holdings': 'Financial',
          'Computer & Electronics Retail': 'Consumer Cyclical',
          Pharmaceuticals: 'Healthcare',
          'Data Processing & Outsourced Services': 'Technology',
          'Distillers & Vintners': 'Consumer Defensive',
          'Air Freight & Logistics': 'Industrials',
          'Casinos & Gaming': 'Consumer Cyclical',
          'Packaged Foods & Meats': 'Consumer Defensive',
          'Health Care Distributors': 'Healthcare',
          'Construction Machinery & Heavy Transportation Equipment': 'Industrials',
          'Financial Exchanges & Data': 'Financial',
          'Real Estate Services': 'Real Estate',
          'Technology Distributors': 'Technology',
          'Managed Health Care': 'Healthcare',
          'Fertilizers & Agricultural Chemicals': 'Basic Materials',
          'Investment Banking & Brokerage': 'Financial',
          'Cable & Satellite': 'Communication Services',
          'Integrated Oil & Gas': 'Energy',
          Restaurants: 'Consumer Cyclical',
          'Household Products': 'Consumer Defensive',
          'Health Care Services': 'Healthcare',
          'Regional Banks': 'Financial',
          'Soft Drinks & Non-alcoholic Beverages': 'Consumer Defensive',
          'Transaction & Payment Processing Services': 'Technology',
          'Consumer Staples Merchandise Retail': 'Consumer Defensive',
          'Systems Software': 'Technology',
          'Rail Transportation': 'Industrials',
          Homebuilding: 'Consumer Cyclical',
          Footwear: 'Consumer Cyclical',
          'Agricultural & Farm Machinery': 'Consumer Cyclical',
          'Passenger Airlines': 'Industrials',
          'Data Center REITs': 'Real Estate',
          'Industrial Machinery & Supplies & Components': 'Industrials',
          'Commodity Chemicals': 'Basic Materials',
          'Interactive Home Entertainment': 'Communication Services',
          'Research & Consulting Services': 'Industrials',
          'Personal Care Products': 'Consumer Defensive',
          Reinsurance: 'Financial',
          'Self-Storage REITs': 'Real Estate',
          'Trading Companies & Distributors': 'Industrials',
          'Retail REITs': 'Real Estate',
          'Automobile Manufacturers': 'Consumer Cyclical',
          Broadcasting: 'Communication Services',
          Copper: 'Basic Materials',
          'Consumer Electronics': 'Technology',
          'Heavy Electrical Equipment': 'Industrials',
          Distributors: 'Industrials',
          'Leisure Products': 'Consumer Cyclical',
          'Health Care Facilities': 'Healthcare',
          'Health Care REITs': 'Real Estate',
          'Home Improvement Retail': 'Consumer Cyclical',
          'Hotel & Resort REITs': 'Real Estate',
          Advertising: 'Communication Services',
          'Single-Family Residential REITs': 'Real Estate',
          'Other Specialized REITs': 'Real Estate',
          'Cargo Ground Transportation': 'Industrials',
          'Electronic Manufacturing Services': 'Technology',
          'Construction & Engineering': 'Industrials',
          'Electronic Equipment & Instruments': 'Technology',
          'Oil & Gas Storage & Transportation': 'Energy',
          'Food Retail': 'Consumer Defensive',
          'Movies & Entertainment': 'Communication Services',
          'Apparel, Accessories & Luxury Goods': 'Consumer Cyclical',
          'Oil & Gas Refining & Marketing': 'Energy',
          'Construction Materials': 'Basic Materials',
          'Home Furnishings': 'Consumer Cyclical',
          Brewers: 'Consumer Defensive',
          Gold: 'Basic Materials',
          Publishing: 'Communication Services',
          Steel: 'Basic Materials',
          'Industrial REITs': 'Real Estate',
          'Environmental & Facilities Services': 'Industrials',
          'Apparel Retail': 'Consumer Cyclical',
          'Health Care Technology': 'Healthcare',
          'Food Distributors': 'Consumer Defensive',
          'Wireless Telecommunication Services': 'Communication Services',
          'Other Specialty Retail': 'Consumer Cyclical',
          'Passenger Ground Transportation': 'Industrials',
          'Drug Retail': 'Consumer Cyclical',
          'Timber REITs': 'Real Estate'
        };

        csvData.forEach((row: any) => {
          const sector = row.Sector;
          if (!data.find(point => point.id === sector)) {
            data.push({
              id: sector,
              parent: sectorToIndustry[sector]
            });
          }
        });

        data.forEach(point => {
          point.name = point.id;
          point.custom = { fullName: point.id };
        });

        csvData
          .filter((row: any) => row.Symbol !== 'GOOG' && row.Price && row['Market Cap'])
          .forEach((row: any) => {
            const old = oldData.find((oldRow: any) => oldRow.Symbol === row.Symbol);

            let perf: number | null = null;
            if (old) {
              const oldPrice = parseFloat(old.Price);
              const newPrice = parseFloat(row.Price);
              perf = 100 * (newPrice - oldPrice) / oldPrice;
            }

            data.push({
              name: row.Symbol,
              id: row.Symbol,
              value: parseFloat(row['Market Cap']),
              parent: row.Sector,
              colorValue: perf,
              custom: {
                fullName: row.Name,
                performance: (perf !== null && perf < 0 ? '' : '+') + (perf ?? 0).toFixed(2) + '%'
              }
            });
          });

        if (!alive) return;

        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }

        chartRef.current = renderChart(containerRef.current!, data);

        const ro = new ResizeObserver(() => {
          if (chartRef.current) chartRef.current.reflow();
        });
        ro.observe(containerRef.current!);

        return () => ro.disconnect();
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message || e));
      }
    })();

    return () => {
      alive = false;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, padding: 14 }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 18,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.10)',
            background: '#252931',
            boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
            position: 'relative'
          }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 40,
              height: 40,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontWeight: 1000,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: '40px',
              textAlign: 'center',
              zIndex: 10
            }}
            title="Fechar"
          >
            ✕
          </button>

          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

          {error ? (
            <div
              style={{
                position: 'absolute',
                left: 14,
                bottom: 14,
                right: 14,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#ff6b6b',
                fontWeight: 900,
                zIndex: 10
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
