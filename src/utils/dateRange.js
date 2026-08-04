import ApiError from './ApiError.js';

const PRESETS = new Set(['7d', '30d', 'month', 'year', 'custom']);

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Parse dashboard date range from query.
 * @returns {{ key: string, start: Date, end: Date, from: string, to: string }}
 */
export function parseDateRange(query = {}) {
  const key = String(query.range || '30d').toLowerCase();
  if (!PRESETS.has(key)) {
    throw ApiError.badRequest('Invalid range. Use 7d, 30d, month, year, or custom');
  }

  const now = new Date();
  let start;
  let end = endOfDay(now);

  if (key === '7d') {
    start = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  } else if (key === '30d') {
    start = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  } else if (key === 'month') {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  } else if (key === 'year') {
    start = startOfDay(new Date(now.getFullYear(), 0, 1));
  } else {
    if (!query.from || !query.to) {
      throw ApiError.badRequest('Custom range requires from and to (ISO date)');
    }
    const fromDate = new Date(query.from);
    const toDate = new Date(query.to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw ApiError.badRequest('Invalid from/to date');
    }
    start = startOfDay(fromDate);
    end = endOfDay(toDate);
    if (start > end) {
      throw ApiError.badRequest('from must be before or equal to to');
    }
  }

  return {
    key,
    start,
    end,
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

/**
 * Build revenue series buckets for charting.
 */
export function buildRevenueSeries(orders, range) {
  const { key, start, end } = range;
  const map = new Map();

  const add = (label, amount) => {
    map.set(label, (map.get(label) || 0) + amount);
  };

  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const d = new Date(o.createdAt || o.date);
    if (Number.isNaN(d.getTime())) continue;
    let label;
    if (key === 'year') {
      label = d.toLocaleString('en-US', { month: 'short' });
    } else if (key === 'month') {
      const week = Math.ceil(d.getDate() / 7);
      label = `W${week}`;
    } else {
      label = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    }
    add(label, o.amount || 0);
  }

  // Ensure chronological labels for day ranges
  if (key === '7d' || key === '30d' || key === 'custom') {
    const labels = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    while (cursor <= last) {
      const label = cursor.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      labels.push(label);
      if (!map.has(label)) map.set(label, 0);
      cursor.setDate(cursor.getDate() + 1);
    }
    return labels.map((label) => ({ label, value: map.get(label) || 0 }));
  }

  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

export default { parseDateRange, buildRevenueSeries };
