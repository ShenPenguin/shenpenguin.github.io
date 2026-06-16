const STORAGE_KEY = 'hustle_entries_v2';

let revenueChart = null;
let hoursChart = null;

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

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: revenueData,
          borderColor: '#2db87a',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 3,
          pointBackgroundColor: '#2db87a',
          pointHoverRadius: 5,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: '$/hr rate',
          data: rateData,
          borderColor: '#c8820a',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 3,
          pointBackgroundColor: '#c8820a',
          pointHoverRadius: 5,
          tension: 0.35,
          yAxisID: 'y'
        }
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

  hoursChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Hours worked',
        data: hoursData,
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: '#3b82f6',
        pointHoverRadius: 5,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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

/* ── Entries table ── */
function renderTable(entries) {
  const tbody = document.getElementById('entries-body');
  tbody.innerHTML = '';

  const s = sorted(entries).reverse();

  if (s.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = '<td colspan="5">No entries yet. Log your first day below.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const e of s) {
    const rate = e.hours > 0 ? fmtMoney(e.revenue / e.hours) : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(e.date)}</td>
      <td class="rev-cell">${fmtMoney(e.revenue)}</td>
      <td class="hrs-cell">${e.hours.toFixed(1)}h</td>
      <td class="rate-cell">${rate}</td>
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

/* ── Full render ── */
function render() {
  const entries = loadEntries();
  updateStats(entries);
  renderRevenueChart(entries);
  renderHoursChart(entries);
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
  const dateEl = document.getElementById('date-input');
  const revEl  = document.getElementById('revenue-input');
  const hrsEl  = document.getElementById('hours-input');

  const date    = dateEl.value;
  const revenue = parseFloat(revEl.value);
  const hours   = parseFloat(hrsEl.value);

  if (!date || isNaN(revenue) || revenue < 0 || isNaN(hours) || hours <= 0) return;

  const entries = loadEntries().filter(e => e.date !== date);
  entries.push({ date, revenue, hours });
  saveEntries(entries);

  revEl.value = '';
  hrsEl.value = '';
  render();
});

[document.getElementById('revenue-input'), document.getElementById('hours-input')]
  .forEach(el => el.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('add-btn').click();
  }));

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

  [revenueChart, hoursChart].forEach(chart => {
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

document.getElementById('theme-toggle').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyChartTheme();
});

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}

setDefaultDate();
render();
