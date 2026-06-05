import { useState } from 'react';
import { Rise, Card, Icon, Button, Badge, StateWrap, SectionTitle, money, fmtDate } from '../components';
import { useAsync } from '../hooks';
import { getPendingClaims, attestClaim } from '../services/contract-service';

function ChipFact({ icon, label, value, flag }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <Icon name={icon} size={18} color={flag ? 'var(--forest)' : 'var(--ink-2)'} />
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

export default function Validador() {
  const claims  = useAsync(() => getPendingClaims(), []);
  const [busy, setBusy]   = useState(null);
  const [toast, setToast] = useState(null);

  const pendientes = (claims.data || []).filter((c) => c.status === 'enviado' || c.status === 'en_validacion');
  const resueltos  = (claims.data || []).filter((c) => c.status !== 'enviado' && c.status !== 'en_validacion');

  const attest = async (c, aprobar) => {
    setBusy(c.claim_id + (aprobar ? 'a' : 'r'));
    try {
      const updated = await attestClaim(null, c.claim_id, aprobar);
      claims.reload();
      setToast(aprobar
        ? (updated.status === 'aprobado' || updated.status === 'pagado'
            ? 'Aprobada. El fondo co-paga al hospital.'
            : `Tu aprobación quedó registrada (${updated.attestations} de ${updated.attestations_needed}).`)
        : 'Solicitud rechazada.');
      setTimeout(() => setToast(null), 3200);
    } catch { setToast('No se pudo registrar.'); }
    setBusy(null);
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <Rise delay={0.02}>
        <SectionTitle eyebrow="Rol validador">Bandeja de validación</SectionTitle>
        <p style={{ color: 'var(--ink-2)', marginTop: -16, marginBottom: 'var(--s3)', maxWidth: 560 }}>
          Revisá cada caso con cuidado. Se necesitan 2 de 3 validadores para que el fondo co-pague.
        </p>
      </Rise>

      <StateWrap status={claims.status === 'ok' ? 'ok' : claims.status} error={claims.error} onRetry={claims.reload}
        skeleton={<div style={{ display: 'grid', gap: 14 }}>{[0,1].map(i => <span key={i} className="skel" style={{ height: 130 }} />)}</div>}>
        <>
          <Rise delay={0.08}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <h3 style={{ fontSize: 18 }}>Por revisar</h3>
              <span style={{ background: 'var(--clay-soft)', color: 'var(--clay)', borderRadius: 99, padding: '2px 9px',
                fontSize: 12.5, fontWeight: 700 }} className="tnum">{pendientes.length}</span>
            </div>
            {pendientes.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 'var(--s4)', color: 'var(--ink-2)' }}>
                <Icon name="check-circle" size={26} color="var(--forest)" /><p style={{ margin: '8px 0 0' }}>No hay solicitudes pendientes.</p>
              </Card>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--s2)' }}>
                {pendientes.map((c) => (
                  <Card key={c.claim_id} pad="var(--s3)">
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <span style={{ width: 46, height: 46, borderRadius: 'var(--r)', background: 'var(--clay-soft)',
                          display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <Icon name="hospital" size={23} color="var(--clay)" />
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'var(--serif)' }}>{c.hospital.nombre}</div>
                          <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{c.referencia}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="font-serif tnum" style={{ fontSize: 22 }}>{money(c.amount)}</div>
                        <Badge status={c.status} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', padding: '14px 0',
                      borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)', marginBottom: 16 }}>
                      <ChipFact icon="hourglass-high" label="En lista"      value={`${c.days_waiting} días`} flag={c.days_waiting > 180} />
                      <ChipFact icon="map-pin"        label="Ciudad"        value={c.hospital.ciudad} />
                      <ChipFact icon="users-three"    label="Aprobaciones"  value={`${c.attestations} de ${c.attestations_needed}`} />
                      <ChipFact icon="calendar-blank" label="Recibida"      value={fmtDate(c.date)} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <Button variant="danger" icon="x" loading={busy === c.claim_id + 'r'}
                        onClick={() => attest(c, false)}>Rechazar</Button>
                      <Button variant="primary" icon="check" loading={busy === c.claim_id + 'a'}
                        onClick={() => attest(c, true)}>Aprobar caso</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Rise>

          {resueltos.length > 0 && (
            <Rise delay={0.14} style={{ marginTop: 'var(--s4)' }}>
              <h3 style={{ fontSize: 18, marginBottom: 14 }}>Resueltos</h3>
              <Card pad="0">
                {resueltos.map((c, i) => (
                  <div key={c.claim_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                    padding: '15px 20px', borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{c.hospital.nombre}</div>
                      <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{c.referencia}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span className="font-serif tnum" style={{ fontSize: 17 }}>{money(c.amount)}</span>
                      <Badge status={c.status} />
                    </div>
                  </div>
                ))}
              </Card>
            </Rise>
          )}
        </>
      </StateWrap>

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
          background: 'var(--forest)', color: '#F3EFE6', padding: '13px 20px', borderRadius: 'var(--r)',
          boxShadow: 'var(--shadow)', fontSize: 14.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="check-circle" size={19} color="#F0DACE" /> {toast}
        </div>
      )}
    </div>
  );
}
