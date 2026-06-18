const STORAGE_KEY = 'hustle_entries_v2';

const COSTS = { popsicle: 0.164, water: 0.182, soda: 0.619 };

function calcCost(e) {
  return (e.popsicles || 0) * COSTS.popsicle
       + (e.water     || 0) * COSTS.water
       + (e.soda      || 0) * COSTS.soda;
}

function calcProfit(e) { return e.revenue - calcCost(e); }
function calcProfitRate(e) { return e.hours > 0 ? calcProfit(e) / e.hours : 0; }
function hasProductData(e) {
  return (e.popsicles != null) || (e.water != null) || (e.soda != null);
}

function parseProd(id) {
  const raw = document.getElementById(id).value.trim();
  if (raw === '') return undefined;
  const v = parseFloat(raw);
  return isNaN(v) ? undefined : v;
}

let revenueChart    = null;
let profitChart     = null;
let hoursChart      = null;
let cumulativeChart = null;
let paceChart       = null;
let volumePie       = null;
let breakdownPie    = null;
let breakdownMode   = 'revenue';

const chartTypes = { revenue: 'line', profit: 'line', hours: 'line', cumulative: 'line', pace: 'line' };

function destroyAndNull(key) {
  const fns = {
    revenue:    () => { if (revenueChart)    { revenueChart.destroy();    revenueChart    = null; } },
    profit:     () => { if (profitChart)     { profitChart.destroy();     profitChart     = null; } },
    hours:      () => { if (hoursChart)      { hoursChart.destroy();      hoursChart      = null; } },
    cumulative: () => { if (cumulativeChart) { cumulativeChart.destroy(); cumulativeChart = null; } },
    pace:       () => { if (paceChart)       { paceChart.destroy();       paceChart       = null; } }
  };
  fns[key]?.();
}

