/* ============================================================
   Cora — capa de servicio (ÚNICO punto de datos)
   Toda lectura/escritura pasa por aquí. Hoy: mocks.
   Mañana: @stellar/stellar-sdk, sin tocar las pantallas.

   Tipos (referencia, en TS serían interfaces explícitas):
   ClaimStatus = 'enviado'|'en_validacion'|'aprobado'|'pagado'|'rechazado'
   Member      { id, nombre, fechaIngreso, totalAportado, mesesActivos, mesesCarencia, elegible }
   PoolStatus  { reservaTotal, colocadoEnRendimiento, disponible, miembros, claimsPagados }
   YieldStatus { colocado, rendimientoAcumulado, apyAprox }
   Contribution{ id, fecha, monto, estado: 'pendiente'|'confirmado' }
   Hospital    { id, nombre, ciudad }
   Claim       { id, fecha, hospital, montoSolicitado, diasEnLista, referencia,
                 estado, aprobaciones, aprobacionesNecesarias }
   ============================================================ */
(function () {
  const cfg = window.CoraConfig;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const lat = () => 480 + Math.random() * 420; // latencia simulada

  // ---- almacén mock en memoria (mutable durante la sesión) ----
  const db = {
    member: {
      id: 'mbr_8f21',
      nombre: 'Valeria Jiménez',
      fechaIngreso: '2026-02-01',
      totalAportado: 72,
      mesesActivos: 4,
      mesesCarencia: cfg.product.mesesCarencia,
      elegible: false,
    },
    pool: {
      reservaTotal: 42300,
      colocadoEnRendimiento: 31000,
      disponible: 11300,
      miembros: 154,
      claimsPagados: 7,
    },
    yield: {
      colocado: 31000,
      rendimientoAcumulado: 1240,
      apyAprox: 6.2,
    },
    hospitals: [
      { id: 'hsp_bib', nombre: 'Clínica Bíblica', ciudad: 'San José' },
      { id: 'hsp_cima', nombre: 'Hospital CIMA', ciudad: 'Escazú' },
      { id: 'hsp_metro', nombre: 'Hospital Metropolitano', ciudad: 'San José' },
      { id: 'hsp_cat', nombre: 'Hospital Clínica Católica', ciudad: 'Guadalupe' },
    ],
    contributions: [
      { id: 'apt_0001', fecha: '2026-02-01', monto: 18, estado: 'confirmado' },
      { id: 'apt_0002', fecha: '2026-03-01', monto: 18, estado: 'confirmado' },
      { id: 'apt_0003', fecha: '2026-04-01', monto: 18, estado: 'confirmado' },
      { id: 'apt_0004', fecha: '2026-05-01', monto: 18, estado: 'confirmado' },
    ],
    claims: [
      {
        id: 'clm_4a7e',
        fecha: '2026-05-18',
        hospital: { id: 'hsp_cima', nombre: 'Hospital CIMA', ciudad: 'Escazú' },
        montoSolicitado: 3200,
        diasEnLista: 412,
        referencia: 'CCSS-2024-118324',
        estado: 'en_validacion',
        aprobaciones: 1,
        aprobacionesNecesarias: 2,
      },
    ],
  };

  let _id = 1000;
  const newId = (p) => `${p}_${(++_id).toString(16)}`;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ============================================================
  //  API pública — async, espejo exacto del contrato
  // ============================================================
  const service = {
    // mock de Privy (login por email / passkey)
    async login() {
      await wait(lat());
      // TODO: conectar a Soroban / Privy — crear o recuperar wallet del usuario
      return clone(db.member);
    },

    async getMember() {
      await wait(lat());
      // TODO: conectar a Soroban — leer estado del miembro
      return clone(db.member);
    },

    async getPoolStatus() {
      await wait(lat());
      // TODO: conectar a Soroban — leer reservas del contrato del fondo
      return clone(db.pool);
    },

    async getYieldStatus() {
      await wait(lat());
      // TODO: conectar a Soroban — leer rendimiento colocado
      return clone(db.yield);
    },

    async contribute(monto) {
      await wait(lat());
      // TODO: conectar a Soroban — transferir USDC al contrato del fondo
      const c = { id: newId('apt'), fecha: hoy(), monto, estado: 'confirmado' };
      db.contributions = [c, ...db.contributions];
      db.member.totalAportado += monto;
      db.member.mesesActivos = Math.min(db.member.mesesCarencia, db.member.mesesActivos + 1);
      db.member.elegible = db.member.mesesActivos >= db.member.mesesCarencia;
      db.pool.reservaTotal += monto;
      db.pool.disponible += monto;
      return clone(c);
    },

    async getContributions() {
      await wait(lat());
      return clone(db.contributions);
    },

    async getHospitals() {
      await wait(lat());
      return clone(db.hospitals);
    },

    async submitClaim(input) {
      await wait(lat());
      // TODO: conectar a Soroban — registrar solicitud en el contrato de claims
      const hospital = db.hospitals.find((h) => h.id === input.hospitalId) || db.hospitals[0];
      const claim = {
        id: newId('clm'),
        fecha: hoy(),
        hospital: clone(hospital),
        montoSolicitado: input.monto,
        diasEnLista: input.diasEnLista,
        referencia: input.referencia,
        estado: 'enviado',
        aprobaciones: 0,
        aprobacionesNecesarias: cfg.product.aprobacionesNecesarias,
      };
      db.claims = [claim, ...db.claims];
      return clone(claim);
    },

    async getClaims() {
      await wait(lat());
      return clone(db.claims);
    },

    // vista validador
    async attestClaim(claimId, aprobar) {
      await wait(lat());
      // TODO: conectar a Soroban — firmar atestación 2-de-3
      const claim = db.claims.find((c) => c.id === claimId);
      if (!claim) throw new Error('Solicitud no encontrada');
      if (!aprobar) {
        claim.estado = 'rechazado';
        return clone(claim);
      }
      claim.aprobaciones = Math.min(claim.aprobacionesNecesarias, claim.aprobaciones + 1);
      if (claim.aprobaciones >= claim.aprobacionesNecesarias) {
        claim.estado = 'aprobado';
        // co-pago al hospital
        setTimeout(() => { claim.estado = 'pagado'; }, 0);
      } else {
        claim.estado = 'en_validacion';
      }
      return clone(claim);
    },
  };

  function hoy() {
    const d = new Date(2026, 5, 3); // 3 de junio de 2026 (fecha del proyecto)
    return d.toISOString().slice(0, 10);
  }

  window.coraService = service;
})();
