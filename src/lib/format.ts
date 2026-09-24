// MT5-style formatting helpers

export function fmtPrice(v: number, digits: number): string {
  return v.toFixed(digits);
}

/** MT5 formats big numbers with thin spaces: 10 000.00 */
export function fmtMoney(v: number, digits = 2): string {
  const neg = v < 0;
  const abs = Math.abs(v).toFixed(digits);
  const [int, dec] = abs.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '-' : ''}${grouped}${dec ? '.' + dec : ''}`;
}

export function fmtVolume(v: number): string {
  return v.toFixed(2);
}

export function fmtSigned(v: number, digits = 2): string {
  return `${v > 0 ? '+' : ''}${fmtMoney(v, digits)}`;
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDayLabel(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtDayLabelYear(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtClock(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
