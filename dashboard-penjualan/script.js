/**
 * Dashboard Penjualan 2024
 * script.js — Data processing & Chart.js visualizations
 */

/* =============================================
   PALETTE & GLOBAL CONFIG
   ============================================= */
const PALETTE = {
  blue:    '#3b82f6',
  emerald: '#10b981',
  violet:  '#8b5cf6',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  cyan:    '#06b6d4',
  orange:  '#f97316',
  indigo:  '#6366f1',
  teal:    '#14b8a6',
  pink:    '#ec4899',
};
const COLORS = Object.values(PALETTE);
const COLORS_ALPHA = (hex, a = 0.15) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

Chart.defaults.font.family = "-apple-system, 'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size   = 12;
Chart.defaults.color       = '#64748b';
Chart.defaults.plugins.legend.labels.boxWidth  = 12;
Chart.defaults.plugins.legend.labels.padding   = 14;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.cornerRadius    = 8;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.88)';
Chart.defaults.plugins.tooltip.titleFont       = { weight: '700', size: 13 };

/* =============================================
   CHART REGISTRY — destroy before re-render
   ============================================= */
const charts = {};
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* =============================================
   HELPERS
   ============================================= */
const fmtCurrency = (n) =>
  n >= 1e9
    ? 'Rp ' + (n / 1e9).toFixed(1) + ' M'
    : n >= 1e6
    ? 'Rp ' + (n / 1e6).toFixed(1) + ' Jt'
    : 'Rp ' + n.toLocaleString('id-ID');

const fmtFull = (n) => 'Rp ' + n.toLocaleString('id-ID');

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}
function sumBy(arr, key, valueKey) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    acc[k] = (acc[k] || 0) + item[valueKey];
    return acc;
  }, {});
}

/* =============================================
   MAIN — FETCH DATA & BOOT
   ============================================= */
let RAW_DATA = [];

async function loadData() {
  showLoader(true);
  try {
    const res  = await fetch('data.json');
    const json = await res.json();
    RAW_DATA = json.sales;

    // Set last updated timestamp
    document.getElementById('lastUpdated').textContent =
      'Update: ' + new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });

    bindFilters();
    render(RAW_DATA);
  } catch (e) {
    console.error('Gagal memuat data.json:', e);
    alert('Gagal memuat data. Pastikan file data.json tersedia dan server aktif.');
  } finally {
    showLoader(false);
  }
}

function showLoader(show) {
  let el = document.getElementById('loadingOverlay');
  if (!el && show) {
    el = document.createElement('div');
    el.id = 'loadingOverlay';
    el.className = 'loading-overlay';
    el.innerHTML = `<div class="spinner"></div><p style="color:#64748b;font-size:0.85rem">Memuat data…</p>`;
    document.body.appendChild(el);
  } else if (el) {
    el.style.display = show ? 'flex' : 'none';
  }
}

/* =============================================
   FILTERS
   ============================================= */
function bindFilters() {
  const onFilter = () => {
    const month  = document.getElementById('filterMonth').value;
    const region = document.getElementById('filterRegion').value;
    let data = RAW_DATA;
    if (month !== 'all')  data = data.filter(d => new Date(d.date).getMonth() + 1 === +month);
    if (region !== 'all') data = data.filter(d => d.region === region);
    render(data);
  };
  document.getElementById('filterMonth').addEventListener('change', onFilter);
  document.getElementById('filterRegion').addEventListener('change', onFilter);
}

/* =============================================
   RENDER — orchestrates all components
   ============================================= */
function render(data) {
  renderKPIs(data);
  renderSalesTrend(data);
  renderRegionChart(data);
  renderCategoryRevenue(data);
  renderSalesRep(data);
  renderCustomerType(data);
  renderPaymentMethod(data);
  renderChannel(data);
  renderScatter(data);
  renderTop10(data);
  renderQtyCategory(data);
}

/* =============================================
   KPI CARDS
   ============================================= */
function renderKPIs(data) {
  const totalRevenue      = data.reduce((s, d) => s + d.revenue, 0);
  const totalTransactions = data.length;
  const totalQuantity     = data.reduce((s, d) => s + d.quantity, 0);
  const avgDiscount       = data.length
    ? (data.reduce((s, d) => s + d.discount, 0) / data.length * 100).toFixed(1)
    : 0;

  document.getElementById('kpiRevenue').textContent      = fmtCurrency(totalRevenue);
  document.getElementById('kpiRevenueSub').textContent   = fmtFull(totalRevenue);
  document.getElementById('kpiTransactions').textContent = totalTransactions.toLocaleString('id-ID');
  document.getElementById('kpiTransactionsSub').textContent = `${(totalRevenue / (totalTransactions || 1) / 1e6).toFixed(1)} Jt avg/transaksi`;
  document.getElementById('kpiQuantity').textContent     = totalQuantity.toLocaleString('id-ID') + ' unit';
  document.getElementById('kpiQuantitySub').textContent  = `${(totalQuantity / (totalTransactions || 1)).toFixed(1)} unit rata-rata`;
  document.getElementById('kpiDiscount').textContent     = avgDiscount + '%';
  document.getElementById('kpiDiscountSub').textContent  = 'Rata-rata per transaksi';
}

