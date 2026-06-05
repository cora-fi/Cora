import { useState } from 'react';
import { Rise, Card, Icon, Button, Badge, StateWrap, SectionTitle, money, fmtDate } from '../components';
import { useAsync } from '../hooks';
import { getClaims } from '../services/contract-service';
import { ClaimTimeline } from './Solicitar';

function DetailLine({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 3 }}>{label}</div>
      <div className={mono ? 'font-mono' : ''} style={{ fontWeight: 600, fontSize: mono ? 13.5 : 15 }}>{value}</div>
    </div>
  );
}

export default function Solicitudes({ member, go }) {
  const claims = useAsync(() => getClaims(member?.address), [member?.address]);
  const [open, setOpen] = useState(null);

  return (
    <div style={{ maxWidth: 880 }}>
      <Rise delay={0.02}>
        <SectionTitle eyebrow="El historial de tus casos" sub="Cada solicitud que enviaste y en qué paso va.">
          Mis solicitudes
        </SectionTitle>
      </Rise>

      <Rise delay={0.08}>
        <StateWrap status={claims.status === 'ok' ? 'ok' : claims.status} error={claims.error} onRetry={claims.reload}
          isEmpty={claims.data && claims.data.length === 0}
          empty={<Card style={{ textAlign: 'center', padding: 'var(--s5)' }}>
            <Icon name="files" size={30} color="var(--ink-2)" />
            <p style={{ color: 'var(--ink-2)', margin: '12px 0 18px' }}>Todavía no enviaste ninguna solicitud.</p>
            <Button variant="secondary" onClick={() => go('solicitar')}>Solicitar ayuda</Button>
          </Card>}
          skeleton={<div style={{ display: 'grid', gap: 14 }}>{[0,1].map(i => <span key={i} className="skel" style={{ height: 96 }} />)}</div>}>
          <div style={{ display: 'grid', gap: 'var(--s2)' }}>
            {claims.data && claims.data.map((c) => {
              const isOpen = open === c.claim_id;
              return (
                <Card key={c.claim_id} pad="0" style={{ overflow: 'hidden' }}>
                  <button onClick={() => setOpen(isOpen ? null : c.claim_id)} style={{ width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--s3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                      <span style={{ width: 46, height: 46, borderRadius: 'var(--r)', background: 'var(--clay-soft)',
                        display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon name="hospital" size={23} color="var(--clay)" />
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'var(--serif)' }}>{c.hospital.nombre}</div>
                        <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>
                          {fmtDate(c.date)} · {c.claim_id}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <span className="font-serif tnum" style={{ fontSize: 19 }}>{money(c.amount)}</span>
                      <Badge status={c.status} />
                      <Icon name={isOpen ? 'caret-up' : 'caret-down'} size={16} color="var(--ink-2)" />
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 var(--s3) var(--s3)', borderTop: '1px solid var(--hairline)' }}>
                      {(c.status === 'pagado' || c.status === 'aprobado') && (
                        <div style={{ margin: 'var(--s3) 0 var(--s2)', padding: '14px 18px',
                          background: 'var(--forest-soft)', borderRadius: 'var(--r)',
                          display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Icon name="seal-check" size={22} weight="fill" color="var(--forest)" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--forest-dark)', fontSize: 14.5 }}>
                              {c.status === 'pagado' ? 'Fondos enviados al hospital' : 'Aprobado — pendiente de ejecución'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--forest-dark)', opacity: .8, marginTop: 2 }}>
                              {c.status === 'pagado'
                                ? `${money(c.amount)} transferidos a ${c.hospital.nombre}`
                                : 'El pago al hospital se procesará en breve.'}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="cora-claim-detail" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 'var(--s4)', paddingTop: 'var(--s3)' }}>
                        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                          <DetailLine label="Días en lista de espera" value={`${c.days_waiting} días`} />
                          <DetailLine label="Referencia CCSS"         value={c.referencia} mono />
                          <DetailLine label="Hospital"                value={`${c.hospital.nombre}, ${c.hospital.ciudad}`} />
                          <DetailLine label="Monto solicitado"        value={money(c.amount)} />
                        </div>
                        <div>
                          <div className="eyebrow" style={{ marginBottom: 16 }}>Estado de la solicitud</div>
                          <ClaimTimeline claim={c} />
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </StateWrap>
      </Rise>
    </div>
  );
}
