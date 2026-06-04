/**
 * mock-service.js — espejo exacto del contrato Soroban.
 * Reemplazar cada función con la llamada real a @stellar/stellar-sdk
 * sin modificar los shapes de retorno ni las firmas.
 *
 * Contrato expuesto:
 *   init, join, contribute, get_member, get_pool_status,
 *   submit_claim, attest_claim, execute_claim,
 *   deposit_to_yield, withdraw_from_yield
 */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lat = () => 400 + Math.random() * 300;

// Estado mutable en memoria (simula la blockchain durante la sesión)
const _db = {
  members: {
    GBXYZ_DEMO: {
      join_date: 1738368000,        // 2026-02-01 en Unix
      total_contributed: 72_000_000, // en stroops (7 decimales USDC)
      active_months: 4,
      is_eligible: false,
    },
  },
  pool: {
    total_reserve: 42_300_000_000,
    yield_amount: 1_240_000_000,
    member_count: 154,
    available: 11_300_000_000,
  },
  claims: {
    'clm_4a7e': {
      claim_id: 'clm_4a7e',
      status: 'en_validacion',   // enviado | en_validacion | aprobado | pagado | rechazado
      attestations: 1,
      hospital: 'GHOSP_CIMA_TESTNET',
      amount: 3_200_000_000,
    },
  },
};

let _claimCounter = 0x1000;

// ---------------------------------------------------------------------------
// getMember(address) → { join_date, total_contributed, active_months, is_eligible }
// ---------------------------------------------------------------------------
export async function getMember(address) {
  await wait(lat());
  const m = _db.members[address] ?? _db.members['GBXYZ_DEMO'];
  return { ...m };
}

// ---------------------------------------------------------------------------
// getPoolStatus() → { total_reserve, yield_amount, member_count, available }
// ---------------------------------------------------------------------------
export async function getPoolStatus() {
  await wait(lat());
  return { ..._db.pool };
}

// ---------------------------------------------------------------------------
// submitClaim(member, referencia, fecha_referencia, hospital, monto)
//   → { claim_id, status }
// ---------------------------------------------------------------------------
export async function submitClaim({ member, referencia, fecha_referencia, hospital, monto }) {
  await wait(lat());
  const claim_id = `clm_${(++_claimCounter).toString(16)}`;
  _db.claims[claim_id] = {
    claim_id,
    status: 'enviado',
    attestations: 0,
    hospital,
    amount: monto,
  };
  return { claim_id, status: 'enviado' };
}

// ---------------------------------------------------------------------------
// getClaimStatus(claim_id) → { status, attestations, hospital, amount }
// ---------------------------------------------------------------------------
export async function getClaimStatus(claim_id) {
  await wait(lat());
  const c = _db.claims[claim_id];
  if (!c) throw new Error(`Claim ${claim_id} no encontrado`);
  return { ...c };
}

// ---------------------------------------------------------------------------
// attestClaim(validador, claim_id, aprobar) — usado por la vista de validador
// ---------------------------------------------------------------------------
export async function attestClaim(validador, claim_id, aprobar) {
  await wait(lat());
  const c = _db.claims[claim_id];
  if (!c) throw new Error(`Claim ${claim_id} no encontrado`);
  if (!aprobar) { c.status = 'rechazado'; return { ...c }; }
  c.attestations = Math.min(2, c.attestations + 1);
  c.status = c.attestations >= 2 ? 'aprobado' : 'en_validacion';
  return { ...c };
}

// ---------------------------------------------------------------------------
// contribute(miembro, monto) — actualiza reserva del pool
// ---------------------------------------------------------------------------
export async function contribute(member, monto) {
  await wait(lat());
  const CARENCIA = 6;
  if (!_db.members[member]) _db.members[member] = { ...(_db.members['GBXYZ_DEMO']) };
  const m = _db.members[member];
  m.total_contributed += monto;
  m.active_months = Math.min(CARENCIA, m.active_months + 1);
  m.is_eligible = m.active_months >= CARENCIA;
  _db.pool.total_reserve += monto;
  _db.pool.available += monto;
  return { ok: true };
}
