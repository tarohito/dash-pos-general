import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  LinearScale,
  CategoryScale,
  Tooltip as ChartTooltip,
  Plugin,
} from 'chart.js';
import {
  DashboardPaymentBreakdownItem,
  DashboardTopItem,
} from '../../types';
import { GoogleIcon } from '../common/GoogleIcon';
import { formatCompactIDR, formatIDR } from '../../utils/formatters';

Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  LinearScale,
  CategoryScale,
  ChartTooltip
);

function hexToRgba(hex: string, alpha: number, fallbackRgb = '142, 66, 255') {
  const clean = hex.trim().replace('#', '');
  if (clean.length !== 6) return `rgba(${fallbackRgb}, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(n => Number.isNaN(n))) {
    return `rgba(${fallbackRgb}, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function truncateLabel(text: string, maxLen = 22): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

interface TopSellingChartCardProps {
  period: 'HARI' | 'BULAN';
  topProducts: DashboardTopItem[];
  topCategories: DashboardTopItem[];
}

export const TopSellingChartCard: React.FC<TopSellingChartCardProps> = ({
  period,
  topProducts,
  topCategories,
}) => {
  const [viewMode, setViewMode] = useState<'products' | 'categories'>('products');
  const [themeVersion, setThemeVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<'bar'> | null>(null);

  const items = viewMode === 'products' ? topProducts : topCategories;

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeVersion(v => v + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-app-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || items.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const rootStyles = window.getComputedStyle(document.documentElement);
    const primaryColor = rootStyles.getPropertyValue('--color-primary').trim() || '#8e42ff';
    const secondaryColor = rootStyles.getPropertyValue('--color-secondary').trim() || '#0f766e';

    const barBaseColor = viewMode === 'products' ? primaryColor : secondaryColor;
    const labels = items.map(item => truncateLabel(item.name, 20));
    const values = items.map(item => (viewMode === 'products' ? item.qty : item.sales));
    const maxVal = Math.max(...values, 1);

    let isVisible = false;
    let hasRevealed = false;
    let isRevealing = false;
    let revealTimer: number | null = null;
    let rafId: number | null = null;
    const pulseStartTime = performance.now();

    // Subtle living shimmer highlight traveling across the #1 top bar
    const topBarGlowPlugin: Plugin<'bar'> = {
      id: 'topBarShimmer',
      afterDatasetsDraw(chart) {
        if (prefersReducedMotion || !isVisible || isRevealing) return;
        const meta = chart.getDatasetMeta(0);
        const topBar = meta?.data?.[0];
        if (!topBar) return;

        const props = topBar.getProps(['x', 'y', 'base', 'height'], true) as {
          x?: number;
          y?: number;
          base?: number;
          height?: number;
        };
        const xEnd = props.x ?? 0;
        const xStart = props.base ?? 0;
        const yCenter = props.y ?? 0;
        const barH = props.height ?? 18;
        const barW = xEnd - xStart;
        if (barW <= 12) return;

        const cycle = ((performance.now() - pulseStartTime) % 2800) / 2800;
        const shimmerX = xStart + barW * cycle;
        const c = chart.ctx;
        c.save();
        c.beginPath();
        c.roundRect(xStart, yCenter - barH / 2, barW, barH, 6);
        c.clip();

        const grad = c.createLinearGradient(shimmerX - 28, 0, shimmerX + 28, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = grad;
        c.fillRect(xStart, yCenter - barH / 2, barW, barH);
        c.restore();
      },
    };

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: viewMode === 'products' ? 'Unit Terjual' : 'Omzet',
            data: prefersReducedMotion ? values : values.map(() => 0),
            backgroundColor: items.map((_, idx) =>
              hexToRgba(barBaseColor, Math.max(0.45, 0.92 - idx * 0.11))
            ),
            hoverBackgroundColor: barBaseColor,
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 18,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: prefersReducedMotion
          ? false
          : {
              duration: 780,
              easing: 'easeOutQuart',
            },
        animations: prefersReducedMotion
          ? undefined
          : {
              x: {
                duration: 820,
                easing: 'easeOutQuart',
                delay: ctxItem =>
                  ctxItem.type === 'data' ? ctxItem.dataIndex * 90 : 0,
              },
            },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleColor: '#ffffff',
            bodyColor: '#e4e4e7',
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              title: contexts => {
                const idx = contexts[0]?.dataIndex ?? 0;
                return items[idx]?.name ?? '';
              },
              label: context => {
                const idx = context.dataIndex ?? 0;
                const item = items[idx];
                if (!item) return '';
                return [
                  `Terjual: ${item.qty} pcs`,
                  `Omzet: ${formatIDR(item.sales)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMax: viewMode === 'products' ? Math.max(2, Math.ceil(maxVal * 1.15)) : Math.ceil(maxVal * 1.15),
            grid: {
              color: 'rgba(228, 228, 231, 0.7)',
            },
            border: { display: false },
            ticks: {
              color: '#71717a',
              font: { size: 11, family: 'Open Sans, sans-serif' },
              maxTicksLimit: 5,
              callback: value => {
                const num = Number(value);
                if (viewMode === 'products') {
                  return Number.isInteger(num) ? `${num}` : '';
                }
                return formatCompactIDR(num);
              },
            },
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#27272a',
              font: { size: 12, weight: 600, family: 'Open Sans, sans-serif' },
            },
          },
        },
      },
      plugins: [topBarGlowPlugin],
    });

    chartRef.current = chart;

    const startShimmerLoop = () => {
      if (prefersReducedMotion || rafId !== null) return;
      const tick = () => {
        if (!isVisible) {
          rafId = null;
          return;
        }
        if (!isRevealing && chart.getActiveElements().length === 0) {
          chart.draw();
        }
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    };

    const stopShimmerLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const triggerReveal = () => {
      if (hasRevealed || prefersReducedMotion) return;
      hasRevealed = true;
      isRevealing = true;
      chart.data.datasets[0].data = [...values];
      chart.update();
      revealTimer = window.setTimeout(() => {
        isRevealing = false;
        startShimmerLoop();
      }, 900 + items.length * 90);
    };

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry) return;
        isVisible = entry.isIntersecting;
        if (isVisible) {
          if (!hasRevealed) {
            triggerReveal();
          } else {
            startShimmerLoop();
          }
        } else {
          stopShimmerLoop();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      stopShimmerLoop();
      if (revealTimer) window.clearTimeout(revealTimer);
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [items, viewMode, themeVersion]);

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items]
  );

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 flex flex-col"
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5 pb-3 mb-3 border-b border-zinc-100">
        <div className="min-w-0">
          <h4 className="text-sm sm:text-base font-bold text-zinc-950">
            {viewMode === 'products' ? 'Top 5 Produk Terlaris' : 'Top 5 Kategori Terlaris'}
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            {period === 'HARI'
              ? 'Peringkat penjualan tertinggi hari ini'
              : 'Peringkat penjualan tertinggi bulan berjalan'}
          </p>
        </div>

        <div className="inline-flex h-8 p-0.5 bg-zinc-100 rounded-full border border-zinc-200 items-center shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('products')}
            className={`h-full px-3 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              viewMode === 'products'
                ? 'bg-primary text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Produk
          </button>
          <button
            type="button"
            onClick={() => setViewMode('categories')}
            className={`h-full px-3 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              viewMode === 'categories'
                ? 'bg-secondary text-white shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Kategori
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 min-h-[210px] flex flex-col items-center justify-center text-center py-8 px-4 text-zinc-400">
          <GoogleIcon name="bar_chart" size={32} className="text-zinc-300 mb-2" />
          <p className="text-xs sm:text-sm font-semibold text-zinc-600">
            Belum ada data penjualan produk
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {period === 'HARI'
              ? 'Grafik otomatis muncul setelah ada transaksi selesai hari ini.'
              : 'Grafik otomatis muncul setelah ada transaksi selesai bulan ini.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="relative w-full h-[185px] sm:h-[205px]">
            <canvas
              ref={canvasRef}
              aria-label={
                viewMode === 'products'
                  ? 'Grafik Top 5 Produk Terlaris'
                  : 'Grafik Top 5 Kategori Terlaris'
              }
            />
          </div>

          <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              Teratas:{' '}
              <strong className="text-zinc-900 font-semibold">
                {items[0]?.name}
              </strong>
            </span>
            <span className="font-mono font-semibold text-zinc-700 shrink-0 tabular-nums">
              {totalUnits} pcs total
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

interface PaymentBreakdownChartCardProps {
  period: 'HARI' | 'BULAN';
  totalAmount: number;
  totalTransactions: number;
  breakdown: DashboardPaymentBreakdownItem[];
}

export const PaymentBreakdownChartCard: React.FC<PaymentBreakdownChartCardProps> = ({
  period,
  totalAmount,
  totalTransactions,
  breakdown,
}) => {
  const [themeVersion, setThemeVersion] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [animatedTotal, setAnimatedTotal] = useState(totalAmount);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<'doughnut'> | null>(null);
  const isRevealingRef = useRef(false);
  const prevHoveredRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeVersion(v => v + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-app-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const palette = useMemo(() => {
    if (typeof window === 'undefined') {
      return ['#0f766e', '#8e42ff', '#f59e0b', '#0284c7', '#4f46e5', '#e11d48'];
    }
    const rootStyles = window.getComputedStyle(document.documentElement);
    const primaryColor = rootStyles.getPropertyValue('--color-primary').trim() || '#8e42ff';
    const secondaryColor = rootStyles.getPropertyValue('--color-secondary').trim() || '#0f766e';
    const accentColor = rootStyles.getPropertyValue('--color-accent').trim() || '#f59e0b';
    return [secondaryColor, primaryColor, accentColor, '#0284c7', '#4f46e5', '#059669'];
  }, [themeVersion]);

  // Synchronize row hover highlight with Doughnut slice active state
  useEffect(() => {
    const prev = prevHoveredRef.current;
    prevHoveredRef.current = hoveredIdx;
    if (prev === hoveredIdx || isRevealingRef.current) return;

    const chart = chartRef.current;
    if (!chart) return;
    if (hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < breakdown.length) {
      chart.setActiveElements([{ datasetIndex: 0, index: hoveredIdx }]);
    } else {
      chart.setActiveElements([]);
    }
    chart.update('none');
  }, [hoveredIdx, breakdown.length]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || breakdown.length === 0) {
      setAnimatedTotal(totalAmount);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const sliceColors = breakdown.map((_, idx) => palette[idx % palette.length]);
    const amounts = breakdown.map(b => b.amount);

    let hasRevealed = false;
    let countUpRaf: number | null = null;

    if (prefersReducedMotion) {
      setAnimatedTotal(totalAmount);
    } else {
      setAnimatedTotal(0);
    }

    const startCountUp = () => {
      if (prefersReducedMotion) {
        setAnimatedTotal(totalAmount);
        return;
      }
      const start = performance.now();
      const duration = 820;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutQuart
        const eased = 1 - Math.pow(1 - t, 4);
        setAnimatedTotal(Math.round(totalAmount * eased));
        if (t < 1) {
          countUpRaf = window.requestAnimationFrame(tick);
        } else {
          setAnimatedTotal(totalAmount);
          countUpRaf = null;
        }
      };
      countUpRaf = window.requestAnimationFrame(tick);
    };

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: breakdown.map(b => b.label),
        datasets: [
          {
            data: prefersReducedMotion ? amounts : amounts.map(() => 0),
            backgroundColor: sliceColors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        animation: prefersReducedMotion
          ? false
          : {
              animateRotate: true,
              animateScale: true,
              duration: 850,
              easing: 'easeOutQuart',
            },
        onHover: (_event, elements) => {
          const activeIdx = elements[0]?.index ?? null;
          setHoveredIdx(prev => (prev === activeIdx ? prev : activeIdx));
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleColor: '#ffffff',
            bodyColor: '#e4e4e7',
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: context => {
                const item = breakdown[context.dataIndex ?? 0];
                if (!item) return '';
                return `${formatIDR(item.amount)} (${item.percent}% · ${item.count} nota)`;
              },
            },
          },
        },
      },
    });

    chartRef.current = chart;

    let revealTimer: number | null = null;
    isRevealingRef.current = false;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting || hasRevealed) return;
        hasRevealed = true;
        if (!prefersReducedMotion) {
          isRevealingRef.current = true;
          chart.data.datasets[0].data = [...amounts];
          chart.update();
          startCountUp();
          revealTimer = window.setTimeout(() => {
            isRevealingRef.current = false;
          }, 880);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      isRevealingRef.current = false;
      if (revealTimer !== null) {
        window.clearTimeout(revealTimer);
      }
      if (countUpRaf !== null) {
        window.cancelAnimationFrame(countUpRaf);
      }
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [breakdown, palette, totalAmount]);

  const activeItem =
    hoveredIdx !== null && breakdown[hoveredIdx] ? breakdown[hoveredIdx] : null;

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-zinc-100">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-zinc-950">
            Komposisi Metode Pembayaran
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            {period === 'HARI'
              ? 'Distribusi pembayaran Tunai & Transfer Bank hari ini'
              : 'Distribusi pembayaran Tunai & Transfer Bank bulan berjalan'}
          </p>
        </div>
        {totalTransactions > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-mono font-semibold text-zinc-700 shrink-0 tabular-nums">
            {totalTransactions} Nota
          </span>
        )}
      </div>

      {breakdown.length === 0 ? (
        <div className="flex-1 min-h-[210px] flex flex-col items-center justify-center text-center py-8 px-4 text-zinc-400">
          <GoogleIcon name="pie_chart" size={32} className="text-zinc-300 mb-2" />
          <p className="text-xs sm:text-sm font-semibold text-zinc-600">
            Belum ada pembayaran masuk
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Rasio Tunai dan Transfer Bank akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          <div
            className="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0"
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <canvas ref={canvasRef} aria-label="Grafik Komposisi Metode Pembayaran" />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-3 text-center transition-all duration-150">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 truncate max-w-[92px]">
                {activeItem ? activeItem.label : 'Total'}
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-zinc-950 leading-tight mt-0.5 tabular-nums">
                {formatCompactIDR(activeItem ? activeItem.amount : animatedTotal)}
              </span>
              {activeItem && (
                <span className="text-[10px] font-semibold font-mono text-primary mt-0.5 tabular-nums">
                  {activeItem.percent}%
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 w-full space-y-2 min-w-0">
            {breakdown.map((item, idx) => {
              const color = palette[idx % palette.length];
              const isHighlighted = hoveredIdx === idx;
              return (
                <div
                  key={item.key}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border transition-all duration-150 cursor-default ${
                    isHighlighted
                      ? 'bg-white border-zinc-300 shadow-xs scale-[1.01]'
                      : 'bg-zinc-50/80 border-zinc-200/70'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-150 ${
                        isHighlighted ? 'scale-125' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                        {item.count} nota
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-bold font-mono text-zinc-950 tabular-nums">
                      {formatIDR(item.amount)}
                    </p>
                    <p className="text-[11px] font-semibold font-mono text-zinc-500 tabular-nums">
                      {item.percent}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
