#!/usr/bin/env node
/**
 * init-contract.js — inicializa el contrato del pool en Stellar Testnet.
 *
 * Uso (una sola vez):
 *   cd scripts && node init-contract.js
 *
 * Requiere: scripts/.env con ADMIN_SECRET y POOL_CONTRACT_ADDRESS.
 * Usa XLM nativo como token de prueba (SAC siempre disponible en testnet).
 */

const path  = require('path');
const fs    = require('fs');

// Cargar .env del directorio scripts
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('No se encontró scripts/.env — copiá .env.example y completá los valores.');
  process.exit(1);
}
require('fs').readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#') && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
});

const {
  Keypair, rpc, Networks, Asset, Address,
  TransactionBuilder, nativeToScVal, xdr, Contract,
} = require('../frontend/node_modules/@stellar/stellar-sdk');

// -----------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------
const ADMIN_SECRET    = process.env.ADMIN_SECRET;
const POOL_CONTRACT   = process.env.POOL_CONTRACT_ADDRESS;
const BLEND_MOCK      = process.env.BLEND_MOCK_ADDRESS;
const RPC_URL         = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASS    = Networks.TESTNET;
const STROOPS         = 10_000_000n;           // 1 token = 10^7 stroops

if (!ADMIN_SECRET || !POOL_CONTRACT || !BLEND_MOCK) {
  console.error('Faltan variables: ADMIN_SECRET, POOL_CONTRACT_ADDRESS, BLEND_MOCK_ADDRESS');
  process.exit(1);
}

const adminKp  = Keypair.fromSecret(ADMIN_SECRET);
const server   = new rpc.Server(RPC_URL);

// XLM native SAC (siempre disponible en testnet)
const XLM_SAC = Asset.native().contractId(Networks.TESTNET);

// Direcciones deterministas para hospitales y validadores (seeds fijas → addresses conocidas)
function kpFromSeed(seed) {
  return Keypair.fromRawEd25519Seed(Buffer.from(seed.padEnd(32, '\0')));
}

const hospitals = [
  { id: 'hsp_bib',   nombre: 'Clínica Bíblica',          ciudad: 'San José',  kp: kpFromSeed('cora-hospital-1') },
  { id: 'hsp_cima',  nombre: 'Hospital CIMA',             ciudad: 'Escazú',    kp: kpFromSeed('cora-hospital-2') },
  { id: 'hsp_metro', nombre: 'Hospital Metropolitano',    ciudad: 'San José',  kp: kpFromSeed('cora-hospital-3') },
  { id: 'hsp_cat',   nombre: 'Hospital Clínica Católica', ciudad: 'Guadalupe', kp: kpFromSeed('cora-hospital-4') },
];

