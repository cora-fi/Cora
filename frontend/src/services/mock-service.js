/**
 * mock-service.js — única capa de datos del frontend.
 *
 * Cada función tiene la misma firma que tendrá cuando se conecte al contrato
 * Soroban real. Cuando los contratos estén desplegados, basta con reemplazar
 * las implementaciones aquí sin tocar ningún componente.
 *
 * Contratos que se modelan:
 *   join, contribute, get_member, get_pool_status,
 *   submit_claim, attest_claim, execute_claim,
 *   deposit_to_yield / withdraw_from_yield
 */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lat  = () => 600 + Math.random() * 400;   // 600-1000 ms latencia simulada
const clone = (x) => JSON.parse(JSON.stringify(x));
const today = () => '2026-06-04';

// ---------------------------------------------------------------------------
// Estado mutable en memoria (simula la blockchain durante la sesión)
// ---------------------------------------------------------------------------
const _db = {
  members: {
    GBXYZ_DEMO: {
      address:           'GBXYZ_DEMO',
      nombre:            'Valeria Jiménez',  // campo de presentación, no del contrato
      join_date:         '2026-02-01',       // ISO string; contrato devuelve unix timestamp
      total_contributed: 72,
      active_months:     4,
      is_eligible:       false,
    },
  },
  pool: {
    total_reserve: 42300,
    yield_amount:  1240,
    member_count:  154,
    available:     11300,
    // campos de presentación adicionales
    yield_placed:  31000,
    claims_paid:   7,
  },
  yield: {
    yield_placed:  31000,
    yield_amount:  1240,
    apy_approx:    6.2,
  },
  hospitals: [
    { id: 'hsp_bib',   nombre: 'Clínica Bíblica',          ciudad: 'San José'  },
    { id: 'hsp_cima',  nombre: 'Hospital CIMA',             ciudad: 'Escazú'   },
    { id: 'hsp_metro', nombre: 'Hospital Metropolitano',    ciudad: 'San José'  },
    { id: 'hsp_cat',   nombre: 'Hospital Clínica Católica', ciudad: 'Guadalupe' },
  ],
  contributions: [
    { id: 'apt_0001', date: '2026-02-01', amount: 18, status: 'confirmado' },
    { id: 'apt_0002', date: '2026-03-01', amount: 18, status: 'confirmado' },
    { id: 'apt_0003', date: '2026-04-01', amount: 18, status: 'confirmado' },
    { id: 'apt_0004', date: '2026-05-01', amount: 18, status: 'confirmado' },
  ],
  claims: [
    {
      claim_id:           'clm_4a7e',
      date:               '2026-05-18',
      hospital:           { id: 'hsp_cima', nombre: 'Hospital CIMA', ciudad: 'Escazú' },
      amount:             3200,
      days_waiting:       412,
      referencia:         'CCSS-2024-118324',
      status:             'en_validacion',
      attestations:       1,
      attestations_needed: 2,
    },
  ],
};

let _claimCounter  = 0x1000;
let _contribCounter = 4;
const newClaimId  = () => `clm_${(++_claimCounter).toString(16)}`;
const newContribId = () => `apt_${String(++_contribCounter).padStart(4, '0')}`;

// ---------------------------------------------------------------------------
// login() — mock de Privy; devuelve el miembro de la sesión
// ---------------------------------------------------------------------------
export async function login() {
  await wait(lat());
  return clone(_db.members['GBXYZ_DEMO']);
}

// ---------------------------------------------------------------------------
// getMember(address) → { address, nombre, join_date, total_contributed, active_months, is_eligible }
// ---------------------------------------------------------------------------
export async function getMember(address = 'GBXYZ_DEMO') {
  await wait(lat());
  return clone(_db.members[address] ?? _db.members['GBXYZ_DEMO']);
}

