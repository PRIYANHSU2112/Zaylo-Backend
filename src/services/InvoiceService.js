import Settings from '../models/Settings.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

/** Print-ready HTML invoice (browser "Save as PDF"). Caller enforces eligibility. */
class InvoiceService {
  async render(order) {
    const s = (await Settings.findOne({ key: 'default' }).lean()) || {};
    const brand = s.brand || {};
    const corp = s.corporate || {};
    const date = new Date(order.createdAt || order.date).toLocaleDateString('en-IN');
    const rows = order.items
      .map(
        (i, idx) => `<tr><td>${idx + 1}</td><td>${esc(i.name)}${i.weight ? ` <small>(${esc(i.weight)})</small>` : ''}${
          i.kind === 'bundle' && i.components?.length
            ? `<br><small class="muted">Pack: ${i.components.map((c) => `${esc(c.name)}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`).join(' + ')}</small>`
            : ''
        }</td>
<td class="r">${i.quantity}</td><td class="r">${money(i.price)}</td><td class="r">${money(i.lineTotal || i.price * i.quantity)}</td></tr>`,
      )
      .join('');
    const line = (label, v, neg = false) =>
      v ? `<tr><td colspan="4" class="r">${label}</td><td class="r">${neg ? '−' : ''}${money(v)}</td></tr>` : '';

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(order.orderCode)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:14px/1.5 system-ui,sans-serif;color:#1a1e2c;max-width:800px;margin:24px auto;padding:0 16px}
h1{color:#d71920;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
th{background:#fdecec}.r{text-align:right}.grid{display:flex;justify-content:space-between;gap:24px;margin-top:16px}
.total td{font-weight:700;font-size:16px;border-top:2px solid #1a1e2c}.muted{color:#64748b}
@media print{.noprint{display:none}body{margin:0}}</style></head><body>
<div class="grid"><div><h1>${esc(brand.legalName || "ZAY'LO Snacks")}</h1><div class="muted">${esc(corp.address)}<br>${esc(corp.phone)} ${esc(corp.email)}</div></div>
<div class="r"><h2 style="margin:0">INVOICE</h2><div>${esc(order.orderCode)}</div><div class="muted">${date}</div></div></div>
<div class="grid"><div><strong>Bill / Ship to</strong><br>${esc(order.customerName)}<br>${esc(order.shippingAddress)}<br>${esc(order.customerPhone)}<br>${esc(order.customerEmail)}</div>
<div class="r"><strong>Payment</strong><br>${esc(order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod)}<br>Status: ${esc(order.paymentStatus)}<br>Order status: ${esc(order.status)}</div></div>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody>
<tfoot>${line('Subtotal', order.subtotal || order.amount)}${line(`Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}`, order.discount, true)}
${line('Shipping', order.shippingFee)}${line('COD fee', order.codFee)}${line('Tax', order.tax)}
<tr class="total"><td colspan="4" class="r">Total</td><td class="r">${money(order.amount)}</td></tr></tfoot></table>
<p class="muted">This is a computer-generated invoice.</p>
</body></html>`;
  }
}

export default new InvoiceService();
