import { useState } from 'react';
import { Icon } from './components';
import coraLogo from './assets/CoraLogo.png';

export function CoraMark({ size = 26 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <img
        src={coraLogo}
        alt="Cora"
        style={{ width: size * 1.15, height: size * 1.15, objectFit: 'contain' }}
      />
      <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: size, color: 'var(--ink)', letterSpacing: '-.02em' }}>
        Cora
      </span>
    </span>
  );
}

export const NAV = [
  { id: 'dashboard',   label: 'Inicio',          icon: 'house' },
  { id: 'aportar',     label: 'Aportar',         icon: 'hand-coins' },
  { id: 'cobertura',   label: 'Mi cobertura',    icon: 'shield-check' },
  { id: 'solicitar',   label: 'Solicitar ayuda', icon: 'first-aid-kit' },
  { id: 'solicitudes', label: 'Mis solicitudes', icon: 'files' },
  { id: 'fondo',       label: 'El fondo',        icon: 'chart-donut' },
];

function NavItem({ item, active, onClick, compact }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: compact ? '8px 10px' : '10px 13px', border: 'none', cursor: 'pointer',
        borderRadius: 'var(--r)', textAlign: 'left',
        background: active ? 'var(--forest-soft)' : h ? 'rgba(30,74,60,.05)' : 'transparent',
        color: active ? 'var(--forest-dark)' : 'var(--ink-2)',
        fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: active ? 600 : 500,
        transition: 'background .15s, color .15s',
      }}>
      <Icon name={item.icon} size={20} weight={active ? 'fill' : 'regular'}
        color={active ? 'var(--forest)' : 'var(--ink-2)'} />
      <span>{item.label}</span>
    </button>
  );
}

export function Sidebar({ route, go, member, validador, setValidador, onLogout }) {
  return (
    <aside style={{
      width: 252, flexShrink: 0, borderRight: '1px solid var(--hairline)',
      background: 'var(--surface)', padding: '26px 18px 18px',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '0 8px 22px' }}><CoraMark /></div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map((it) => (
          <NavItem key={it.id} item={it} active={route === it.id} onClick={() => go(it.id)} />
        ))}
        {validador && (
          <NavItem item={{ id: 'validador', label: 'Validador', icon: 'gavel' }}
            active={route === 'validador'} onClick={() => go('validador')} />
        )}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={() => setValidador(!validador)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '9px 12px', border: '1px solid var(--hairline)', borderRadius: 'var(--r)',
          background: 'transparent', cursor: 'pointer', fontFamily: 'var(--sans)',
          fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="gavel" size={16} /> Rol validador
          </span>
          <span style={{
            width: 34, height: 20, borderRadius: 99, background: validador ? 'var(--forest)' : 'var(--hairline)',
            position: 'relative', transition: 'background .18s', flexShrink: 0,
          }}>
            <span style={{ position: 'absolute', top: 2, left: validador ? 16 : 2, width: 16, height: 16,
              borderRadius: 99, background: 'var(--surface)', transition: 'left .18s' }} />
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 6px' }}>
          <span style={{
            width: 36, height: 36, borderRadius: 99, background: 'var(--clay-soft)', color: 'var(--clay)',
            display: 'grid', placeItems: 'center', fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 16, flexShrink: 0,
          }}>{(member?.nombre || 'C')[0]}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {member?.nombre || '—'}
            </div>
            {member?.address && (
              <div style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--mono)', letterSpacing: '.01em' }}>
                {member.address.slice(0, 4)}…{member.address.slice(-4)}
              </div>
            )}
            {!member?.address && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Miembro · Cora</div>
            )}
          </div>
          <button onClick={onLogout} title="Salir" style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ink-2)', padding: 4, display: 'grid', placeItems: 'center' }}>
            <Icon name="sign-out" size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function BottomBar({ route, go }) {
  const items = NAV.slice(0, 5);
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
      background: 'var(--surface)', borderTop: '1px solid var(--hairline)',
      padding: '6px 4px calc(6px + env(safe-area-inset-bottom))',
    }}>
      {items.map((it) => {
        const active = route === it.id;
        return (
          <button key={it.id} onClick={() => go(it.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px',
            color: active ? 'var(--forest)' : 'var(--ink-2)',
          }}>
            <Icon name={it.icon} size={22} weight={active ? 'fill' : 'regular'} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function MobileHeader({ member, onLogout }) {
  const addr = member?.address;
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderBottom: '1px solid var(--hairline)', background: 'var(--surface)',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <CoraMark size={22} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {addr && (
          <span style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--mono)',
            background: 'var(--canvas)', border: '1px solid var(--hairline)',
            borderRadius: 99, padding: '3px 9px', letterSpacing: '.01em' }}>
            {addr.slice(0, 4)}…{addr.slice(-4)}
          </span>
        )}
        <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)' }}>
          <Icon name="sign-out" size={20} />
        </button>
      </div>
    </header>
  );
}
