/* ============================================================
   Cora — componentes base (primitivas de UI)
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;

/* ---------- helpers de formato ---------- */
const money = (n, dec = 0) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const mes = ['ene','feb','mar','abr','may','jun','jul','ago','set','oct','nov','dic'][m - 1];
  return `${d} ${mes} ${y}`;
};
const prefersReduced = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- count-up ---------- */
function useCountUp(target, { duration = 1000, decimals = 0, start = true } = {}) {
  const [val, setVal] = useState(start && !prefersReduced() ? 0 : target);
  const raf = useRef(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReduced()) { setVal(target); return; }
    const t0 = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(from + (target - from) * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, start]);
  const f = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString('en-US');
  return f;
}

function Money({ value, decimals = 0, count = false, className = '', size }) {
  const counted = useCountUp(value, { decimals, start: count });
  const shown = count ? (decimals > 0 ? counted : Number(counted.replace(/,/g, '')).toLocaleString('en-US')) : Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span className={`tnum ${className}`} style={size ? { fontSize: size } : undefined}>
      <span style={{ opacity: .55 }}>$</span>{shown}
    </span>
  );
}

/* ---------- iconos (Phosphor web font) ---------- */
function Icon({ name, size = 20, weight = 'regular', color, style }) {
  const w = weight === 'regular' ? 'ph' : `ph-${weight}`;
  return <i className={`${w} ph-${name}`} style={{ fontSize: size, color, lineHeight: 1, ...style }} aria-hidden="true" />;
}

/* ---------- botón ---------- */
function Button({ children, variant = 'primary', size = 'md', icon, iconRight, full, loading, disabled, onClick, type = 'button' }) {
  const pads = { sm: '8px 14px', md: '12px 20px', lg: '15px 26px' };
  const fs = { sm: 14, md: 15, lg: 16 };
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    width: full ? '100%' : undefined, padding: pads[size], fontSize: fs[size],
    fontFamily: 'var(--sans)', fontWeight: 600, borderRadius: 'var(--r)',
    border: '1px solid transparent', cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'background .16s ease-out, color .16s ease-out, border-color .16s ease-out, transform .12s ease-out',
    letterSpacing: '.005em', whiteSpace: 'nowrap',
  };
  const variants = {
    primary:   { background: 'var(--forest)', color: '#F3EFE6' },
    clay:      { background: 'var(--clay)', color: '#FBF8F1' },
    secondary: { background: 'transparent', color: 'var(--ink)', borderColor: 'var(--hairline)' },
    ghost:     { background: 'transparent', color: 'var(--forest)' },
    danger:    { background: 'transparent', color: 'var(--error)', borderColor: 'rgba(169,59,44,.4)' },
  };
  const [hover, setHover] = useState(false);
  const hoverStyle = !disabled && !loading && hover ? {
    primary:   { background: 'var(--forest-dark)' },
    clay:      { background: '#a8492f' },
    secondary: { background: 'var(--surface)', borderColor: '#cfc6b2' },
    ghost:     { background: 'var(--forest-soft)' },
    danger:    { background: 'rgba(169,59,44,.06)' },
  }[variant] : {};
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...hoverStyle, opacity: disabled ? .5 : 1 }}>
      {loading ? <span className="cora-spin" /> : icon ? <Icon name={icon} size={fs[size] + 3} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={fs[size] + 2} /> : null}
    </button>
  );
}

