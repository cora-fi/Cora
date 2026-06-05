/**
 * contract-service.js — capa de datos real que invoca los contratos Soroban.
 *
 * Misma interfaz que mock-service.js para que los componentes no cambien.
 * Token de prueba en testnet: XLM nativo (SAC siempre disponible en testnet).
 */

import { Buffer } from 'buffer';
if (typeof window !== 'undefined') window.Buffer = Buffer;

import {
  rpc as Rpc,
  Networks,
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  scValToNative,
  Keypair,
  xdr,
} from '@stellar/stellar-sdk';
import { getAddress, signTransaction } from './wallet-service';

// ---------------------------------------------------------------------------
// Configuración — toma valores del .env o usa los defaults de testnet
// ---------------------------------------------------------------------------
const POOL_CONTRACT  = import.meta.env.VITE_POOL_CONTRACT_ADDRESS
  ?? 'CCNJFLHICHXBCRYFKXDWCYLOLSWB66JHUYD53ZIUZCPJYW3NN23KQDUO';
const RPC_URL        = import.meta.env.VITE_STELLAR_RPC_URL
  ?? 'https://soroban-testnet.stellar.org';
const NET            = Networks.TESTNET;
const STROOPS        = 10_000_000n;   // 1 token = 10^7 stroops
// Cuenta pública siempre fondeada en testnet — usada para simulaciones anónimas
const READ_SOURCE    = 'GD2CLTGOWRTH4HICC2BOI7V7BHATGJPNGWVRPQF2G36IO63GSZPRIAEV';
// Validador de demo para testnet (SOLO TESTNET — no usar en mainnet)
const DEMO_VAL_KP = Keypair.fromSecret(
  import.meta.env.VITE_VALIDATOR_1_SECRET ?? 'SBRW64TBFV3GC3DJMRQXI33SFUYQAAAAAAAAAAAAAAAAAAAAAAAAATR4'
);

const server = new Rpc.Server(RPC_URL);
const poolCt = new Contract(POOL_CONTRACT);

// Hospitales de la red (direcciones de la inicialización del contrato)
const HOSPITALS = [
  { id: 'hsp_bib',   nombre: 'Clínica Bíblica',          ciudad: 'San José',
    address: import.meta.env.VITE_HOSPITAL_1 ?? 'GBINZTDEB3CMME4JJQ4NPBVG7E7ADL7PGSFUOXHLUGENP36QDVO4TY5K' },
  { id: 'hsp_cima',  nombre: 'Hospital CIMA',             ciudad: 'Escazú',
    address: import.meta.env.VITE_HOSPITAL_2 ?? 'GAF2KFP6RNQIJSLX7ZGSURKXBYF5SW3XZTEXOAGDBLHE3RBJKRO3T7UC' },
  { id: 'hsp_metro', nombre: 'Hospital Metropolitano',    ciudad: 'San José',
    address: import.meta.env.VITE_HOSPITAL_3 ?? 'GC6V72M2OPU5M3XDSJG22UWFDUT265AIDBHF3LRBSE2VFN6AOXMIOIWO' },
  { id: 'hsp_cat',   nombre: 'Hospital Clínica Católica', ciudad: 'Guadalupe',
    address: import.meta.env.VITE_HOSPITAL_4 ?? 'GC4M6WOT3WTMGECPPZYUSCOYK3NIJV55IGVVSMCRWR2YTU5E7E35HWA4' },
];

// ---------------------------------------------------------------------------
// Errores del contrato → mensajes en español
// ---------------------------------------------------------------------------
const CONTRACT_ERRORS = {
  1:  'El contrato ya fue inicializado.',
  2:  'Ya sos miembro del fondo.',
  3:  'No encontramos tu cuenta en el fondo.',
  4:  'El monto no es válido.',
  5:  'Todavía no cumpliste la carencia para solicitar ayuda.',
  6:  'Ese hospital no está en la red de Cora.',
  7:  'Solicitud no encontrada.',
  8:  'Tu dirección no es un validador registrado.',
  9:  'Ya validaste esta solicitud.',
  10: 'La solicitud no está aprobada para ejecutarse.',
  11: 'No se cumplen las condiciones paramétricas (tiempo en lista de espera).',
  12: 'Fondos insuficientes en el pool.',
  13: 'Solo el admin puede ejecutar esa acción.',
  14: 'El contrato de rendimiento no está configurado.',
};