const validators = [
  { name: 'validator-1', kp: kpFromSeed('cora-validator-1') },
  { name: 'validator-2', kp: kpFromSeed('cora-validator-2') },
  { name: 'validator-3', kp: kpFromSeed('cora-validator-3') },
];

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
async function invoke(operation, label) {
  console.log(`\n[${label}] Simulando...`);
  const acc = await server.getAccount(adminKp.publicKey());
  const tx = new TransactionBuilder(acc, { fee: '500000', networkPassphrase: NETWORK_PASS })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    console.error(`  Error simulación: ${sim.error}`);
    throw new Error(sim.error);
  }
  if (rpc.Api.isSimulationRestore(sim)) {
    console.error('  Se necesita restore — ejecutar extendFootprintTtl primero.');
    throw new Error('RestoreNeeded');
  }

  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(adminKp);
  const sendResult = await server.sendTransaction(assembled);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Send error: ${JSON.stringify(sendResult.errorResult)}`);
  }

  console.log(`  Tx hash: ${sendResult.hash}`);
  return waitForTx(sendResult.hash, label);
}

async function waitForTx(hash, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await server.getTransaction(hash);
    if (r.status === 'SUCCESS') {
      console.log(`  [${label}] ✓ Confirmado`);
      return r;
    }
    if (r.status === 'FAILED') {
      throw new Error(`Tx fallida: ${JSON.stringify(r.resultXdr)}`);
    }
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error(`Timeout esperando tx ${hash}`);
}

// -----------------------------------------------------------------------
// Fund hospital accounts via friendbot (so they can receive funds)
// -----------------------------------------------------------------------
async function fundAccount(publicKey) {
  try {
    await server.getAccount(publicKey);
    // account exists, skip
  } catch {
    console.log(`  Fondeando ${publicKey.slice(0,8)}... via friendbot`);
    await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    await new Promise(r => setTimeout(r, 2000));
  }
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
async function main() {
  console.log('=== Cora — Inicialización del Pool Contract ===');
  console.log('Pool contract :', POOL_CONTRACT);
  console.log('Admin         :', adminKp.publicKey());
  console.log('XLM SAC       :', XLM_SAC);
  console.log('Blend mock    :', BLEND_MOCK);

  // 0. Verificar si ya está inicializado
  try {
    const { Contract: SdkContract } = require('../frontend/node_modules/@stellar/stellar-sdk');
    const acc = await server.getAccount(adminKp.publicKey());
    const checkTx = new TransactionBuilder(acc, { fee: '100', networkPassphrase: NETWORK_PASS })
      .addOperation(new SdkContract(POOL_CONTRACT).call('get_pool_status'))
      .setTimeout(30)
      .build();
    const checkSim = await server.simulateTransaction(checkTx);
    if (rpc.Api.isSimulationSuccess(checkSim)) {
      // Check if there's real data (any member count > 0 OR storage not empty)
      // We'll check instance storage
      const { scValToNative } = require('../frontend/node_modules/@stellar/stellar-sdk');
      const native = scValToNative(checkSim.result.retval);
      if (Number(native.member_count) > 0) {
        console.log('\nEl contrato ya tiene miembros — puede estar ya inicializado.');
        console.log('Pool status:', native);
      }
    }
  } catch {}

  // 1. Fondear cuentas de hospitales
  console.log('\n[1/3] Fondeando cuentas de hospitales...');
  for (const h of hospitals) {
    await fundAccount(h.kp.publicKey());
    console.log(`  ${h.nombre}: ${h.kp.publicKey()}`);
  }
  for (const v of validators) {
    await fundAccount(v.kp.publicKey());
    console.log(`  ${v.name}: ${v.kp.publicKey()}`);
  }

  // 2. Llamar init
  console.log('\n[2/3] Inicializando contrato...');
  const poolContract = new Contract(POOL_CONTRACT);

  const techo   = BigInt(4000) * STROOPS;  // $4000 = 40_000_000_000 stroops
  const carencia = 6;

  const initOp = poolContract.call(
    'init',
    new Address(adminKp.publicKey()).toScVal(),                        // admin
    new Address(XLM_SAC).toScVal(),                                    // token_usdc (XLM para testnet)
    nativeToScVal(techo, { type: 'i128' }),                            // techo_cobertura
    nativeToScVal(carencia, { type: 'u32' }),                          // meses_carencia
    nativeToScVal(validators.map(v => new Address(v.kp.publicKey())), { type: 'vec', element: { type: 'address' } }),
    nativeToScVal(hospitals.map(h => new Address(h.kp.publicKey())), { type: 'vec', element: { type: 'address' } }),
    new Address(BLEND_MOCK).toScVal(),                                 // yield_contract
  );

  try {
    await invoke(initOp, 'init');
    console.log('  Contrato inicializado correctamente.');
  } catch (e) {
    if (e.message.includes('#1') || e.message.includes('AlreadyInitialized')) {
      console.log('  El contrato ya estaba inicializado (AlreadyInitialized) — continuando.');
    } else {
      throw e;
    }
  }

  // 3. Mint XLM a admin (already funded) — just report the configured state
  console.log('\n[3/3] Configuración lista.');

  // Output para copiar en .env
  const config = {
    POOL_CONTRACT_ADDRESS:  POOL_CONTRACT,
    BLEND_MOCK_ADDRESS:     BLEND_MOCK,
    XLM_SAC_ADDRESS:        XLM_SAC,
    HOSPITAL_1_ADDRESS:     hospitals[0].kp.publicKey(),
    HOSPITAL_2_ADDRESS:     hospitals[1].kp.publicKey(),
    HOSPITAL_3_ADDRESS:     hospitals[2].kp.publicKey(),
    HOSPITAL_4_ADDRESS:     hospitals[3].kp.publicKey(),
    VALIDATOR_1_ADDRESS:    validators[0].kp.publicKey(),
    VALIDATOR_2_ADDRESS:    validators[1].kp.publicKey(),
    VALIDATOR_3_ADDRESS:    validators[2].kp.publicKey(),
  };

  console.log('\n=== Copiar en frontend/.env ===');
  console.log(`VITE_POOL_CONTRACT_ADDRESS=${config.POOL_CONTRACT_ADDRESS}`);
  console.log(`VITE_BLEND_MOCK_ADDRESS=${config.BLEND_MOCK_ADDRESS}`);
  console.log(`VITE_TOKEN_CONTRACT_ADDRESS=${config.XLM_SAC_ADDRESS}`);
  console.log(`VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org`);
  console.log(`VITE_HOSPITAL_1=${config.HOSPITAL_1_ADDRESS}`);
  console.log(`VITE_HOSPITAL_2=${config.HOSPITAL_2_ADDRESS}`);
  console.log(`VITE_HOSPITAL_3=${config.HOSPITAL_3_ADDRESS}`);
  console.log(`VITE_HOSPITAL_4=${config.HOSPITAL_4_ADDRESS}`);

  console.log('\n=== Listo ===');
}

main().catch(e => {
  console.error('\nError fatal:', e.message);
  process.exit(1);
});