/* =============================================
   1. SALES TREND (Line Chart — dual axis)
   ============================================= */
function renderSalesTrend(data) {
  destroyChart('salesTrend');
  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const monthlyRevenue = Array(12).fill(0);
  const monthlyTx      = Array(12).fill(0);

  data.forEach(d => {
    const m = new Date(d.date).getMonth();
    monthlyRevenue[m] += d.revenue;
    monthlyTx[m]++;
  });

  const activeMonths = MONTHS.filter((_, i) => monthlyRevenue[i] > 0 || monthlyTx[i] > 0);
  const activeRevenue = monthlyRevenue.filter((_, i) => activeMonths.includes(MONTHS[i]) || true);
  // Use all months but hide zero months in display
  const labels = MONTHS;

  const ctx = document.getElementById('salesTrendChart').getContext('2d');
  charts['salesTrend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue (Jt)',
          data: monthlyRevenue.map(v => +(v / 1e6).toFixed(1)),
          borderColor: PALETTE.blue,
          backgroundColor: COLORS_ALPHA(PALETTE.blue, 0.08),
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: PALETTE.blue,
          yAxisID: 'yRevenue',
        },
        {
          label: 'Transaksi',
          data: monthlyTx,
          borderColor: PALETTE.emerald,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: PALETTE.emerald,
          yAxisID: 'yTx',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: '#f1f5f9' } },
        yRevenue: {
          type: 'linear',
          position: 'left',
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => 'Rp ' + v + ' Jt' }
        },
        yTx: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { stepSize: 1 }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ctx.dataset.yAxisID === 'yRevenue'
              ? ` Revenue: Rp ${ctx.parsed.y} Jt`
              : ` Transaksi: ${ctx.parsed.y}`
          }
        }
      }
    }
  });
}

/* =============================================
   2. REVENUE PER REGION (Doughnut)
   ============================================= */
function renderRegionChart(data) {
  destroyChart('region');
  const regionRevenue = sumBy(data, 'region', 'revenue');
  const labels = Object.keys(regionRevenue);
  const values = Object.values(regionRevenue);

  const ctx = document.getElementById('regionChart').getContext('2d');
  charts['region'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 10 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmtCurrency(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* =============================================
   3. REVENUE PER CATEGORY (Vertical Bar)
   ============================================= */
function renderCategoryRevenue(data) {
  destroyChart('catRevenue');
  const catRevenue = sumBy(data, 'category', 'revenue');
  const sorted = Object.entries(catRevenue).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1] / 1e6);

  const ctx = document.getElementById('categoryRevenueChart').getContext('2d');
  charts['catRevenue'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (Juta Rp)',
        data: values,
        backgroundColor: [PALETTE.blue, PALETTE.violet, PALETTE.emerald],
        borderRadius: 7,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => 'Rp ' + v + ' Jt' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Revenue: Rp ${ctx.parsed.y.toFixed(1)} Jt`
          }
        }
      }
    }
  });
}

/* =============================================
   4. SALES PER SALES REP (Horizontal Bar)
   ============================================= */
function renderSalesRep(data) {
  destroyChart('salesRep');
  const repRevenue = sumBy(data, 'sales_rep', 'revenue');
  const sorted = Object.entries(repRevenue).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1] / 1e6);

  const ctx = document.getElementById('salesRepChart').getContext('2d');
  charts['salesRep'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (Juta Rp)',
        data: values,
        backgroundColor: COLORS.slice(0, labels.length).map(c => COLORS_ALPHA(c, 0.85)),
        borderColor:     COLORS.slice(0, labels.length),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => 'Rp ' + v + ' Jt' }
        },
        y: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Revenue: Rp ${ctx.parsed.x.toFixed(1)} Jt`
          }
        }
      }
    }
  });
}

/* =============================================
   5. CUSTOMER TYPE (Pie)
   ============================================= */