function lineDs(color, extra = {}) {
  return { borderColor: color, backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 3, pointBackgroundColor: color, pointHoverRadius: 5, tension: 0.35, ...extra };
}
function barDs(color) {
  return { backgroundColor: color + 'BB', borderColor: color, borderWidth: 1, borderRadius: 3, borderSkipped: false };
}
function ds(type, color, lineExtra = {}) {
  return type === 'bar' ? barDs(color) : lineDs(color, lineExtra);
}

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function fmtMoney(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoneyShort(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sorted(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Stats ── */
function updateStats(entries) {
  const n = entries.length;
  const totalRevenue = entries.reduce((s, e) => s + e.revenue, 0);
  const totalHours   = entries.reduce((s, e) => s + e.hours, 0);
  const avgDay  = n > 0 ? totalRevenue / n : 0;
  const rateAvg = totalHours > 0 ? totalRevenue / totalHours : 0;

  let best = null;
  for (const e of entries) if (!best || e.revenue > best.revenue) best = e;

  document.getElementById('days-logged').textContent =
    n + ' day' + (n === 1 ? '' : 's') + ' logged';

  const rateEl = document.getElementById('rate-avg');
  rateEl.textContent = totalHours > 0 ? fmtMoney(rateAvg) + '/hr avg' : '';

  document.getElementById('stat-revenue').textContent = fmtMoneyShort(totalRevenue);
  document.getElementById('stat-hours').textContent   = totalHours.toFixed(1) + 'h';
  document.getElementById('stat-avg').textContent     = fmtMoneyShort(avgDay);

  if (best) {
    document.getElementById('stat-best-val').textContent  = fmtMoneyShort(best.revenue);
    document.getElementById('stat-best-date').textContent = fmtDate(best.date);
  } else {
    document.getElementById('stat-best-val').textContent  = '—';
    document.getElementById('stat-best-date').textContent = '';
  }
}

/* ── Chart helpers ── */
function scaleBase() {
  const c = chartColors();
  return {
    grid:   { color: c.grid },
    border: { color: c.border },
    ticks:  { color: c.tick, font: { size: 11, family: 'Inter, sans-serif' } }
  };
}

function tooltipBase() {
  const c = chartColors();
  return {
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    borderWidth: 1,
    titleColor: c.tooltipTitle,
    bodyColor:  c.tooltipBody,
    titleFont: { family: 'Inter, sans-serif', size: 11 },
    bodyFont:  { family: 'Inter, sans-serif', size: 12 }
  };
}

/* ── Revenue + rate chart ── */
function renderRevenueChart(entries) {
  const s = sorted(entries);
  const labels      = s.map(e => fmtDate(e.date));
  const revenueData = s.map(e => e.revenue);
  const rateData    = s.map(e => e.hours > 0 ? +(e.revenue / e.hours).toFixed(2) : 0);

  const ctx = document.getElementById('revenue-chart').getContext('2d');

  if (revenueChart) {
    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = revenueData;
    revenueChart.data.datasets[1].data = rateData;
    revenueChart.update();
    return;
  }

  const t = chartTypes.revenue;
  revenueChart = new Chart(ctx, {
    type: t,
    data: {
      labels,
      datasets: [
        { label: 'Revenue',   data: revenueData, ...ds(t, '#2db87a'),                           yAxisID: 'y' },
        { label: '$/hr rate', data: rateData,    ...ds(t, '#c8820a', { borderDash: [5, 4] }),   yAxisID: 'y' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase(),
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: {
          ...scaleBase(),
          ticks: { ...scaleBase().ticks, maxTicksLimit: 8 }
        },
        y: {
          ...scaleBase(),
          beginAtZero: true,
          ticks: { ...scaleBase().ticks, callback: v => '$' + v }
        }
      }
    }
  });
}

/* ── Profit chart ── */
function renderProfitChart(entries) {
  const s = sorted(entries);
  const labels     = s.map(e => fmtDate(e.date));
  const profitData = s.map(e => hasProductData(e) ? +calcProfit(e).toFixed(2) : null);
  const rateData   = s.map(e => hasProductData(e) ? +calcProfitRate(e).toFixed(2) : null);

  const ctx = document.getElementById('profit-chart').getContext('2d');

  if (profitChart) {
    profitChart.data.labels = labels;
    profitChart.data.datasets[0].data = profitData;
    profitChart.data.datasets[1].data = rateData;
    profitChart.update();
    return;
  }

  const tp = chartTypes.profit;
  profitChart = new Chart(ctx, {
    type: tp,
    data: {
      labels,
      datasets: [
        { label: 'Profit',    data: profitData, ...ds(tp, '#06b6d4'),                           ...(tp === 'line' ? { spanGaps: false } : {}) },
        { label: 'Profit/hr', data: rateData,   ...ds(tp, '#a855f7', { borderDash: [5, 4] }),   ...(tp === 'line' ? { spanGaps: false } : {}) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase(),
          callbacks: {
            label: ctx => {
              if (ctx.parsed.y === null) return null;
              return ' ' + ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          ...scaleBase(),
          ticks: { ...scaleBase().ticks, maxTicksLimit: 8 }
        },
        y: {
          ...scaleBase(),
          beginAtZero: true,
          ticks: { ...scaleBase().ticks, callback: v => '$' + v }
        }
      }
    }
  });
}

/* ── Hours chart ── */
function renderHoursChart(entries) {
  const s = sorted(entries);
  const labels    = s.map(e => fmtDate(e.date));
  const hoursData = s.map(e => e.hours);

  const ctx = document.getElementById('hours-chart').getContext('2d');

  if (hoursChart) {
    hoursChart.data.labels = labels;
    hoursChart.data.datasets[0].data = hoursData;
    hoursChart.update();
    return;
  }

  const th = chartTypes.hours;
  hoursChart = new Chart(ctx, {
    type: th,
    data: {
      labels,
      datasets: [{ label: 'Hours worked', data: hoursData, ...ds(th, '#3b82f6') }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase(),
          callbacks: { label: ctx => ' Hours: ' + ctx.parsed.y + 'h' }
        }
      },
      scales: {
        x: {
          ...scaleBase(),
          ticks: { ...scaleBase().ticks, maxTicksLimit: 8 }
        },
        y: {
          ...scaleBase(),
          beginAtZero: true,
          ticks: { ...scaleBase().ticks, stepSize: 0.5, callback: v => v + 'h' }
        }
      }
    }
  });
}

/* ── Cumulative revenue chart ── */
function renderCumulativeChart(entries) {
  const s = sorted(entries);
  const labels = s.map(e => fmtDate(e.date));
  let running = 0;
  const cumData = s.map(e => { running += e.revenue; return +running.toFixed(2); });

  const ctx = document.getElementById('cumulative-chart').getContext('2d');

  if (cumulativeChart) {
    cumulativeChart.data.labels = labels;
    cumulativeChart.data.datasets[0].data = cumData;
    cumulativeChart.update();
    return;
  }

  const tc = chartTypes.cumulative;
  const fillEx = tc === 'line' ? { fill: true, backgroundColor: 'rgba(45,184,122,0.07)' } : {};
  cumulativeChart = new Chart(ctx, {
    type: tc,
    data: {
      labels,
      datasets: [{ label: 'Cumulative revenue', data: cumData, ...ds(tc, '#2db87a'), ...fillEx }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase(),
          callbacks: { label: ctx => ' Total: ' + fmtMoney(ctx.parsed.y) }
        }
      },
      scales: {
        x: { ...scaleBase(), ticks: { ...scaleBase().ticks, maxTicksLimit: 8 } },
        y: { ...scaleBase(), beginAtZero: true, ticks: { ...scaleBase().ticks, callback: v => '$' + v } }
      }
    }
  });
}

/* ── 30-day pace chart ── */
function renderPaceChart(entries) {
  const s = sorted(entries);

  // Build day-indexed cumulative actuals
  const firstDate = s.length ? new Date(s[0].date + 'T00:00:00') : null;
  const dayNum = d => Math.round((new Date(d + 'T00:00:00') - firstDate) / 86400000) + 1;

  const avgPerDay = s.length
    ? s.reduce((sum, e) => sum + e.revenue, 0) / s.length
    : 0;

  const lastLoggedDay = s.length ? dayNum(s[s.length - 1].date) : 0;
  const totalDays = Math.max(30, lastLoggedDay);

  // Map day → cumulative actual
  let running = 0;
  const actualByDay = {};
  for (const e of s) {
    running += e.revenue;
    actualByDay[dayNum(e.date)] = +running.toFixed(2);
  }

  const labels      = Array.from({ length: totalDays }, (_, i) => 'Day ' + (i + 1));
  const actualData  = Array.from({ length: totalDays }, (_, i) => actualByDay[i + 1] ?? null);
  const paceData    = Array.from({ length: totalDays }, (_, i) => +((i + 1) * avgPerDay).toFixed(2));

  const ctx = document.getElementById('pace-chart').getContext('2d');

  if (paceChart) {
    paceChart.data.labels = labels;
    paceChart.data.datasets[0].data = actualData;
    paceChart.data.datasets[1].data = paceData;
    paceChart.update();
    return;
  }

  const tpa = chartTypes.pace;
  paceChart = new Chart(ctx, {
    type: tpa,
    data: {
      labels,
      datasets: [
        { label: 'Actual',      data: actualData, ...ds(tpa, '#2db87a'),                                                                    ...(tpa === 'line' ? { spanGaps: false } : {}) },
        { label: '30-day pace', data: paceData,   ...ds(tpa, '#c8820a', { borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0 }) }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase(),
          callbacks: {
            label: ctx => {
              if (ctx.parsed.y === null) return null;
              return ' ' + ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: { ...scaleBase(), ticks: { ...scaleBase().ticks, maxTicksLimit: 10 } },
        y: { ...scaleBase(), beginAtZero: true, ticks: { ...scaleBase().ticks, callback: v => '$' + v } }
      }
    }
  });
}

/* ── Entries table ── */
function renderTable(entries) {
  const tbody = document.getElementById('entries-body');
  tbody.innerHTML = '';

  const s = sorted(entries).reverse();

  if (s.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = '<td colspan="9">No entries yet. Log your first day below.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const e of s) {
    const profit = calcProfit(e);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(e.date)}</td>
      <td class="rev-cell">${fmtMoney(e.revenue)}</td>
      <td class="profit-cell">${hasProductData(e) ? fmtMoney(profit) : '—'}</td>
      <td class="hrs-cell">${e.hours.toFixed(1)}h</td>
      <td class="pops-cell">${e.popsicles ?? '—'}</td>
      <td class="water-cell">${e.water     ?? '—'}</td>
      <td class="soda-cell">${e.soda      ?? '—'}</td>
      <td class="ice-cell">${e.iceBags   ?? '—'}</td>
      <td class="del-cell"><button class="del-btn" data-date="${e.date}" title="Remove">×</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const updated = loadEntries().filter(e => e.date !== btn.dataset.date);
      saveEntries(updated);
      render();
    });
  });
}

/* ── Volume pie chart ── */
const PIE_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#06b6d4'];

function renderVolumePie(entries) {
  const pops  = entries.reduce((s, e) => s + (e.popsicles || 0), 0);
  const water = entries.reduce((s, e) => s + (e.water     || 0), 0);
  const soda  = entries.reduce((s, e) => s + (e.soda      || 0), 0);
  const data  = [pops, water, soda];

  const ctx = document.getElementById('volume-pie').getContext('2d');

  if (volumePie) {
    volumePie.data.datasets[0].data = data;
    volumePie.update();
    return;
  }

  volumePie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Popsicles', 'Water', 'Soda'],
      datasets: [{ data, backgroundColor: PIE_COLORS.slice(0, 3), borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase(),
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} units (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* ── Revenue / Profit breakdown pie ── */
function calcBreakdownData(entries, mode) {
  const withData = entries.filter(hasProductData);
  if (!withData.length) return [0, 0, 0];

  const totalRevenue = withData.reduce((s, e) => s + e.revenue, 0);
  const totalUnits   = withData.reduce((s, e) =>
    s + (e.popsicles || 0) + (e.water || 0) + (e.soda || 0), 0);

  if (totalUnits === 0) return [0, 0, 0];

  const popUnits  = withData.reduce((s, e) => s + (e.popsicles || 0), 0);
  const watUnits  = withData.reduce((s, e) => s + (e.water     || 0), 0);
  const sodUnits  = withData.reduce((s, e) => s + (e.soda      || 0), 0);

  if (mode === 'revenue') {
    return [
      +(totalRevenue * popUnits / totalUnits).toFixed(2),
      +(totalRevenue * watUnits / totalUnits).toFixed(2),
      +(totalRevenue * sodUnits / totalUnits).toFixed(2)
    ];
  } else {
    const popCost = withData.reduce((s, e) => s + (e.popsicles || 0) * COSTS.popsicle, 0);
    const watCost = withData.reduce((s, e) => s + (e.water     || 0) * COSTS.water,    0);
    const sodCost = withData.reduce((s, e) => s + (e.soda      || 0) * COSTS.soda,     0);
    return [
      +(totalRevenue * popUnits / totalUnits - popCost).toFixed(2),
      +(totalRevenue * watUnits / totalUnits - watCost).toFixed(2),
      +(totalRevenue * sodUnits / totalUnits - sodCost).toFixed(2)
    ];
  }
}

function renderBreakdownPie(entries) {
  const data   = calcBreakdownData(entries, breakdownMode);
  const clipped = data.map(v => Math.max(0, v));

  const ctx = document.getElementById('breakdown-pie').getContext('2d');

  if (breakdownPie) {
    breakdownPie.data.datasets[0].data = clipped;
    breakdownPie.update();
    return;
  }

  breakdownPie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Popsicles', 'Water', 'Soda'],
      datasets: [{ data: clipped, backgroundColor: PIE_COLORS.slice(0, 3), borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBase(),
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${fmtMoney(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* ── Full render ── */
function render() {
  const entries = loadEntries();
  updateStats(entries);
  renderRevenueChart(entries);
  renderProfitChart(entries);
  renderHoursChart(entries);
  renderCumulativeChart(entries);
  renderPaceChart(entries);
  renderVolumePie(entries);
  renderBreakdownPie(entries);
  renderTable(entries);
}

/* ── Default date ── */
function setDefaultDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('date-input').value =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/* ── Add entry ── */
document.getElementById('add-btn').addEventListener('click', () => {
  const date    = document.getElementById('date-input').value;
  const revenue = parseFloat(document.getElementById('revenue-input').value);
  const hours   = parseFloat(document.getElementById('hours-input').value);

  if (!date || isNaN(revenue) || revenue < 0 || isNaN(hours) || hours <= 0) return;

  const popsicles = parseProd('popsicles-input');
  const water     = parseProd('water-input');
  const soda      = parseProd('soda-input');
  const iceBags   = parseProd('icebags-input');

  const entries = loadEntries().filter(e => e.date !== date);
  entries.push({ date, revenue, hours, popsicles, water, soda, iceBags });
  saveEntries(entries);

  ['revenue-input','hours-input','popsicles-input','water-input','soda-input','icebags-input']
    .forEach(id => { document.getElementById(id).value = ''; });
  render();
});

['revenue-input','hours-input','popsicles-input','water-input','soda-input','icebags-input']
  .forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('add-btn').click();
    });
  });

/* ── Pie toggle ── */
document.getElementById('pie-rev-btn').addEventListener('click', () => {
  breakdownMode = 'revenue';
  document.getElementById('pie-rev-btn').classList.add('active');
  document.getElementById('pie-profit-btn').classList.remove('active');
  document.getElementById('breakdown-label').textContent = 'Revenue by product';
  const entries = loadEntries();
  const data = calcBreakdownData(entries, 'revenue').map(v => Math.max(0, v));
  breakdownPie.data.datasets[0].data = data;
  breakdownPie.update();
});

document.getElementById('pie-profit-btn').addEventListener('click', () => {
  breakdownMode = 'profit';
  document.getElementById('pie-profit-btn').classList.add('active');
  document.getElementById('pie-rev-btn').classList.remove('active');
  document.getElementById('breakdown-label').textContent = 'Profit by product';
  const entries = loadEntries();
  const data = calcBreakdownData(entries, 'profit').map(v => Math.max(0, v));
  breakdownPie.data.datasets[0].data = data;
  breakdownPie.update();
});

/* ── Tabs ── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('panel-' + target).classList.remove('hidden');
  });
});

/* ── Dark mode ── */
function chartColors() {
  const dark = document.body.classList.contains('dark');
  return {
    grid:    dark ? '#222222' : '#f2f2f2',
    border:  dark ? '#2a2a2a' : '#e8e8e8',
    tick:    dark ? '#555555' : '#bbbbbb',
    tooltipBg:    dark ? '#1e1e1e' : '#ffffff',
    tooltipBorder: dark ? '#333333' : '#e8e8e8',
    tooltipTitle: dark ? '#888888' : '#999999',
    tooltipBody:  dark ? '#e0e0e0' : '#111111',
  };
}

function applyChartTheme() {
  const c = chartColors();

  [revenueChart, profitChart, hoursChart, cumulativeChart, paceChart, volumePie, breakdownPie].forEach(chart => {
    if (!chart) return;

    chart.options.plugins.tooltip.backgroundColor  = c.tooltipBg;
    chart.options.plugins.tooltip.borderColor      = c.tooltipBorder;
    chart.options.plugins.tooltip.titleColor       = c.tooltipTitle;
    chart.options.plugins.tooltip.bodyColor        = c.tooltipBody;

    Object.values(chart.options.scales).forEach(scale => {
      if (scale.grid)   scale.grid.color   = c.grid;
      if (scale.border) scale.border.color = c.border;
      if (scale.ticks)  scale.ticks.color  = c.tick;
    });

    chart.update();
  });
}

/* ── Chart type toggles ── */
document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key  = btn.dataset.chart;
    const next = chartTypes[key] === 'line' ? 'bar' : 'line';
    destroyAndNull(key);
    chartTypes[key] = next;
    btn.textContent = next === 'bar' ? 'Line' : 'Bar';
    btn.classList.toggle('bar-active', next === 'bar');

    const vals   = Object.values(chartTypes);
    const allBar  = vals.every(t => t === 'bar');
    const allLine = vals.every(t => t === 'line');
    document.getElementById('global-line-btn').classList.toggle('active', allLine);
    document.getElementById('global-bar-btn').classList.toggle('active', allBar);

    render();
  });
});

document.getElementById('global-line-btn').addEventListener('click', () => {
  Object.keys(chartTypes).forEach(k => { destroyAndNull(k); chartTypes[k] = 'line'; });
  document.querySelectorAll('.chart-toggle-btn').forEach(b => { b.textContent = 'Bar'; b.classList.remove('bar-active'); });
  document.getElementById('global-line-btn').classList.add('active');
  document.getElementById('global-bar-btn').classList.remove('active');
  render();
});

document.getElementById('global-bar-btn').addEventListener('click', () => {
  Object.keys(chartTypes).forEach(k => { destroyAndNull(k); chartTypes[k] = 'bar'; });
  document.querySelectorAll('.chart-toggle-btn').forEach(b => { b.textContent = 'Line'; b.classList.add('bar-active'); });
  document.getElementById('global-bar-btn').classList.add('active');
  document.getElementById('global-line-btn').classList.remove('active');
  render();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyChartTheme();
});

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}

/* ── Transfer ── */
function showPanel(id) {
  ['export-panel', 'import-panel'].forEach(p => {
    document.getElementById(p).classList.add('hidden');
  });
  document.querySelectorAll('.transfer-btn').forEach(b => b.classList.remove('active'));

  if (id) {
    document.getElementById(id).classList.remove('hidden');
    const btn = id === 'export-panel' ? 'export-btn' : 'import-btn';
    document.getElementById(btn).classList.add('active');
  }
}

document.getElementById('export-btn').addEventListener('click', () => {
  const entries = loadEntries();
  const code = btoa(JSON.stringify(entries));
  document.getElementById('export-box').value = code;

  const already = document.getElementById('export-panel').classList.contains('hidden');
  showPanel(already ? 'export-panel' : null);
});

document.getElementById('copy-btn').addEventListener('click', () => {
  const box = document.getElementById('export-box');
  navigator.clipboard.writeText(box.value).then(() => {
    const btn = document.getElementById('copy-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('success');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('success'); }, 1800);
  });
});

document.getElementById('import-btn').addEventListener('click', () => {
  const already = document.getElementById('import-panel').classList.contains('hidden');
  showPanel(already ? 'import-panel' : null);
});

document.getElementById('apply-btn').addEventListener('click', () => {
  const raw = document.getElementById('import-box').value.trim();
  if (!raw) return;

  try {
    const entries = JSON.parse(atob(raw));
    if (!Array.isArray(entries)) throw new Error();
    saveEntries(entries);
    document.getElementById('import-box').value = '';
    showPanel(null);
    render();

    const btn = document.getElementById('apply-btn');
    btn.textContent = 'Done!';
    btn.classList.add('success');
    setTimeout(() => { btn.textContent = 'Apply'; btn.classList.remove('success'); }, 1800);
  } catch {
    const btn = document.getElementById('apply-btn');
    btn.textContent = 'Invalid code';
    setTimeout(() => { btn.textContent = 'Apply'; }, 1800);
  }
});

setDefaultDate();
render();