/* ---------- card ---------- */
function Card({ children, className = '', style, pad = 'var(--s3)', as = 'div', onClick, hover }) {
  const El = as;
  const [h, setH] = useState(false);
  return (
    <El onClick={onClick}
      onMouseEnter={hover ? () => setH(true) : undefined}
      onMouseLeave={hover ? () => setH(false) : undefined}
      className={`cora-card ${className}`}
      style={{ padding: pad, transition: 'border-color .16s, transform .16s',
        borderColor: h ? '#cfc6b2' : undefined, cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </El>
  );
}

/* ---------- badge de estado ---------- */
const STATUS_META = {
  enviado:       { label: 'Enviado',        bg: 'var(--forest-soft)', fg: 'var(--forest)', dot: 'var(--forest)' },
  en_validacion: { label: 'En validación',  bg: '#F6E9CF', fg: '#8a5e16', dot: 'var(--amber)' },
  aprobado:      { label: 'Aprobado',       bg: 'var(--forest-soft)', fg: 'var(--forest)', dot: 'var(--forest)' },
  pagado:        { label: 'Pagado al hospital', bg: 'var(--forest-soft)', fg: 'var(--forest-dark)', dot: 'var(--forest)' },
  rechazado:     { label: 'Rechazado',      bg: '#F3DAD5', fg: 'var(--error)', dot: 'var(--error)' },
  confirmado:    { label: 'Confirmado',     bg: 'var(--forest-soft)', fg: 'var(--forest)', dot: 'var(--forest)' },
  pendiente:     { label: 'Pendiente',      bg: '#F6E9CF', fg: '#8a5e16', dot: 'var(--amber)' },
  activo:        { label: 'Activo',         bg: 'var(--forest-soft)', fg: 'var(--forest)', dot: 'var(--forest)' },
};
function Badge({ status, label, tone }) {
  const m = STATUS_META[status] || { label: label || status, bg: 'var(--clay-soft)', fg: 'var(--clay)', dot: 'var(--clay)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 9px',
      background: m.bg, color: m.fg, borderRadius: 99, fontSize: 12.5, fontWeight: 600, letterSpacing: '.01em' }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: m.dot, display: 'inline-block' }} />
      {label || m.label}
    </span>
  );
}

/* ---------- progreso lineal (carencia) ---------- */
function ProgressBar({ value, max, color = 'var(--forest)', height = 8, animate = true }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const [w, setW] = useState(animate && !prefersReduced() ? 0 : pct);
  useEffect(() => { const t = setTimeout(() => setW(pct), 120); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ background: 'var(--hairline)', borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 99,
        transition: 'width .9s cubic-bezier(.22,.61,.36,1)' }} />
    </div>
  );
}

/* ---------- estados: loading / empty / error ---------- */
function StateWrap({ status, error, onRetry, skeleton, empty, isEmpty, children }) {
  if (status === 'loading') return skeleton || <DefaultSkeleton />;
  if (status === 'error') return (
    <Card style={{ textAlign: 'center', padding: 'var(--s5)' }}>
      <Icon name="warning-circle" size={30} color="var(--clay)" />
      <p style={{ margin: '12px 0 16px', color: 'var(--ink-2)' }}>{error || 'No pudimos cargar esto.'}</p>
      {onRetry && <Button variant="secondary" size="sm" icon="arrow-clockwise" onClick={onRetry}>Reintentar</Button>}
    </Card>
  );
  if (isEmpty) return empty || (
    <Card style={{ textAlign: 'center', padding: 'var(--s5)', color: 'var(--ink-2)' }}>Nada por aquí todavía.</Card>
  );
  return children;
}
function DefaultSkeleton() {
  return <div style={{ display: 'grid', gap: 12 }}>
    {[0,1,2].map(i => <span key={i} className="skel" style={{ height: 60 }} />)}
  </div>;
}

/* ---------- field genérico ---------- */
function Field({ label, hint, error, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 7 }}>{label}</span>
      {children}
      {error ? <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, color: 'var(--error)' }}>{error}</span>
        : hint ? <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>{hint}</span> : null}
    </label>
  );
}
const inputStyle = (err) => ({
  width: '100%', padding: '12px 14px', fontFamily: 'var(--sans)', fontSize: 15, color: 'var(--ink)',
  background: 'var(--canvas)', border: `1px solid ${err ? 'var(--error)' : 'var(--hairline)'}`,
  borderRadius: 'var(--r)', outline: 'none', transition: 'border-color .15s',
});

function SectionTitle({ eyebrow, children, sub }) {
  return (
    <div style={{ marginBottom: 'var(--s3)' }}>
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
      <h2 style={{ fontSize: 'clamp(26px, 3.2vw, 34px)' }}>{children}</h2>
      {sub && <p style={{ margin: '8px 0 0', color: 'var(--ink-2)', maxWidth: 560 }}>{sub}</p>}
    </div>
  );
}

Object.assign(window, {
  money, fmtDate, prefersReduced, useCountUp, Money, Icon, Button, Card, Badge,
  ProgressBar, StateWrap, DefaultSkeleton, Field, inputStyle, SectionTitle, STATUS_META,
});
