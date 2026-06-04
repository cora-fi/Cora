/* ============================================================
   Cora — Pantalla 4: Mi cobertura
   ============================================================ */
function Cobertura({ member, go }) {
  const cfg = window.CoraConfig.product;
  const hospitals = useAsync(() => coraService.getHospitals(), []);
  const restantes = Math.max(0, member.mesesCarencia - member.mesesActivos);

  return (
    <div style={{ maxWidth: 1000 }}>
      <Rise delay={0.02}><SectionTitle eyebrow="Lo que te cubre Cora"
        sub="Tu cobertura tiene reglas claras: cuánto te cubre, desde cuándo, y en qué hospitales.">
        Mi cobertura
      </SectionTitle></Rise>

      {/* elegibilidad */}
      <Rise delay={0.08} style={{ marginBottom: 'var(--s3)' }}>
        <Card pad="var(--s4)">
          <div className="cora-elig" style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 'var(--s4)', alignItems: 'center' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Tu elegibilidad</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Badge status={member.elegible ? 'aprobado' : 'pendiente'}
                  label={member.elegible ? 'Elegible' : 'En carencia'} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                <span className="font-serif tnum" style={{ fontSize: 44, fontWeight: 500, color: 'var(--clay)' }}>{member.mesesActivos}</span>
                <span className="font-serif" style={{ fontSize: 20, color: 'var(--ink-2)' }}>de {member.mesesCarencia} meses cumplidos</span>
              </div>
              <ProgressBar value={member.mesesActivos} max={member.mesesCarencia} color="var(--clay)" height={9} />
              <p style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                {member.elegible
                  ? 'Cumpliste la carencia. Ya podés solicitar ayuda cuando lo necesités.'
                  : <>La carencia es el tiempo mínimo aportando antes de poder pedir ayuda. Te faltan <strong style={{ color: 'var(--ink)' }}>{restantes} {restantes === 1 ? 'mes' : 'meses'}</strong>.</>}
              </p>
            </div>

            <div style={{ background: 'var(--hairline)', height: '100%', width: 1 }} className="cora-elig-divider" />

            <div style={{ display: 'grid', gap: 18 }}>
              <KeyFact icon="ticket" label="Requisito para solicitar"
                value="Más de 180 días en lista de espera de la CCSS" />
              <KeyFact icon="coins" label="Tu cuota mensual" value={`${money(cfg.primaMensual)} / mes`} />
              <KeyFact icon="calendar-check" label="Miembro desde" value={fmtDate(member.fechaIngreso)} />
            </div>
          </div>
        </Card>
      </Rise>

      {/* techo de cobertura */}
      <Rise delay={0.14} style={{ marginBottom: 'var(--s3)' }}>
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
          background: 'var(--forest)', borderColor: 'var(--forest)', color: '#EDE7D8' }}>
          <div style={{ maxWidth: 480 }}>
            <div className="eyebrow" style={{ color: 'rgba(237,231,216,.7)', marginBottom: 8 }}>Techo de cobertura</div>
            <h3 style={{ color: '#FBF8F1', fontSize: 22, marginBottom: 8 }}>Hasta {money(cfg.techoCobertura)} por evento de salud</h3>
            <p style={{ color: 'rgba(237,231,216,.78)', fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
              Cuando te toca, Cora co-paga tu atención en un hospital privado hasta ese monto. Vos no tenés que adelantar la plata.
            </p>
          </div>
          <div className="font-serif tnum" style={{ fontSize: 'clamp(44px, 7vw, 64px)', fontWeight: 500, color: '#FBF8F1', lineHeight: 1 }}>
            {money(cfg.techoCobertura)}
          </div>
        </Card>
      </Rise>

      {/* red de hospitales */}
      <Rise delay={0.2}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 21 }}>La red de hospitales</h3>
          {member.elegible && <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => go('solicitar')}>Solicitar ayuda</Button>}
        </div>
        <StateWrap status={hospitals.status === 'ok' ? 'ok' : hospitals.status} error={hospitals.error} onRetry={hospitals.reload}
          skeleton={<div className="cora-hosp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--s3)' }}>
            {[0,1,2,3].map(i => <span key={i} className="skel" style={{ height: 84 }} />)}</div>}>
          <div className="cora-hosp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--s3)' }}>
            {hospitals.data && hospitals.data.map((h) => (
              <Card key={h.id} hover style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                <span style={{ width: 46, height: 46, borderRadius: 'var(--r)', background: 'var(--clay-soft)',
                  display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="hospital" size={24} color="var(--clay)" />
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'var(--serif)' }}>{h.nombre}</div>
                  <div style={{ color: 'var(--ink-2)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Icon name="map-pin" size={14} /> {h.ciudad}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </StateWrap>
      </Rise>
    </div>
  );
}

function KeyFact({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <span style={{ width: 38, height: 38, borderRadius: 'var(--r)', background: 'var(--canvas)', border: '1px solid var(--hairline)',
        display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={19} color="var(--forest)" />
      </span>
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.35 }}>{value}</div>
      </div>
    </div>
  );
}

Object.assign(window, { Cobertura, KeyFact });
