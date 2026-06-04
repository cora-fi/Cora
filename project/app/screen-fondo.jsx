/* ============================================================
   Cora — Pantalla 7: El fondo / Transparencia
   ============================================================ */
function Fondo() {
  const pool = useAsync(() => coraService.getPoolStatus(), []);
  const yld = useAsync(() => coraService.getYieldStatus(), []);
  const loading = pool.status === 'loading' || yld.status === 'loading';

  return (
    <div style={{ maxWidth: 1040 }}>
      <Rise delay={0.02}><SectionTitle eyebrow="Transparencia"
        sub="El fondo es de todos y está a la vista. Esto es lo que hay, dónde está y a cuánta gente ya respaldó.">
        El fondo común
      </SectionTitle></Rise>

      {loading ? (
        <div style={{ display: 'grid', gap: 'var(--s3)' }}>
          <span className="skel" style={{ height: 200 }} />
          <div className="cora-fund-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--s3)' }}>
            {[0,1,2].map(i => <span key={i} className="skel" style={{ height: 120 }} />)}
          </div>
        </div>
      ) : pool.data && yld.data ? (
        <>
          {/* composición de la reserva */}
          <Rise delay={0.08} style={{ marginBottom: 'var(--s3)' }}>
            <Card pad="var(--s4)">
              <div className="cora-fund-top" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 'var(--s5)', alignItems: 'center' }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Reserva total</div>
                  <div className="font-serif tnum" style={{ fontSize: 'clamp(48px, 7vw, 68px)', fontWeight: 500, lineHeight: 1 }}>
                    <Money value={pool.data.reservaTotal} count />
                  </div>
                  <p style={{ color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.55, maxWidth: 360 }}>
                    Es la suma de los aportes de {pool.data.miembros} miembros, más el rendimiento que ha generado.
                  </p>
                </div>

                <div>
                  {/* barra de composición */}
                  <div style={{ display: 'flex', height: 18, borderRadius: 99, overflow: 'hidden', marginBottom: 18 }}>
                    <div style={{ width: `${(pool.data.colocadoEnRendimiento / pool.data.reservaTotal) * 100}%`, background: 'var(--forest)' }} />
                    <div style={{ width: `${(pool.data.disponible / pool.data.reservaTotal) * 100}%`, background: 'var(--clay)' }} />
                  </div>
                  <CompRow color="var(--forest)" label="Generando rendimiento"
                    value={pool.data.colocadoEnRendimiento} total={pool.data.reservaTotal} />
                  <CompRow color="var(--clay)" label="Disponible para atenciones"
                    value={pool.data.disponible} total={pool.data.reservaTotal} />
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.5 }}>
                    Una parte trabaja y crece; otra queda lista para responder cuando alguien la necesita.
                  </p>
                </div>
              </div>
            </Card>
          </Rise>

          {/* métricas */}
          <Rise delay={0.14} style={{ marginBottom: 'var(--s3)' }}>
            <div className="cora-fund-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--s3)' }}>
              <Metric icon="users-three" label="Miembros activos" value={pool.data.miembros} count color="var(--forest)" />
              <Metric icon="heartbeat" label="Atenciones co-pagadas" value={pool.data.claimsPagados} count color="var(--clay)" />
              <Metric icon="trend-up" label="Rendimiento acumulado" value={yld.data.rendimientoAcumulado} money count color="var(--forest)"
                foot={`${yld.data.apyAprox}% aprox. anual`} />
            </div>
          </Rise>

          {/* metáfora del latido */}
          <Rise delay={0.2}>
            <Card pad="var(--s4)" style={{ background: 'var(--forest)', borderColor: 'var(--forest)', color: '#EDE7D8',
              display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ width: 54, height: 54, borderRadius: 99, background: 'rgba(237,231,216,.12)',
                display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="heartbeat" size={28} color="#F0DACE" />
              </span>
              <p className="font-serif" style={{ fontSize: 'clamp(19px, 2.4vw, 24px)', lineHeight: 1.4, margin: 0, flex: 1, minWidth: 280, color: '#FBF8F1' }}>
                Como un corazón que bombea a donde el cuerpo lo necesita, Cora lleva el fondo a quien le toca.
              </p>
            </Card>
          </Rise>
        </>
      ) : (
        <StateWrap status="error" error="No pudimos cargar el fondo." onRetry={() => { pool.reload(); yld.reload(); }} />
      )}
    </div>
  );
}

function CompRow({ color, label, value, total }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '8px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: 'var(--ink-2)' }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="tnum font-serif" style={{ fontSize: 17 }}>{money(value)}</span>
        <span className="tnum" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{pct}%</span>
      </span>
    </div>
  );
}

function Metric({ icon, label, value, count, money: isMoney, color, foot }) {
  return (
    <Card>
      <Icon name={icon} size={24} color={color} />
      <div className="font-serif tnum" style={{ fontSize: 40, fontWeight: 500, margin: '12px 0 2px', color: 'var(--ink)' }}>
        {isMoney ? <Money value={value} count={count} /> : <CountNum value={value} count={count} />}
      </div>
      <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>{label}</div>
      {foot && <div style={{ marginTop: 10, display: 'inline-flex', padding: '5px 11px', background: 'var(--forest-soft)',
        borderRadius: 99, fontSize: 12.5, fontWeight: 600, color: 'var(--forest-dark)' }}>{foot}</div>}
    </Card>
  );
}
function CountNum({ value, count }) {
  const v = useCountUp(value, { start: count });
  return <span>{v}</span>;
}

Object.assign(window, { Fondo, CompRow, Metric });