function renderCustomerType(data) {
  destroyChart('custType');
  const counts = groupBy(data, 'customer_type');
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const total  = values.reduce((a, b) => a + b, 0);

  const ctx = document.getElementById('customerTypeChart').getContext('2d');
  charts['custType'] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [PALETTE.blue, PALETTE.emerald],
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.parsed} transaksi (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* =============================================
   6. PAYMENT METHOD (Polar Area)
   ============================================= */
function renderPaymentMethod(data) {
  destroyChart('payment');
  const counts = groupBy(data, 'payment_method');
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  const ctx = document.getElementById('paymentChart').getContext('2d');
  charts['payment'] = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS.slice(0, labels.length).map(c => COLORS_ALPHA(c, 0.75)),
        borderColor:     COLORS.slice(0, labels.length),
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          ticks: { backdropColor: 'transparent', stepSize: 2 },
          grid: { color: '#e2e8f0' }
        }
      },
      plugins: {
        legend: { position: 'bottom', labels: { padding: 8 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.r} transaksi`
          }
        }
      }
    }
  });
}

/* =============================================
   7. SALES CHANNEL (Doughnut)
   ============================================= */
function renderChannel(data) {
  destroyChart('channel');
  const channelRevenue = sumBy(data, 'channel', 'revenue');
  const labels = Object.keys(channelRevenue);
  const values = Object.values(channelRevenue);
  const total  = values.reduce((a, b) => a + b, 0);

  const ctx = document.getElementById('channelChart').getContext('2d');
  charts['channel'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [PALETTE.cyan, PALETTE.orange, PALETTE.violet],
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmtCurrency(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* =============================================
   8. DISCOUNT vs SALES (Scatter Plot)
   ============================================= */
function renderScatter(data) {
  destroyChart('scatter');

  // Group by category for color coding
  const categories = [...new Set(data.map(d => d.category))];
  const catColorMap = {};
  categories.forEach((c, i) => catColorMap[c] = COLORS[i % COLORS.length]);

  const datasets = categories.map(cat => ({
    label: cat,
    data: data
      .filter(d => d.category === cat)
      .map(d => ({ x: +(d.discount * 100).toFixed(0), y: +(d.revenue / 1e6).toFixed(2) })),
    backgroundColor: COLORS_ALPHA(catColorMap[cat], 0.65),
    borderColor: catColorMap[cat],
    borderWidth: 1,
    pointRadius: 6,
    pointHoverRadius: 9,
  }));

  const ctx = document.getElementById('scatterChart').getContext('2d');
  charts['scatter'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Diskon (%)', color: '#64748b', font: { weight: '600' } },
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => v + '%' }
        },
        y: {
          title: { display: true, text: 'Revenue (Juta Rp)', color: '#64748b', font: { weight: '600' } },
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => 'Rp ' + v + ' Jt' }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: Diskon ${ctx.parsed.x}%, Revenue Rp ${ctx.parsed.y} Jt`
          }
        }
      }
    }
  });
}

/* =============================================
   9. TOP 10 HIGHEST SALES (Horizontal Bar)
   ============================================= */
function renderTop10(data) {
  destroyChart('top10');
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const labels = sorted.map(d => `${d.product} (${d.date.slice(0,7)})`);
  const values = sorted.map(d => +(d.revenue / 1e6).toFixed(1));
  const bgs    = sorted.map((_, i) => {
    const ratio = 1 - i * 0.08;
    return `rgba(59,130,246,${(ratio * 0.85).toFixed(2)})`;
  });

  const ctx = document.getElementById('top10Chart').getContext('2d');
  charts['top10'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (Juta Rp)',
        data: values,
        backgroundColor: bgs,
        borderColor: PALETTE.blue,
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { callback: v => 'Rp ' + v + ' Jt' }
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Revenue: Rp ${ctx.parsed.x} Jt`
          }
        }
      }
    }
  });
}

/* =============================================
   10. QUANTITY PER CATEGORY (Vertical Bar)
   ============================================= */
function renderQtyCategory(data) {
  destroyChart('qtyCat');
  const catQty = data.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + d.quantity;
    return acc;
  }, {});
  const sorted = Object.entries(catQty).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  const ctx = document.getElementById('qtyCategoryChart').getContext('2d');
  charts['qtyCat'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Qty Terjual',
        data: values,
        backgroundColor: COLORS.slice(0, labels.length).map(c => COLORS_ALPHA(c, 0.8)),
        borderColor:     COLORS.slice(0, labels.length),
        borderWidth: 1.5,
        borderRadius: 7,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { stepSize: 20 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Qty: ${ctx.parsed.y} unit`
          }
        }
      }
    }
  });
}

/* =============================================
   BOOT
   ============================================= */
document.addEventListener('DOMContentLoaded', loadData);
