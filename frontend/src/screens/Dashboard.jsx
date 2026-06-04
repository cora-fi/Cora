import { Rise, Card, Badge, Icon, Button, Money, ProgressBar, StateWrap, money } from '../components';
import { useAsync } from '../hooks';
import { CoraConfig } from '../config';
import { getPoolStatus, getYieldStatus } from '../services/mock-service';

function StatRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16,
      padding: '13px 0', borderBottom: '1px solid var(--hairline)' }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>{label}</span>
      <span className="tnum font-serif" style={{ fontSize: 19, fontWeight: 500, color: accent || 'var(--ink)' }}>{value}</span>
    </div>
  );
}

export default function Dashboard({ member, go }) {
  const pool = useAsync(() => getPoolStatus(), []);
  const yld  = useAsync(() => getYieldStatus(), []);
  const cfg  = CoraConfig.product;
  const restantes = Math.max(0, cfg.mesesCarencia - member.active_months);

  return (
    <div style={{ maxWidth: 1080 }}>
      <Rise delay={0.02} style={{ marginBottom: 'var(--s4)' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Lunes · 3 de junio</div>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 42px)' }}>
          Hola, {member.nombre.split(' ')[0]}.
        </h1>
        <p style={{ color: 'var(--ink-2)', marginTop: 8, fontSize: 17 }}>
          Tu cuenta está al día. Esto es lo que pasa con tu cobertura hoy.
        </p>
      </Rise>

      <div className="cora-dash-top" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 'var(--s3)', marginBottom: 'var(--s3)' }}>
        <Rise delay={0.08}>
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: 'var(--forest)', borderColor: 'var(--forest)', color: '#EDE7D8', minHeight: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="eyebrow" style={{ color: 'rgba(237,231,216,.7)' }}>Tu cobertura</div>
                <Badge status="activo" label="Activa" />
              </div>
              <Icon name="shield-check" size={26} weight="fill" color="rgba(237,231,216,.85)" />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'rgba(237,231,216,.75)', marginBottom: 4 }}>Techo de cobertura por evento</div>
              <div className="font-serif tnum" style={{ fontSize: 'clamp(40px, 6vw, 58px)', fontWeight: 500, color: '#FBF8F1', lineHeight: 1 }}>
                <Money value={cfg.techoCobertura} count />
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5, color: 'rgba(237,231,216,.7)' }}>
                Cora co-paga tu atención en la red de hospitales privados.
              </div>
            </div>
          </Card>
        </Rise>

        <Rise delay={0.14}>
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 220 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Tu carencia</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="font-serif tnum" style={{ fontSize: 46, fontWeight: 500, color: 'var(--clay)' }}>{member.active_months}</span>
                <span className="font-serif" style={{ fontSize: 22, color: 'var(--ink-2)' }}>/ {cfg.mesesCarencia} meses</span>
              </div>
            </div>
            <div>
              <ProgressBar value={member.active_months} max={cfg.mesesCarencia} color="var(--clay)" height={9} />
              <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                {member.is_eligible
                  ? 'Ya podés solicitar ayuda cuando lo necesités.'
                  : <>Te faltan <strong style={{ color: 'var(--ink)' }}>{restantes} {restantes === 1 ? 'mes' : 'meses'}</strong> para poder solicitar ayuda.</>}
              </p>
            </div>
          </Card>
        </Rise>
      </div>

      <Rise delay={0.2} style={{ marginBottom: 'var(--s3)' }}>
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 46, height: 46, borderRadius: 'var(--r)', background: 'var(--clay-soft)',
              display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name="calendar-dot" size={24} color="var(--clay)" />
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15.5 }}>Tu próximo aporte</div>
              <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>
                <span className="tnum font-serif" style={{ fontSize: 17, color: 'var(--ink)' }}>{money(cfg.primaMensual)}</span> · vence el 1 de julio
              </div>
            </div>
          </div>
          <Button variant="clay" icon="hand-coins" onClick={() => go('aportar')}>Aportar ahora</Button>
        </Card>
      </Rise>

      <Rise delay={0.26}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 21 }}>El fondo, hoy</h3>
          <button onClick={() => go('fondo')} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--forest)', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
            Ver transparencia <Icon name="arrow-right" size={15} />
          </button>
        </div>
        <div className="cora-dash-fund" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s3)' }}>
          <Card>
            <StateWrap status={pool.status === 'ok' ? 'ok' : pool.status} error={pool.error} onRetry={pool.reload}
              skeleton={<div style={{ display: 'grid', gap: 14 }}>{[0,1,2,3].map(i => <span key={i} className="skel" style={{ height: 22 }} />)}</div>}>
              {pool.data && <>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Reserva común</div>
                <div className="font-serif tnum" style={{ fontSize: 38, fontWeight: 500, marginBottom: 6 }}>
                  <Money value={pool.data.total_reserve} count />
                </div>
                <StatRow label="Generando rendimiento"       value={<Money value={pool.data.yield_placed} />} accent="var(--forest)" />
                <StatRow label="Disponible para atenciones"  value={<Money value={pool.data.available} />} />
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 13, color: 'var(--ink-2)', fontSize: 14 }}>
                  <span>{pool.data.member_count} miembros</span>
                  <span>{pool.data.claims_paid} atenciones co-pagadas</span>
                </div>
              </>}
            </StateWrap>
          </Card>

          <Card>
            <StateWrap status={yld.status === 'ok' ? 'ok' : yld.status} error={yld.error} onRetry={yld.reload}
              skeleton={<div style={{ display: 'grid', gap: 14 }}>{[0,1,2].map(i => <span key={i} className="skel" style={{ height: 22 }} />)}</div>}>
              {yld.data && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Rendimiento del fondo</div>
                  <Icon name="trend-up" size={22} color="var(--forest)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <div className="font-serif tnum" style={{ fontSize: 38, fontWeight: 500, color: 'var(--forest)' }}>
                    <Money value={yld.data.yield_amount} count />
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>acumulado</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '4px 0 16px' }}>
                  Lo que está en reserva genera un rendimiento prudente que hace crecer el fondo de todos.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px',
                  background: 'var(--forest-soft)', borderRadius: 99, color: 'var(--forest-dark)', fontWeight: 600, fontSize: 14 }}>
                  <span className="tnum">{yld.data.apy_approx}%</span> aprox. anual
                </div>
              </>}
            </StateWrap>
          </Card>
        </div>
      </Rise>
    </div>
  );
}