function _parseErr(errStr) {
  const code = errStr?.match(/Error\(Contract,\s*#(\d+)\)/)?.[1];
  if (code) return CONTRACT_ERRORS[+code] ?? `Error del contrato #${code}.`;
  if (errStr?.includes('HostError')) return 'Error del contrato Soroban.';
  return errStr ?? 'Error desconocido.';
}

// ---------------------------------------------------------------------------
// Conversiones
// ---------------------------------------------------------------------------
const _toUsd  = (stroops) => Number(BigInt(stroops.toString()) / STROOPS);
const _toStr  = (stroops) => _usdToStroops(Number(stroops));
function _usdToStroops(usd) { return BigInt(Math.round(usd)) * STROOPS; }
const _tsToDate = (ts) => new Date(Number(BigInt(ts.toString())) * 1000).toISOString().slice(0, 10);
const _today    = () => new Date().toISOString().slice(0, 10);

function _claimStatus(status, attestationsArr) {
  const tag = typeof status === 'string' ? status
    : (status?.tag ?? Object.keys(status ?? {})[0] ?? 'Pending');
  if (tag === 'Approved') return 'aprobado';
  if (tag === 'Executed') return 'pagado';
  if (tag === 'Rejected') return 'rechazado';
  return (attestationsArr?.length ?? 0) > 0 ? 'en_validacion' : 'enviado';
}

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------
async function _getAccount(address) {
  try   { return await server.getAccount(address); }
  catch { return server.getAccount(READ_SOURCE); }
}

// Fondo via friendbot si la cuenta no existe (para cuentas Privy nuevas)
async function _ensureFunded(address) {
  try { await server.getAccount(address); }
  catch {
    try {
      await fetch(`https://friendbot.stellar.org?addr=${address}`);
      await new Promise(r => setTimeout(r, 3000));
    } catch { /* sin acceso a red - ignorar */ }
  }
}

// Simula una operación y devuelve { sim, retval_native }
async function _simulate(op, sourceAddress) {
  const acc = await _getAccount(sourceAddress ?? READ_SOURCE);
  const tx  = new TransactionBuilder(acc, { fee: '100', networkPassphrase: NET })
    .addOperation(op).setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (Rpc.Api.isSimulationError(sim)) throw new Error(_parseErr(sim.error));
  const retval = sim.result?.retval ? scValToNative(sim.result.retval) : null;
  return { sim, tx, retval };
}

// Simula → ensambla → firma (con wallet del usuario) → envía → espera confirmación
async function _invoke(op, signerAddress) {
  await _ensureFunded(signerAddress);
  const acc = await server.getAccount(signerAddress);
  const tx  = new TransactionBuilder(acc, { fee: '500000', networkPassphrase: NET })
    .addOperation(op).setTimeout(60).build();

  const sim = await server.simulateTransaction(tx);
  if (Rpc.Api.isSimulationError(sim)) throw new Error(_parseErr(sim.error));
  if (Rpc.Api.isSimulationRestore(sim)) throw new Error('Se necesita restore del ledger. Contactá soporte.');

  const assembled = Rpc.assembleTransaction(tx, sim).build();
  const signedXdr = await signTransaction(assembled.toXDR());
  const signedTx  = TransactionBuilder.fromXDR(signedXdr, NET);

  const send = await server.sendTransaction(signedTx);
  if (send.status === 'ERROR') throw new Error(_parseErr(JSON.stringify(send.errorResult)));

  return _waitForTx(send.hash);
}

// Igual que _invoke pero firma con un Keypair local (validador demo en testnet)
async function _invokeWithKp(op, kp) {
  await _ensureFunded(kp.publicKey());
  const acc = await server.getAccount(kp.publicKey());
  const tx  = new TransactionBuilder(acc, { fee: '500000', networkPassphrase: NET })
    .addOperation(op).setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (Rpc.Api.isSimulationError(sim)) throw new Error(_parseErr(sim.error));
  const assembled = Rpc.assembleTransaction(tx, sim).build();
  assembled.sign(kp);
  const send = await server.sendTransaction(assembled);
  if (send.status === 'ERROR') throw new Error(_parseErr(JSON.stringify(send.errorResult)));
  return _waitForTx(send.hash);
}

async function _waitForTx(hash, msTimeout = 30000) {
  const deadline = Date.now() + msTimeout;
  while (Date.now() < deadline) {
    const r = await server.getTransaction(hash);
    if (r.status === 'SUCCESS') return r;
    if (r.status === 'FAILED') throw new Error('La transacción fue rechazada por la red.');
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error('Tiempo de espera agotado (30 s). Verificá en Stellar Expert si la tx fue confirmada.');
}

// ---------------------------------------------------------------------------
// LocalStorage — historial local (contribuciones y claim IDs por dirección)
// ---------------------------------------------------------------------------
const _lsContribs = (a) => `cora_c_${a}`;
const _lsClaims   = (a) => `cora_q_${a}`;

function _loadList(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}

function _prependItem(key, item) {
  localStorage.setItem(key, JSON.stringify([item, ..._loadList(key).slice(0, 99)]));
}

function _addUnique(key, value) {
  const list = _loadList(key);
  if (!list.includes(value)) localStorage.setItem(key, JSON.stringify([value, ...list]));
}

// ---------------------------------------------------------------------------
// API pública — misma interfaz que mock-service.js
// ---------------------------------------------------------------------------

/** login() — compatibilidad con modo mock cuando Privy no está configurado */
export async function login() {
  return { address: 'GBXYZ_DEMO', nombre: 'Demo Cora', join_date: _today(),
    total_contributed: 0, active_months: 0, is_eligible: false };
}

/** getMember(address) — lee datos reales del contrato. Si no es miembro, isNewMember: true */
export async function getMember(address) {
  if (!address) return { isNewMember: true, address: '', nombre: '', join_date: '',
    total_contributed: 0, active_months: 0, is_eligible: false };
  try {
    const { retval: info } = await _simulate(
      poolCt.call('get_member', new Address(address).toScVal()), address
    );
    return {
      address,
      nombre:            'Miembro de Cora',
      join_date:         _tsToDate(info.join_date),
      total_contributed: _toUsd(info.total_contributed),
      active_months:     Number(info.active_months),
      is_eligible:       Boolean(info.is_eligible),
      isNewMember:       false,
    };
  } catch (e) {
    if (e.message.includes('#3') || e.message.includes('encontramos')) {
      return { address, nombre: 'Nuevo miembro', join_date: '', total_contributed: 0,
        active_months: 0, is_eligible: false, isNewMember: true };
    }
    throw e;
  }
}

/** getPoolStatus() — estado del fondo en tiempo real */
export async function getPoolStatus() {
  const { retval: s } = await _simulate(poolCt.call('get_pool_status'));
  const total_reserve = _toUsd(s.total_reserve);
  const yield_amount  = _toUsd(s.yield_amount);
  return {
    total_reserve,
    yield_amount,
    member_count: Number(s.member_count),
    available:    _toUsd(s.available),
    yield_placed: yield_amount,
    claims_paid:  0,
  };
}

/** getYieldStatus() — derivado del pool status */
export async function getYieldStatus() {
  const p = await getPoolStatus();
  return { yield_placed: p.yield_placed, yield_amount: p.yield_amount, apy_approx: 0 };
}

/** getHospitals() — lista estática, direcciones configuradas en init del contrato */
export async function getHospitals() {
  return HOSPITALS.map(({ id, nombre, ciudad }) => ({ id, nombre, ciudad }));
}

/** getContributions(address) — historial en localStorage */
export async function getContributions(address) {
  return _loadList(_lsContribs(address));
}

/** getClaims(address) — IDs en localStorage, datos del contrato */
export async function getClaims(address) {
  const ids = _loadList(_lsClaims(address));
  if (!ids.length) return [];
  const results = await Promise.allSettled(ids.map(getClaimStatus));
  return results.filter(r => r.status === 'fulfilled').map(r => r.value)
    .sort((a, b) => b.claim_id - a.claim_id);
}

/**
 * getPendingClaims() — escanea el contrato directamente sin depender de localStorage.
 *
 * Los claim IDs son u32 secuenciales que empiezan en 1. Itera hasta obtener
 * ClaimNotFound (error #7), lo que indica que no hay más claims. Devuelve
 * todos los que tengan status 'enviado' o 'en_validacion', sin importar
 * qué wallet los creó ni en qué sesión.
 *
 * Usado por la vista del validador para ver todas las solicitudes pendientes.
 */
export async function getPendingClaims() {
  const pending = [];
  for (let id = 1; id <= 200; id++) {   // cap de seguridad: 200 claims
    try {
      const claim = await getClaimStatus(id);
      if (claim.status === 'enviado' || claim.status === 'en_validacion') {
        pending.push(claim);
      }
    } catch (e) {
      // Error #7 = ClaimNotFound → no hay más claims, terminar el scan
      if (e.message.includes('#7') || e.message.includes('no encontrada')) break;
      // Cualquier otro error en un ID concreto: saltar y seguir
    }
  }
  return pending;
}

/** join(address) — registra al usuario como miembro (requiere firma) */
export async function join(address) {
  await _invoke(poolCt.call('join', new Address(address).toScVal()), address);
  return getMember(address);
}

/** contribute(address, monto) — aporta al fondo en XLM/USDC (requiere firma) */
export async function contribute(address, monto) {
  const montoUsd    = Number(monto);
  const montoSt     = _usdToStroops(montoUsd);
  await _invoke(
    poolCt.call('contribute', new Address(address).toScVal(), nativeToScVal(montoSt, { type: 'i128' })),
    address
  );
  const contrib = { id: `tx_${Date.now().toString(16)}`, date: _today(), amount: montoUsd, status: 'confirmado' };
  _prependItem(_lsContribs(address), contrib);
  return contrib;
}

/**
 * submitClaim({ member, referencia, fecha_referencia, hospital, monto })
 * Simula primero para obtener el claim_id, luego invoca.
 */
export async function submitClaim({ member: address, referencia, fecha_referencia, hospital: hospitalId, monto }) {
  const hosp = HOSPITALS.find(h => h.id === hospitalId);
  if (!hosp) throw new Error(`Hospital '${hospitalId}' no está en la red de Cora.`);

  const fechaTs   = BigInt(Math.floor(new Date(fecha_referencia).getTime() / 1000));
  const montoSt   = _usdToStroops(Number(monto));

  const op = poolCt.call(
    'submit_claim',
    new Address(address).toScVal(),
    nativeToScVal(referencia, { type: 'string' }),
    nativeToScVal(fechaTs, { type: 'u64' }),
    new Address(hosp.address).toScVal(),
    nativeToScVal(montoSt, { type: 'i128' })
  );

  // Simula para obtener el claim_id antes de firmar
  const { retval: claimIdRaw } = await _simulate(op, address);
  const claim_id = Number(claimIdRaw ?? 0) || (Date.now() % 100000);

  await _invoke(op, address);
  _addUnique(_lsClaims(address), claim_id);

  const days_waiting = Math.round((Date.now() - new Date(fecha_referencia).getTime()) / 86400000);
  return {
    claim_id,
    date:               _today(),
    hospital:           { id: hosp.id, nombre: hosp.nombre, ciudad: hosp.ciudad },
    amount:             Number(monto),
    days_waiting,
    referencia,
    status:             'enviado',
    attestations:       0,
    attestations_needed: 2,
  };
}

/** getClaimStatus(claim_id) — estado real del claim en el contrato */
export async function getClaimStatus(claim_id) {
  const { retval: c } = await _simulate(
    poolCt.call('get_claim', nativeToScVal(Number(claim_id), { type: 'u32' }))
  );
  const hosp = HOSPITALS.find(h => h.address === c.hospital)
    ?? { id: 'hsp_unknown', nombre: String(c.hospital).slice(0, 8) ?? '—', ciudad: '' };
  const attArr = Array.isArray(c.attestations) ? c.attestations : [];
  return {
    claim_id:            Number(c.claim_id),
    date:                _tsToDate(c.fecha_referencia),
    hospital:            { id: hosp.id, nombre: hosp.nombre, ciudad: hosp.ciudad },
    amount:              _toUsd(c.monto),
    days_waiting:        Math.round((Date.now() / 1000 - Number(BigInt(c.fecha_referencia.toString()))) / 86400),
    referencia:          String(c.referencia ?? ''),
    status:              _claimStatus(c.status, attArr),
    attestations:        attArr.length,
    attestations_needed: 2,
  };
}

/**
 * attestClaim(validador, claim_id, aprobar)
 * Siempre firma con VITE_VALIDATOR_1_SECRET (SOLO TESTNET).
 * La wallet conectada identifica al usuario en el resto de la app
 * pero no se usa para firmar attestations.
 */
export async function attestClaim(_validador, claim_id, aprobar) {
  const claimN = Number(claim_id);
  const op = poolCt.call(
    'attest_claim',
    new Address(DEMO_VAL_KP.publicKey()).toScVal(),
    nativeToScVal(claimN, { type: 'u32' }),
    nativeToScVal(Boolean(aprobar), { type: 'bool' })
  );
  await _invokeWithKp(op, DEMO_VAL_KP);
  return getClaimStatus(claimN);
}