// ---------------------------------------------------------------------------
// getPoolStatus() → { total_reserve, yield_amount, member_count, available, yield_placed, claims_paid }
// ---------------------------------------------------------------------------
export async function getPoolStatus() {
  await wait(lat());
  return clone(_db.pool);
}

// ---------------------------------------------------------------------------
// getYieldStatus() → { yield_placed, yield_amount, apy_approx }
// ---------------------------------------------------------------------------
export async function getYieldStatus() {
  await wait(lat());
  return clone(_db.yield);
}

// ---------------------------------------------------------------------------
// getHospitals() → [{ id, nombre, ciudad }]
// ---------------------------------------------------------------------------
export async function getHospitals() {
  await wait(lat());
  return clone(_db.hospitals);
}

// ---------------------------------------------------------------------------
// getContributions(address) → [{ id, date, amount, status }]
// ---------------------------------------------------------------------------
export async function getContributions(address = 'GBXYZ_DEMO') {
  await wait(lat());
  return clone(_db.contributions);
}

// ---------------------------------------------------------------------------
// getClaims(address) → [claim]
// ---------------------------------------------------------------------------
export async function getClaims(address = 'GBXYZ_DEMO') {
  await wait(lat());
  return clone(_db.claims);
}

// ---------------------------------------------------------------------------
// contribute(address, monto) → { id, date, amount, status }
// ---------------------------------------------------------------------------
export async function contribute(address = 'GBXYZ_DEMO', monto) {
  await wait(lat());
  const CARENCIA = 6;
  const m = _db.members[address] ?? _db.members['GBXYZ_DEMO'];
  const contrib = { id: newContribId(), date: today(), amount: monto, status: 'confirmado' };
  _db.contributions.unshift(contrib);
  m.total_contributed += monto;
  m.active_months = Math.min(CARENCIA, m.active_months + 1);
  m.is_eligible = m.active_months >= CARENCIA;
  _db.pool.total_reserve += monto;
  _db.pool.available += monto;
  return clone(contrib);
}

// ---------------------------------------------------------------------------
// submitClaim({ member, referencia, fecha_referencia, hospital, monto })
//   → { claim_id, date, hospital, amount, days_waiting, referencia, status,
//       attestations, attestations_needed }
// ---------------------------------------------------------------------------
export async function submitClaim({ member = 'GBXYZ_DEMO', referencia, fecha_referencia, hospital: hospitalId, monto }) {
  await wait(lat());
  const hospital = _db.hospitals.find((h) => h.id === hospitalId) ?? _db.hospitals[0];
  const days_waiting = Math.round((new Date(today()) - new Date(fecha_referencia)) / 86400000);
  const claim = {
    claim_id:           newClaimId(),
    date:               today(),
    hospital:           clone(hospital),
    amount:             monto,
    days_waiting,
    referencia,
    status:             'enviado',
    attestations:       0,
    attestations_needed: 2,
  };
  _db.claims.unshift(claim);
  return clone(claim);
}

// ---------------------------------------------------------------------------
// getClaimStatus(claim_id) → claim object
// ---------------------------------------------------------------------------
export async function getClaimStatus(claim_id) {
  await wait(lat());
  const c = _db.claims.find((c) => c.claim_id === claim_id);
  if (!c) throw new Error(`Claim ${claim_id} no encontrado`);
  return clone(c);
}

// ---------------------------------------------------------------------------
// attestClaim(validador, claim_id, aprobar) → updated claim
// ---------------------------------------------------------------------------
export async function attestClaim(validador, claim_id, aprobar) {
  await wait(lat());
  const c = _db.claims.find((c) => c.claim_id === claim_id);
  if (!c) throw new Error(`Claim ${claim_id} no encontrado`);
  if (!aprobar) {
    c.status = 'rechazado';
    return clone(c);
  }
  c.attestations = Math.min(c.attestations_needed, c.attestations + 1);
  c.status = c.attestations >= c.attestations_needed ? 'aprobado' : 'en_validacion';
  return clone(c);
}
