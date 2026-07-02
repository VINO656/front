export const fmtWt  = (kg) => Number(kg||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' kg';
export const fmtMon = (n)  => '\u20B9' + Number(n||0).toLocaleString('en-IN');
export const fmtDate= (iso)=> {
  if (!iso) return '\u2014';
  if (iso.includes('T')) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const time = iso.split('T')[1].slice(0, 5);
    return `${d.getDate()} ${mn[d.getMonth()]} ${d.getFullYear()}, ${time}`;
  }
  if (iso.includes('-') && iso.length === 10) {
    const [y,m,d]=iso.split('-');
    const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${+d} ${mn[+m-1]} ${y}`;
  }
  return iso;
};
export const todayISO = () => new Date().toISOString().split('T')[0];
export const nowISO = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
