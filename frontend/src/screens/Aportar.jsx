import { useState } from 'react';
import { Rise, Card, Icon, Button, Field, inputStyle, StateWrap, Badge, money, fmtDate } from '../components';
import { useAsync } from '../hooks';
import { CoraConfig } from '../config';
import { getContributions, contribute, getMember } from '../services/contract-service';

function ReviewRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
      padding: '13px 0', borderBottom: last ? 'none' : '1px solid var(--hairline)' }}>
      <span style={{ color: 'var(--ink-2)', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function Aportar({ member, onMemberChange }) {
  const cfg     = CoraConfig.product;
  const [monto, setMonto]   = useState(cfg.primaMensual);
  const [phase, setPhase]   = useState('form');
  const [last, setLast]     = useState(null);
  const hist = useAsync(() => getContributions(member.address), []);

  const presets = [cfg.primaMensual, 36, 54];

  const confirmar = async () => {
    setPhase('processing');
    try {
      const c = await contribute(member.address, Number(monto));
      setLast(c);
      setPhase('done');
      hist.reload();
      const m = await getMember(member.address);
      onMemberChange(m);
    } catch {
      setPhase('error');
    }
  };

  return (
    <div style={{ maxWidth: 920 }}>
      <Rise delay={0.02}>
        <div style={{ marginBottom: 'var(--s3)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Tu aporte mensual</div>
          <h2 style={{ fontSize: 'clamp(26px, 3.2vw, 34px)' }}>Aportar</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--ink-2)', maxWidth: 560 }}>
            Cada aporte sostiene el fondo común. Es lo que permite que, cuando a alguien le toca, haya con qué responder.
          </p>
        </div>
      </Rise>

      <div className="cora-two-col" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 'var(--s4)', alignItems: 'start' }}>
        <Rise delay={0.08}>
          <Card pad="var(--s4)">
            {phase === 'form' && <>
              <Field label="¿Cuánto querés aportar?" hint={`Tu cuota mensual es de ${money(cfg.primaMensual)}. Podés aportar de más cuando quieras.`}>
                <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
                  {presets.map((p) => (
                    <button key={p} onClick={() => setMonto(p)} style={{
                      flex: 1, padding: '11px 8px', borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'var(--sans)',
                      fontWeight: 600, fontSize: 15, transition: 'all .15s',
                      border: `1px solid ${Number(monto) === p ? 'var(--forest)' : 'var(--hairline)'}`,
                      background: Number(monto) === p ? 'var(--forest-soft)' : 'var(--canvas)',
                      color: Number(monto) === p ? 'var(--forest-dark)' : 'var(--ink)' }}>
                      {money(p)}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--ink-2)', fontSize: 18, fontFamily: 'var(--serif)' }}>$</span>
                  <input type="number" value={monto} min={1} onChange={(e) => setMonto(e.target.value)}
                    className="tnum" style={{ ...inputStyle(false), paddingLeft: 30, fontSize: 20, fontFamily: 'var(--serif)' }} />
                </div>
              </Field>
              <div style={{ marginTop: 22 }}>
                <Button full size="lg" variant="clay" iconRight="arrow-right"
                  disabled={!monto || Number(monto) <= 0} onClick={() => setPhase('review')}>
                  Revisar aporte
                </Button>
              </div>
            </>}

            {phase === 'review' && <>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Confirmá tu aporte</div>
              <div style={{ display: 'grid', gap: 2, marginBottom: 22 }}>
                <ReviewRow label="Monto"      value={<span className="font-serif tnum" style={{ fontSize: 24 }}>{money(monto)}</span>} />
                <ReviewRow label="Destino"    value="Fondo común de Cora" />
                <ReviewRow label="A tu nombre" value={member.nombre} />
                <ReviewRow label="Fecha"      value="Hoy, 3 de junio" last />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="secondary" onClick={() => setPhase('form')}>Volver</Button>
                <Button full variant="clay" icon="check" onClick={confirmar}>Confirmar {money(monto)}</Button>
              </div>
            </>}

            {phase === 'processing' && (
              <div style={{ textAlign: 'center', padding: '38px 0' }}>
                <span className="cora-spin" style={{ width: 30, height: 30, borderWidth: 3, color: 'var(--forest)' }} />
                <p style={{ marginTop: 18, color: 'var(--ink-2)' }}>Registrando tu aporte…</p>
              </div>
            )}

            {phase === 'done' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <span style={{ width: 58, height: 58, borderRadius: 99, background: 'var(--forest-soft)',
                  display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                  <Icon name="check" size={30} weight="bold" color="var(--forest)" />
                </span>
                <h3 style={{ fontSize: 24 }}>Aporte recibido</h3>
                <p style={{ color: 'var(--ink-2)', margin: '8px 0 4px' }}>
                  Sumaste <strong style={{ color: 'var(--ink)' }}>{money(last?.amount)}</strong> al fondo. Gracias por sostenerlo.
                </p>
                <div className="font-mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 22 }}>ref · {last?.id}</div>
                <Button variant="secondary" onClick={() => { setMonto(cfg.primaMensual); setPhase('form'); }}>Hacer otro aporte</Button>
              </div>
            )}

            {phase === 'error' && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Icon name="warning-circle" size={32} color="var(--clay)" />
                <p style={{ margin: '12px 0 18px', color: 'var(--ink-2)' }}>No pudimos registrar el aporte.</p>
                <Button variant="secondary" icon="arrow-clockwise" onClick={() => setPhase('review')}>Reintentar</Button>
              </div>
            )}
          </Card>
        </Rise>

        <Rise delay={0.14}>
          <Card style={{ background: 'var(--canvas)' }}>
            <Icon name="hand-heart" size={26} color="var(--clay)" />
            <h4 className="font-serif" style={{ fontSize: 19, margin: '12px 0 8px' }}>¿A dónde va tu aporte?</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
              {[
                ['coins',        'Entra al fondo común, a tu nombre.'],
                ['shield-check', 'Sostiene la cobertura de toda la red.'],
                ['trend-up',     'Una parte genera rendimiento prudente.'],
              ].map(([ic, t]) => (
                <li key={t} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 14, color: 'var(--ink-2)' }}>
                  <Icon name={ic} size={18} color="var(--forest)" style={{ marginTop: 1, flexShrink: 0 }} /> {t}
                </li>
              ))}
            </ul>
          </Card>
        </Rise>
      </div>

      <Rise delay={0.2} style={{ marginTop: 'var(--s5)' }}>
        <h3 style={{ fontSize: 21, marginBottom: 14 }}>Tu historial de aportes</h3>
        <Card pad="0">
          <StateWrap status={hist.status === 'ok' ? 'ok' : hist.status} error={hist.error} onRetry={hist.reload}
            isEmpty={hist.data && hist.data.length === 0}
            skeleton={<div style={{ padding: 16, display: 'grid', gap: 12 }}>{[0,1,2].map(i => <span key={i} className="skel" style={{ height: 30 }} />)}</div>}>
            {hist.data && hist.data.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                padding: '15px 20px', borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 99, background: 'var(--forest-soft)',
                    display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name="arrow-up-right" size={17} color="var(--forest)" />
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>Aporte mensual</div>
                    <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{fmtDate(c.date)} · {c.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Badge status={c.status} />
                  <span className="tnum font-serif" style={{ fontSize: 18, minWidth: 56, textAlign: 'right' }}>{money(c.amount)}</span>
                </div>
              </div>
            ))}
          </StateWrap>
        </Card>
      </Rise>
    </div>
  );
}
