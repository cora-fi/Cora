import { useState } from 'react';
import { Rise, Card, Icon, Button, Field, inputStyle, SectionTitle, Badge, ProgressBar, money } from '../components';
import { useAsync } from '../hooks';
import { CoraConfig } from '../config';
import { getHospitals, submitClaim } from '../services/mock-service';

const CLAIM_STEPS = [
  { key: 'enviado',       label: 'Enviado',            desc: 'Recibimos tu solicitud.',               icon: 'paper-plane-tilt' },
  { key: 'en_validacion', label: 'En validación',      desc: 'Validadores revisan (2 de 3).',         icon: 'users-three' },
  { key: 'aprobado',      label: 'Aprobado',           desc: 'El fondo autoriza el co-pago.',         icon: 'seal-check' },
  { key: 'pagado',        label: 'Pagado al hospital', desc: 'Cora le paga al hospital.',             icon: 'hospital' },
];

const stepIndex = (status) => {
  if (status === 'rechazado') return -1;
  const i = CLAIM_STEPS.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
};

export function ClaimTimeline({ claim }) {
  const active    = stepIndex(claim.status);
  const rechazado = claim.status === 'rechazado';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {CLAIM_STEPS.map((s, i) => {
        const done    = i < active;
        const current = i === active;
        const future  = i > active;
        const color   = rechazado ? 'var(--hairline)' : done || current ? 'var(--forest)' : 'var(--hairline)';
        return (
          <div key={s.key} style={{ display: 'flex', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: done ? 'var(--forest)' : current ? 'var(--forest-soft)' : 'var(--canvas)',
                border: `1.5px solid ${color}`,
                color: done ? '#F3EFE6' : current ? 'var(--forest)' : 'var(--ink-2)' }}>
                {done
                  ? <Icon name="check" size={16} weight="bold" />
                  : current && claim.status === 'en_validacion'
                    ? <span className="cora-spin" style={{ width: 13, height: 13, color: 'var(--forest)' }} />
                    : <Icon name={s.icon} size={15} />}
              </span>
              {i < CLAIM_STEPS.length - 1 && (
                <span style={{ width: 2, flex: 1, minHeight: 34, background: i < active ? 'var(--forest)' : 'var(--hairline)' }} />
              )}
            </div>
            <div style={{ paddingBottom: i < CLAIM_STEPS.length - 1 ? 22 : 0, paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: future ? 'var(--ink-2)' : 'var(--ink)' }}>{s.label}</span>
                {current && s.key === 'en_validacion' &&
                  <span className="tnum" style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
                    {claim.attestations} de {claim.attestations_needed}
                  </span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        );
      })}
      {rechazado && (
        <div style={{ marginTop: 6, padding: '10px 14px', background: '#F3DAD5', borderRadius: 'var(--r)',
          color: 'var(--error)', fontSize: 13.5, fontWeight: 500, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="x-circle" size={17} /> La solicitud fue rechazada por los validadores.
        </div>
      )}
    </div>
  );
}

function NoElegible({ member, go }) {
  const cfg       = CoraConfig.product;
  const restantes = Math.max(0, cfg.mesesCarencia - member.active_months);
  return (
    <div style={{ maxWidth: 620 }}>
      <Rise delay={0.02}><SectionTitle eyebrow="Solicitar ayuda">Todavía no podés solicitar</SectionTitle></Rise>
      <Rise delay={0.08}>
        <Card pad="var(--s4)" style={{ textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--clay-soft)',
            display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
            <Icon name="hourglass-medium" size={26} color="var(--clay)" />
          </span>
          <h3 style={{ fontSize: 22 }}>Estás en tu período de carencia</h3>
          <p style={{ color: 'var(--ink-2)', margin: '10px auto 20px', maxWidth: 420, lineHeight: 1.55 }}>
            Para poder solicitar ayuda hay que cumplir {cfg.mesesCarencia} meses aportando. Llevás {member.active_months};
            te faltan <strong style={{ color: 'var(--ink)' }}>{restantes} {restantes === 1 ? 'mes' : 'meses'}</strong>.
          </p>
          <div style={{ maxWidth: 340, margin: '0 auto 22px' }}>
            <ProgressBar value={member.active_months} max={cfg.mesesCarencia} color="var(--clay)" height={9} />
          </div>
          <Button variant="secondary" onClick={() => go('cobertura')}>Ver mi cobertura</Button>
        </Card>
      </Rise>
    </div>
  );
}

export default function Solicitar({ member, go }) {
  const cfg       = CoraConfig.product;
  const hospitals = useAsync(() => getHospitals(), []);
  const [form, setForm]     = useState({ referencia: '', fechaLista: '', hospitalId: '', monto: '' });
  const [archivo, setArchivo] = useState(null);
  const [errs, setErrs]     = useState({});
  const [phase, setPhase]   = useState('form');
  const [claim, setClaim]   = useState(null);

  if (!member.is_eligible) return <NoElegible member={member} go={go} />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const diasEn = (() => {
    if (!form.fechaLista) return null;
    return Math.round((new Date('2026-06-04') - new Date(form.fechaLista)) / 86400000);
  })();

  const validate = () => {
    const e = {};
    if (!form.referencia.trim()) e.referencia = 'Indicá la referencia de la CCSS.';
    if (!form.fechaLista)         e.fechaLista = 'Indicá desde cuándo estás en lista.';
    else if (diasEn != null && diasEn < 180) e.fechaLista = `Llevás ${diasEn} días; se requieren más de 180.`;
    if (!form.hospitalId)         e.hospitalId = 'Elegí un hospital de la red.';
    if (!form.monto || Number(form.monto) <= 0)              e.monto = 'Indicá el monto solicitado.';
    else if (Number(form.monto) > cfg.techoCobertura)        e.monto = `El techo es ${money(cfg.techoCobertura)} por evento.`;
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async () => {
    if (!validate()) return;
    setPhase('sending');
    try {
      const c = await submitClaim({
        member:           member.address,
        referencia:       form.referencia,
        fecha_referencia: form.fechaLista,
        hospital:         form.hospitalId,
        monto:            Number(form.monto),
      });
      setClaim(c);
      setPhase('done');
    } catch { setPhase('form'); }
  };

  if (phase === 'done' && claim) {
    return (
      <div style={{ maxWidth: 720 }}>
        <Rise delay={0.02} style={{ textAlign: 'center', marginBottom: 'var(--s4)' }}>
          <span style={{ width: 60, height: 60, borderRadius: 99, background: 'var(--forest-soft)',
            display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
            <Icon name="paper-plane-tilt" size={28} weight="fill" color="var(--forest)" />
          </span>
          <h1 style={{ fontSize: 32 }}>Tu solicitud está en camino</h1>
          <p style={{ color: 'var(--ink-2)', marginTop: 10, fontSize: 16 }}>
            La estamos validando entre la red. Te avisamos en cada paso. Tranquila: vos no adelantás nada.
          </p>
        </Rise>
        <Rise delay={0.1}>
          <Card pad="var(--s4)">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24,
              paddingBottom: 20, borderBottom: '1px solid var(--hairline)' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Solicitud</div>
                <div className="font-mono" style={{ fontSize: 14, fontWeight: 600 }}>{claim.claim_id}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Hospital</div>
                <div style={{ fontWeight: 600 }}>{claim.hospital.nombre}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Monto solicitado</div>
                <div className="font-serif tnum" style={{ fontSize: 22 }}>{money(claim.amount)}</div>
              </div>
            </div>
            <ClaimTimeline claim={claim} />
          </Card>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            <Button variant="secondary" onClick={() => go('solicitudes')}>Ver mis solicitudes</Button>
            <Button onClick={() => go('dashboard')} icon="house">Ir al inicio</Button>
          </div>
        </Rise>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Rise delay={0.02}>
        <SectionTitle eyebrow="Cuando la salud no puede esperar"
          sub="Contanos de tu caso. Tres validadores de la red revisan cada solicitud antes de que el fondo co-pague.">
          Solicitar ayuda
        </SectionTitle>
      </Rise>

      <Rise delay={0.08}>
        <Card pad="var(--s4)" style={{ display: 'grid', gap: 22 }}>
          <Field label="Referencia de tu lista de espera (CCSS)" error={errs.referencia}
            hint="El número o constancia que te dio la Caja.">
            <input value={form.referencia} onChange={(e) => set('referencia', e.target.value)}
              placeholder="CCSS-2024-000000" style={inputStyle(!!errs.referencia)} />
          </Field>

          <div>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginBottom: 7 }}>Constancia de la Caja (foto o PDF)</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', cursor: 'pointer',
              border: `1px dashed ${archivo ? 'var(--forest)' : 'var(--hairline)'}`, borderRadius: 'var(--r)',
              background: archivo ? 'var(--forest-soft)' : 'var(--canvas)', transition: 'all .15s' }}>
              <Icon name={archivo ? 'check-circle' : 'upload-simple'} size={22} color={archivo ? 'var(--forest)' : 'var(--ink-2)'} />
              <span style={{ fontSize: 14, color: archivo ? 'var(--forest-dark)' : 'var(--ink-2)', flex: 1 }}>
                {archivo ? archivo : 'Subí una foto o PDF de tu constancia'}
              </span>
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                onChange={(e) => setArchivo(e.target.files[0] ? e.target.files[0].name : null)} />
              {!archivo && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>Examinar</span>}
            </label>
          </div>

          <div className="cora-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <Field label="Desde cuándo estás en lista" error={errs.fechaLista}
              hint={diasEn != null && diasEn >= 0 && !errs.fechaLista ? `${diasEn} días en espera` : 'Fecha de ingreso a la lista.'}>
              <input type="date" max="2026-06-04" value={form.fechaLista} onChange={(e) => set('fechaLista', e.target.value)}
                style={inputStyle(!!errs.fechaLista)} />
            </Field>
            <Field label="Monto solicitado" error={errs.monto} hint={`Techo: ${money(cfg.techoCobertura)} por evento.`}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-2)' }}>$</span>
                <input type="number" value={form.monto} onChange={(e) => set('monto', e.target.value)}
                  placeholder="0" className="tnum" style={{ ...inputStyle(!!errs.monto), paddingLeft: 26 }} />
              </div>
            </Field>
          </div>

          <Field label="Hospital de la red" error={errs.hospitalId}>
            <div style={{ position: 'relative' }}>
              <select value={form.hospitalId} onChange={(e) => set('hospitalId', e.target.value)}
                style={{ ...inputStyle(!!errs.hospitalId), appearance: 'none', paddingRight: 38, cursor: 'pointer',
                  color: form.hospitalId ? 'var(--ink)' : 'var(--ink-2)' }}>
                <option value="">Elegí un hospital…</option>
                {hospitals.data && hospitals.data.map((h) => (
                  <option key={h.id} value={h.id}>{h.nombre} — {h.ciudad}</option>
                ))}
              </select>
              <Icon name="caret-down" size={16} color="var(--ink-2)"
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4, flexWrap: 'wrap' }}>
            <Button size="lg" loading={phase === 'sending'} icon="paper-plane-tilt" onClick={enviar}>
              {phase === 'sending' ? 'Enviando…' : 'Enviar solicitud'}
            </Button>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="lock-simple" size={15} /> Tus datos quedan protegidos.
            </span>
          </div>
        </Card>
      </Rise>
    </div>
  );
}
