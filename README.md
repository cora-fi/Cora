# Cora — Fondo mutual de salud descentralizado sobre Stellar

Fondo mutual de cobertura médica construido sobre Soroban. Los miembros aportan una prima mensual en XLM a una reserva común; el capital ocioso genera rendimiento en Blend; cuando un miembro cumple condiciones verificables de cobertura, el contrato transfiere los fondos directamente al hospital, sin intermediarios ni decisiones subjetivas.

> **Hackathon Morpho · Stellar / Soroban · Costa Rica**  
> Demo en vivo: [cora-protocol.vercel.app](https://cora-protocol.vercel.app)

---

## El problema

En Costa Rica, la atención médica pública se canaliza a través de la **CCSS** (Caja Costarricense de Seguro Social), el sistema universal de salud del país. La CCSS ofrece cobertura amplia, pero sus tiempos de espera para procedimientos no urgentes pueden durar de meses a varios años. Una persona que necesita una cirugía de rodilla, una colonoscopía o un tratamiento de especialidad puede pasar dos o tres años en una lista de espera sin opción real.

La alternativa es la atención privada, pero acceder a ella tiene barreras significativas:

- **Costo prohibitivo**: una cirugía de mediana complejidad puede costar entre $3,000 y $15,000 USD.
- **Seguros privados opacos**: los seguros de salud privados disponibles en el mercado costarricense tienen comités de aprobación internos cuyos criterios son discrecionales. El mismo expediente puede ser aprobado o rechazado dependiendo del evaluador.
- **Intermediarios**: el dinero pasa por aseguradoras, reaseguradoras, brokers y administradores de siniestros antes de llegar al hospital. Cada capa cobra.
- **Exclusiones en letra chica**: enfermedades preexistentes, períodos de carencia no transparentes, topes ocultos.

El resultado es que la mayoría de la población costarricense queda atrapada: demasiado pobre para pagar atención privada por su cuenta, pero esperando años en el sistema público.

---

## La solución

Cora propone un modelo diferente: un **fondo mutual de salud descentralizado y paramétrico** sobre Stellar/Soroban.

Los miembros aportan **18 XLM al mes** a un contrato inteligente que actúa como tesorería colectiva. El capital que no se necesita de inmediato se deposita en Blend para generar rendimiento. Cuando un miembro cumple dos condiciones verificables —llevar suficiente tiempo en la lista de espera de la CCSS y haber aportado durante el período de carencia mínimo—, puede solicitar co-pago. Tres validadores revisan el caso; con dos aprobaciones, el contrato verifica los parámetros objetivos y transfiere los fondos directamente al hospital.

El modelo es mutual porque el riesgo es colectivo. Es descentralizado porque no hay una empresa en el medio. Es paramétrico porque el pago se basa en hechos verificables, no en juicios.

---

## Qué hace diferente a Cora

### 1. Disparador paramétrico y verificable

En los seguros tradicionales, la decisión de pagar la toma una persona (o un comité) evaluando un expediente. En Cora, el pago lo ejecuta un contrato cuando se cumplen dos condiciones objetivas codificadas en `execute_claim`:

```rust
// (a) El miembro sigue siendo activo
if info.active_months < meses_carencia { return Err(Error::TriggerNotMet); }

// (b) Lleva al menos 90 días en lista de espera de la CCSS
let now = env.ledger().timestamp();
if now < claim.fecha_referencia.saturating_add(DIAS_LISTA_REQUERIDOS) {
    return Err(Error::TriggerNotMet);
}
```

Donde `meses_carencia = 6` y `DIAS_LISTA_REQUERIDOS = 90 * 24 * 60 * 60`. El `fecha_referencia` es el timestamp Unix (en segundos) de cuándo el miembro ingresó a la lista de espera de la CCSS, registrado en `submit_claim` y verificado on-chain contra el ledger clock de Stellar.

Si las condiciones se cumplen, la transacción procede. Si no, falla con `TriggerNotMet`. No hay excepción, no hay apelación, no hay criterio subjetivo.

### 2. El dinero nunca llega al usuario

La función `execute_claim` transfiere los fondos **directamente desde el contrato del pool al hospital**:

```rust
token::Client::new(&env, &token_id)
    .transfer(&env.current_contract_address(), &claim.hospital, &claim.monto);
```

El `hospital` es una dirección Stellar de una **whitelist cerrada** registrada en el contrato durante `init`. Para que un hospital esté en la red de Cora, su dirección debe haber sido incluida explícitamente por el admin en la inicialización:

```rust
s.set(&DataKey::Hospitals, &hospitales);
```

`submit_claim` verifica que el hospital elegido esté en esta lista:

```rust
if !addr_in_vec(&hospitals, &hospital) { return Err(Error::HospitalNotInList); }
```

Esto elimina la posibilidad de fraude en la reclamación: el miembro no puede dirigir los fondos a una cuenta propia ni a un hospital no verificado. El flujo es **pool → hospital registrado**, sin pasos intermedios.

### 3. Validación multisig 2 de 3

El proceso de aprobación reemplaza el comité de evaluación con tres validadores registrados en el contrato. Se necesitan exactamente 2 aprobaciones para que el contrato cambie el status del claim de `Pending` a `Approved`:

```rust
claim.attestations.push_back(validador);
if claim.attestations.len() >= ATTESTATIONS_REQUIRED { // ATTESTATIONS_REQUIRED = 2
    claim.status = ClaimStatus::Approved;
}
```

`attest_claim` verifica que:
- El votante esté en la lista de validadores registrados (rechaza con `NotAValidator`)
- El votante no haya votado antes en el mismo claim (rechaza con `AlreadyAttested`)

Si un validador vota en contra (`aprobar = false`), el claim pasa inmediatamente a `Rejected` sin posibilidad de revisión. Todo el proceso es auditable on-chain: cualquiera puede ver qué validador votó qué en qué momento.

En el frontend, cuando el usuario con rol validador hace clic en "Aprobar", `attestClaim()` en `contract-service.js` lee primero el número de aprobaciones actuales del claim, elige el validador demo correspondiente por índice (`DEMO_VALIDATORS[attestations_count]`), y firma la transacción con esa clave. Cuando se alcanza la segunda aprobación y el status cambia a `Approved`, `attestClaim()` llama automáticamente a `execute_claim()` en la misma operación.

### 4. Yield sobre la reserva ociosa

No todo el capital del pool necesita estar líquido en todo momento. El admin puede depositar parte de la reserva en Blend, que devuelve rendimiento. El contrato implementa `deposit_to_yield` y `withdraw_from_yield` como cross-contract calls:

```rust
// Pool llama a Blend
let pool_addr = env.current_contract_address();
BlendMockClient::new(&env, &blend_addr).deposit(&pool_addr, &monto);
s.set(&DataKey::YieldDeposited, &(yield_dep + monto));
```

El contrato mantiene contabilidad separada: `TotalReserve` (valor contable total) y `YieldDeposited` (cuánto está en Blend). El campo `available` del pool status se calcula como `total_reserve - yield_deposited`.

Cuando se retira de Blend, el interés generado (`received - monto`) se acredita a la reserva total:

```rust
let interest = received.saturating_sub(monto);
s.set(&DataKey::TotalReserve, &(reserve + interest));
```

El contrato Blend Mock simula un **0.5% de rendimiento fijo** sobre cada retiro (`monto / 200`). La arquitectura es intercambiable: para conectar Blend real en testnet o mainnet basta con cambiar la dirección pasada a `init()`. El contrato del pool no tiene ninguna dependencia en el bytecode de Blend Mock; solo requiere que el contrato externo implemente `deposit(from, monto)` y `withdraw(to, monto) → i128`.

### 5. Onboarding sin fricción

La barrera de entrada para usuarios sin experiencia cripto es real. Cora la resuelve en dos capas:

**Privy para autenticación**: el usuario se registra con email, SMS, Google o passkey. Privy no crea una wallet EVM como en el caso de otras dApps; para Stellar, Cora genera un **keypair ED25519 aleatorio** en el primer login y lo persiste en `localStorage` indexado por el `user.id` de Privy:

```javascript
async function _getOrCreateKeypair(userId) {
  const { Keypair } = await import('@stellar/stellar-sdk');
  const key = STORAGE_PREFIX + userId; // 'cora_stellar_kp_' + userId
  const stored = localStorage.getItem(key);
  if (stored) return Keypair.fromSecret(stored);
  const kp = Keypair.random();
  localStorage.setItem(key, kp.secret());
  return kp;
}
```

El resultado es que el usuario tiene una dirección Stellar pública consistente entre sesiones sin haber visto nunca una seed phrase.

**Freighter como fallback**: usuarios con Freighter instalado pueden conectarse directamente con su wallet Stellar existente. El servicio detecta la extensión con un retry de 600 ms (tiempo para que la extensión se inyecte en el DOM), verifica que esté configurada en Testnet antes de pedir acceso, y usa `signTransaction` de la API v6 para firmar.

**`wallet-service.js` como capa de abstracción**: el resto del frontend nunca sabe si el usuario está conectado con Privy o Freighter. Ambos implementan la misma interfaz:

```javascript
connect(provider, privyUser?) → Promise<{ address }>
disconnect()
isConnected()                 → boolean
getAddress()                  → string | null
signTransaction(xdr)          → Promise<string>
```

---

## Arquitectura técnica

```
Usuario
  │
  ▼
┌─────────────────────────────────────────────────────┐
│ Frontend (React + Vite, Vercel)                     │
│                                                     │
│  app.jsx ──── PrivyAuthWatcher ──── Privy SDK       │
│      │                                              │
│      ├── screens/ (Dashboard, Aportar, Solicitar,   │
│      │           Solicitudes, Validador, Fondo...)  │
│      │                                              │
│      └── services/                                  │
│           ├── wallet-service.js (Privy | Freighter) │
│           ├── contract-service.js ──── Soroban RPC  │
│           └── mock-service.js (desarrollo sin red)  │
└─────────────────────────────────────────────────────┘
              │
              │ @stellar/stellar-sdk v15
              │ Soroban RPC (simulate + sendTransaction)
              ▼
┌─────────────────────────────────────────────────────┐
│ Stellar Testnet                                     │
│                                                     │
│  PoolContract ────────────── BlendMock              │
│  (pool, claims, yield)       (deposit/withdraw)     │
│         │                                           │
│         └── XLM SAC (token nativo)                  │
└─────────────────────────────────────────────────────┘
```

### Patrón mock-service → contract-service

Ambos servicios exponen funciones con **exactamente la misma firma** (`getMember`, `getPoolStatus`, `contribute`, `submitClaim`, etc.). Durante el desarrollo, los componentes importan de `mock-service.js` y trabajan contra datos en memoria con latencia simulada (600-1000 ms). Cuando los contratos estaban listos, bastó con actualizar todos los imports a `contract-service.js` sin tocar ningún componente.

### Cómo `contract-service.js` invoca contratos

Las llamadas de solo lectura (simulaciones) nunca se firman:

```javascript
async function _simulate(op, sourceAddress) {
  const acc = await _getAccount(sourceAddress ?? READ_SOURCE);
  const tx  = new TransactionBuilder(acc, { fee: '100', networkPassphrase: NET })
    .addOperation(op).setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  return { sim, retval: scValToNative(sim.result.retval) };
}
```

Las llamadas de escritura siguen el flujo completo de Soroban:

```
build tx → simulateTransaction (footprint + auth) → assembleTransaction → signTransaction → sendTransaction → poll getTransaction
```

La función `_invoke` hace este ciclo completo y espera confirmación con polling cada 2 segundos hasta 30 segundos de timeout. `_invokeWithKp` hace lo mismo pero firma con un `Keypair` local (para los validadores demo en testnet).

Para `submitClaim`, el servicio **simula primero** para capturar el `claim_id` retornado por el contrato, luego invoca la transacción real:

```javascript
const { retval: claimIdRaw } = await _simulate(op, address);
const claim_id = Number(claimIdRaw ?? 0) || (Date.now() % 100000);
await _invoke(op, address);
```

### Historial local (localStorage)

El contrato no almacena un índice de contribuciones por miembro ni una lista de claims por dirección. El historial de aportes y los IDs de claims se guardan en `localStorage` tras cada operación exitosa:

- `cora_c_${address}` → array de contribuciones `{ id, date, amount, status }`
- `cora_q_${address}` → array de claim IDs `[1, 3, 7, ...]`

`getClaims(address)` lee los IDs del localStorage y llama `get_claim(id)` por cada uno al contrato.

Para el validador, `getPendingClaims()` ignora el localStorage completamente y escanea el contrato directamente, iterando desde `id=1` hasta recibir `ClaimNotFound` (error #7):

```javascript
for (let id = 1; id <= 200; id++) {
  try {
    const claim = await getClaimStatus(id);
    if (claim.status === 'enviado' || claim.status === 'en_validacion') pending.push(claim);
  } catch (e) {
    if (e.message.includes('#7') || ...) break; // no hay más claims
  }
}
```

---

## Stack tecnológico

| Herramienta | Versión | Para qué se usa | Por qué se eligió |
|---|---|---|---|
| Soroban SDK (Rust) | 22 | Compilar contratos Stellar | Único SDK oficial para Soroban |
| `@stellar/stellar-sdk` | 15.1.0 | Construir, simular y enviar transacciones | API completa para Soroban RPC |
| React | 18.3.1 | UI del dashboard | Componentes reutilizables, ecosistema maduro |
| Vite | 5.4.2 | Bundler del frontend | Soporte a ESM, dev server rápido |
| `@privy-io/react-auth` | 3.29.1 | Auth sin seed phrase (email/Google/passkey) | Único proveedor de auth que soporta Stellar EOA sin EVM |
| `@stellar/freighter-api` | 6.0.1 | Firma de transacciones Soroban desde extensión | Wallet Stellar estándar de facto para dApps |
| `buffer` | 6.0.3 | Polyfill Node.js para el browser | stellar-sdk requiere `Buffer` que no existe en browser |
| Vercel | — | Hosting del frontend | Deploy automático desde GitHub, CDN global |

---

## Contratos desplegados en testnet

| Contrato | Dirección |
|---|---|
| Pool principal | `CCNJFLHICHXBCRYFKXDWCYLOLSWB66JHUYD53ZIUZCPJYW3NN23KQDUO` |
| Blend mock | `CBAMMQTGJDACUIPZN442RRRB5SUN2LZIFX72XDHHWCGQK3JOFBRLHVPW` |
| XLM SAC (token) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

### Hospitales registrados

| Hospital | Ciudad | Dirección en testnet |
|---|---|---|
| Clínica Bíblica | San José | `GBINZTDEB3CMME4JJQ4NPBVG7E7ADL7PGSFUOXHLUGENP36QDVO4TY5K` |
| Hospital CIMA | Escazú | `GAF2KFP6RNQIJSLX7ZGSURKXBYF5SW3XZTEXOAGDBLHE3RBJKRO3T7UC` |
| Hospital Metropolitano | San José | `GC6V72M2OPU5M3XDSJG22UWFDUT265AIDBHF3LRBSE2VFN6AOXMIOIWO` |
| Hospital Clínica Católica | Guadalupe | `GC4M6WOT3WTMGECPPZYUSCOYK3NIJV55IGVVSMCRWR2YTU5E7E35HWA4` |

---

## Interfaz del contrato

### `init(admin, token_usdc, techo_cobertura, meses_carencia, validadores, hospitales, yield_contract)`

Inicializa el contrato. Solo puede llamarse una vez (verifica `DataKey::Initialized`). Registra todos los parámetros configurables en instance storage: admin, token, techo de cobertura, período de carencia, lista de validadores y hospitales autorizados, y dirección del contrato de yield.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `admin` | `Address` | Dirección con permisos para `deposit_to_yield`, `withdraw_from_yield` |
| `token_usdc` | `Address` | SAC del token de pago (XLM en testnet) |
| `techo_cobertura` | `i128` | Monto máximo por evento en stroops |
| `meses_carencia` | `u32` | Meses de aporte requeridos antes de poder reclamar |
| `validadores` | `Vec<Address>` | Exactamente 3 direcciones autorizadas para `attest_claim` |
| `hospitales` | `Vec<Address>` | Whitelist de hospitales que pueden recibir transferencias |
| `yield_contract` | `Address` | Contrato de Blend (mock o real) |

### `join(miembro: Address) → Result<(), Error>`

Registra una nueva dirección como miembro. Crea un `MemberInfo` con `join_date = env.ledger().timestamp()`, `active_months = 0`, `is_eligible = false`. Incrementa `MemberCount`. Falla con `MemberAlreadyExists` si la dirección ya está registrada.

### `contribute(miembro: Address, monto: i128) → Result<(), Error>`

Transfiere `monto` en stroops desde el miembro al contrato vía `token::Client::transfer`. Incrementa `active_months` en 1 y calcula `is_eligible = active_months >= meses_carencia`. Actualiza `TotalReserve`. Requiere auth del miembro.

### `get_member(miembro: Address) → Result<MemberInfo, Error>`

| Campo | Tipo | Descripción |
|---|---|---|
| `join_date` | `u64` | Unix timestamp (segundos) de inscripción |
| `total_contributed` | `i128` | Total aportado en stroops |
| `active_months` | `u32` | Cantidad de aportes realizados |
| `is_eligible` | `bool` | `active_months >= meses_carencia` |

### `get_pool_status(env: Env) → PoolStatus`

| Campo | Tipo | Descripción |
|---|---|---|
| `total_reserve` | `i128` | Suma de todos los aportes + intereses acreditados |
| `yield_amount` | `i128` | Monto actualmente depositado en Blend |
| `member_count` | `u32` | Total de miembros registrados |
| `available` | `i128` | `total_reserve - yield_amount` |

### `submit_claim(miembro, referencia, fecha_referencia, hospital, monto) → Result<u32, Error>`

Crea una solicitud de cobertura. Verifica que el miembro sea elegible y que el hospital esté en la whitelist. Almacena el claim con `ClaimStatus::Pending` y retorna el `claim_id` autoincremental. `referencia` es el número de constancia de lista de espera de la CCSS. `fecha_referencia` es el timestamp Unix del ingreso a la lista.

### `attest_claim(validador, claim_id, aprobar: bool) → Result<ClaimStatus, Error>`

El validador vota. Con `aprobar = false`, el claim pasa directamente a `Rejected`. Con `aprobar = true`, se agrega la dirección del validador al array `attestations`. Cuando `attestations.len() >= 2`, el status cambia a `Approved`. Falla con `NotAValidator`, `AlreadyAttested` o `ClaimNotFound` según corresponda.

### `execute_claim(claim_id: u32) → Result<(), Error>`

Ejecuta un claim con status `Approved`. Verifica el disparador paramétrico (ver más arriba). Si se cumplen las condiciones, transfiere `claim.monto` desde el contrato al hospital y cambia el status a `Executed`. Cualquiera puede llamar esta función (no requiere auth específico).

### `deposit_to_yield(monto: i128) → Result<(), Error>`

Solo admin. Deposita `monto` en el contrato de Blend via cross-contract call. Incrementa `YieldDeposited`. El `monto` no puede superar `total_reserve - yield_deposited`.

### `withdraw_from_yield(monto: i128) → Result<i128, Error>`

Solo admin. Retira `monto` de Blend. El monto recibido incluye intereses (`received >= monto`). La diferencia se acredita a `TotalReserve`. Retorna el monto efectivamente recibido.

### `get_claim(claim_id: u32) → Result<Claim, Error>`

Devuelve el claim completo: `claim_id`, `miembro`, `referencia`, `fecha_referencia`, `hospital`, `monto`, `status`, `attestations: Vec<Address>`.

---

## Flujo completo paso a paso

### Onboarding

1. El usuario abre la app en Vercel. Si `VITE_PRIVY_APP_ID` está configurado, `main.jsx` envuelve la app con `PrivyProvider`. Si no, el onboarding usa flujo mock.
2. El usuario hace clic en "Entrar al fondo" → Privy abre su modal de autenticación (email/SMS/Google/passkey).
3. Privy autentica al usuario y establece `authenticated: true` con el objeto `user`.
4. `PrivyAuthWatcher` en `app.jsx` detecta el cambio y llama `handlePrivyAuth(user, logout)`.
5. `wallet-service.connect('privy', user)` genera o recupera el keypair ED25519 del usuario desde `localStorage` y retorna la dirección Stellar pública.
6. `contract-service.getMember(address)` llama `get_member` vía simulación Soroban.
   - Si el contrato devuelve `Error(Contract, #3)` (MemberNotFound) → `{ isNewMember: true }`.
   - Si encuentra al miembro → retorna sus datos reales del ledger.
7. Si `isNewMember: true`, el Dashboard muestra `JoinCard` con el botón "Unirme al fondo".

### Unirse al fondo

8. Usuario hace clic en "Unirme al fondo" → `join(address)` en `contract-service.js`.
9. Se construye la transacción, se simula, se ensambla con footprint, se firma (Freighter popup o Privy pendiente), se envía y se espera confirmación.
10. El contrato ejecuta `join()` → crea `MemberInfo` con `join_date = ledger.timestamp()`.
11. `getMember(address)` se llama nuevamente → ahora retorna `{ active_months: 0, is_eligible: false, isNewMember: false }`.

### Aportar

12. Usuario va a "Aportar" → elige monto (por defecto 18 XLM) → confirma.
13. `contribute(address, 18)` construye la operación con `nativeToScVal(180000000n, { type: 'i128' })` (18 × 10^7 stroops).
14. El contrato transfiere 18 XLM del usuario al pool y actualiza `active_months += 1`.
15. Tras 6 aportes, `is_eligible = true`.
16. El historial queda en `localStorage` bajo `cora_c_${address}`.

### Solicitar ayuda

17. Con `is_eligible = true`, el usuario accede a "Solicitar ayuda".
18. Llena el formulario: referencia CCSS, fecha de ingreso a la lista, hospital y monto.
19. `submitClaim` simula primero para capturar el `claim_id` retornado, luego envía la transacción firmada.
20. El contrato verifica elegibilidad y que el hospital esté en la whitelist → crea el claim con `ClaimStatus::Pending`.
21. El `claim_id` se guarda en `localStorage` bajo `cora_q_${address}`.

### Validación

22. Un usuario con rol validador activa el toggle en la sidebar → accede a "Bandeja de validación".
23. `getPendingClaims()` escanea el contrato desde `id=1` hasta `ClaimNotFound`.
24. El validador hace clic en "Aprobar" en un caso:
    - `attestClaim` lee `getClaimStatus(claim_id)` → sabe que `attestations = 0` → usa `DEMO_VALIDATORS[0]`.
    - Firma y envía `attest_claim(validator_1, claim_id, true)`.
    - `attest_claim` agrega `validator_1` al array `attestations` del claim.
    - `attestations.len() = 1 < 2` → status sigue en `Pending`.
25. El validador aprueba por segunda vez:
    - `attestClaim` lee `attestations = 1` → usa `DEMO_VALIDATORS[1]`.
    - `attest_claim(validator_2, claim_id, true)` → `attestations.len() = 2 >= 2` → status = `Approved`.
    - `attestClaim` detecta `status === 'aprobado'` → llama `execute_claim(claim_id)` automáticamente.

### Ejecución y pago

26. `execute_claim` verifica el disparador paramétrico: `active_months >= 6` y `now >= fecha_referencia + 90 days`.
27. Verifica `total_reserve >= claim.monto`.
28. Ejecuta `token::transfer(pool_address, hospital_address, monto)`.
29. Actualiza `TotalReserve -= monto` y cambia status a `Executed`.
30. En "Mis solicitudes", el miembro ve el claim con status "Pagado al hospital" y el banner de confirmación.

---

## Decisiones de diseño y trade-offs

### XLM nativo en lugar de USDC

Para el MVP en testnet se usó el **XLM nativo** via Stellar Asset Contract (SAC) en lugar de un token USDC. La razón es práctica: el SAC del XLM nativo siempre está disponible en testnet (`Asset.native().contractId(Networks.TESTNET)`), no requiere deploy adicional y cualquier cuenta fondeada por el friendbot ya tiene XLM. Desplegar y gestionar un token USDC propio habría añadido complejidad operativa sin valor técnico diferencial para el hackathon.

En producción, el cambio es trivial: pasar la dirección del SAC de USDC a `init()`. El contrato no tiene dependencia en el tipo de token.

### Blend Mock en lugar de Blend real

`blend-mock` es un contrato mínimo que implementa `deposit`, `withdraw` (con 0.5% de retorno fijo) y `get_balance`. La arquitectura de cross-contract call en el pool es idéntica a como funcionaría con el Blend real; la única diferencia es la dirección pasada a `init()`. Esta decisión permite demostrar la mecánica de yield sin depender de la disponibilidad y configuración del Blend real en testnet.

### Techo de cobertura fijo

El techo de $4,000 XLM por evento está hardcodeado en `init()` como `techo_cobertura` y usado en el frontend para validación del formulario. En producción debería ser configurable por gobernanza. Para el MVP, un valor fijo simplifica la experiencia sin perder el concepto.

### Multisig en el contrato, no en la wallet

La validación 2-de-3 vive en el contrato del pool, no en una multisig wallet de Stellar. Esto tiene una ventaja importante: el proceso de validación es visible y auditable on-chain. Cualquiera puede llamar `get_claim(id)` y ver cuántos validadores aprobaron. Con una multisig wallet, el proceso sería opaco externamente.

### Privy para Stellar: keypair ED25519 en localStorage

Privy genera wallets EVM (secp256k1). Stellar usa ED25519. No existe conversión directa entre ambas curvas. La solución adoptada es generar un keypair ED25519 aleatorio en el primer login de Privy y almacenar el secreto en `localStorage` indexado por `user.id`. El usuario tiene su dirección Stellar derivada de su identidad Privy, persistente entre sesiones y sin seed phrase visible. La firma de transacciones Soroban se delega a Freighter (que sí maneja ED25519 nativo) hasta que Privy implemente soporte nativo para Stellar.

### Validadores demo con claves predecibles

Los tres validadores de demo para testnet se generan con `Keypair.fromRawEd25519Seed(Buffer.from(seed.padEnd(32, '\0')))`. Las seeds son strings cortos (`'cora-validator-1'`, etc.) padded con null bytes hasta 32 bytes. Las claves son predecibles, lo cual es intencional: cualquiera que clone el repo puede reproducir las mismas direcciones y ejecutar el flujo completo de validación sin coordinación externa. Esto es un anti-patrón en producción, documentado explícitamente con `// SOLO TESTNET`.

---

## Limitaciones del MVP y próximos pasos

### Limitaciones actuales

- **Oráculos off-chain**: el `fecha_referencia` es un dato que el usuario ingresa manualmente. No hay integración con la CCSS para verificar on-chain que la fecha sea real. En producción se necesitaría un oráculo que consulte la API de la CCSS o un sistema de verificación de documentos.
- **Validadores centralizados**: en el MVP, las tres claves de validador son gestionadas por el equipo. Un modelo de validación descentralizado requiere un proceso de incorporación y remoción de validadores por gobernanza.
- **Auditoría**: el contrato no ha sido auditado. Antes de manejar fondos reales requiere una auditoría de seguridad completa.
- **Firma con Privy**: actualmente los usuarios de Privy no pueden firmar transacciones Soroban directamente. Para operaciones de escritura necesitan Freighter. Privy trabaja en soporte nativo para Stellar.
- **Contribuciones y claims off-chain**: el historial de aportes y los IDs de claims se guardan en `localStorage`. Si el usuario limpia el storage, pierde acceso al historial (aunque los datos siguen en la blockchain).

### Próximos pasos para producción

1. **Integración con Blend real**: cambiar la dirección de `yield_contract` en `init()`. Requiere manejo del token de liquidez de Blend.
2. **Oráculo CCSS**: construir un oráculo que verifique la constancia de lista de espera contra la API pública de la CCSS antes de que `submit_claim` proceda.
3. **Gobernanza del fondo**: contrato de gobernanza para modificar parámetros (techo, carencia, hospitales, validadores) con votación de los miembros.
4. **Identidad de miembros**: sistema para asociar la dirección Stellar con la cédula costarricense (sin revelarla on-chain), para prevenir múltiples cuentas.
5. **Integración con USDC real**: usar Circle's USDC en Stellar para que los montos reflejen valores en dólares estables.

---

## Hallazgos técnicos relevantes

Estos son los problemas no obvios encontrados durante el desarrollo del hackathon. Se documentan porque demuestran la profundidad técnica del trabajo y pueden ser útiles para otros que construyan sobre Soroban.

### `scValToNative` devuelve enums como arrays

`ClaimStatus` es un `#[contracttype]` enum en Rust (`Pending`, `Approved`, `Executed`, `Rejected`). Al decodificar la respuesta del contrato con `scValToNative` del stellar-sdk v15, se esperaba recibir el nombre del variant como string (`'Approved'`) o como objeto (`{ tag: 'Approved' }`). Lo que devuelve en realidad es un **array de un elemento**: `['Approved']`.

La consecuencia fue que `_claimStatus` nunca detectaba un claim como aprobado porque `Object.keys(['Approved'])[0]` devuelve `'0'` (el índice numérico del array), no `'Approved'`. Los claims con 2 aprobaciones se quedaban eternamente en "En validación" y `execute_claim` nunca se llamaba, sin error visible en consola.

La corrección requiere verificar explícitamente `Array.isArray`:

```javascript
if (typeof status === 'string')   tag = status;
else if (Array.isArray(status))   tag = status[0];  // ['Approved'] → 'Approved'
else                              tag = status?.tag ?? Object.keys(status ?? {})[0];
```

### Freighter API v6: todos los retornos son objetos

Freighter v6 rompió compatibilidad con v4/v5 en múltiples puntos:

| Función | v4/v5 retornaba | v6 retorna |
|---|---|---|
| `isConnected()` | `boolean` | `{ isConnected: boolean, error? }` |
| `getPublicKey()` | `string` (address) | eliminada — usar `requestAccess()` |
| `getAddress()` | no existía | `{ address: string, error? }` |
| `signTransaction(xdr, { network })` | `string` (XDR firmado) | `{ signedTxXdr: string, signerAddress: string, error? }` |

El error clave: `const connected = await isConnected()` devuelve un objeto truthy incluso cuando `connected.isConnected === false`. Código como `if (!connected) throw ...` nunca lanzaba. El código de firma usaba `{ network: 'TESTNET' }` en vez de `{ networkPassphrase: 'Test SDF Network ; September 2015' }`, y accedía al resultado directamente en vez de `.signedTxXdr`.

Adicionalmente, v6 requiere `requestAccess()` (que abre el popup de permisos) antes de poder leer la dirección. `getAddress()` solo funciona si el permiso ya fue otorgado previamente.

### Seed padding bug en keypairs de validadores

Los validadores demo se generan con `Keypair.fromRawEd25519Seed`. La semilla tiene que ser exactamente 32 bytes. Se usó `seed.padEnd(32, X)` pero con diferentes valores de `X` en distintos archivos:

- Script de test inicial: `padEnd(32, '0')` → carácter `'0'` (ASCII 48)
- `init-contract.js` (el que realmente corrió): `padEnd(32, '\0')` → null byte (ASCII 0)

Ambas generan seeds de 32 bytes, pero **distintas**. El resultado fue que el `DEMO_VAL_KP` hardcodeado en `contract-service.js` tenía como public key `GDIXCN3R...`, mientras que los validadores registrados en el contrato eran `GDQ4R67D...`, `GCW4FFQD...`, `GD5HZQDC...`. `attest_claim` fallaba silenciosamente con `NotAValidator` porque el keypair no estaba en la whitelist del contrato.

La corrección fue mover los secretos a variables de entorno (`VITE_VALIDATOR_1_SECRET`, etc.) con los valores correctos derivados de `'\0'` padding, y exponer el error en vez de silenciarlo en el catch.

### `wasm-opt` requiere `--enable-bulk-memory` para `soroban_sdk::String`

Al compilar el contrato con `soroban-sdk = "22"` y usar `soroban_sdk::String` para el campo `referencia` del claim, el paso de optimización `wasm-opt` fallaba. La solución es pasar el flag `--enable-bulk-memory` a `wasm-opt` durante el build. Esto afecta a cualquier contrato Soroban que use operaciones de copia de memoria en bulk, que `String` utiliza internamente.

---

## Cómo correr el proyecto localmente

### Requisitos

- Node.js 18+
- Rust 1.75+ con `wasm32-unknown-unknown` target
- `soroban-cli` (opcional, para inspeccionar contratos)

### Frontend

```bash
git clone https://github.com/cora-fi/Cora.git
cd Cora/frontend
npm install

# Variables de entorno
cp .env.example .env
# Editar .env: solo es necesario VITE_PRIVY_APP_ID para auth real
# Las demás variables ya tienen los valores del testnet desplegado

npm run dev
# http://localhost:5173/app.html
```

Sin `VITE_PRIVY_APP_ID`, el onboarding usa el flujo mock (sin Privy): el usuario puede ingresar cualquier email y accede a datos del mock-service.

### Contrato (solo para desarrollo local)

```bash
cd Cora/contracts/pool
cargo test                    # tests unitarios
cargo build --target wasm32-unknown-unknown --release  # compila el WASM
```

### Inicializar el contrato en testnet (ya corrido, no es necesario repetir)

```bash
cd Cora/scripts
# Requiere scripts/.env con ADMIN_SECRET y POOL_CONTRACT_ADDRESS
node init-contract.js
```

El script fondea las cuentas de hospitales y validadores vía friendbot, luego llama `init()` en el pool con los parámetros configurados. Solo es necesario si se deploya un nuevo contrato.

---

## Variables de entorno

Todas van en `frontend/.env` (copiar de `frontend/.env.example`):

| Variable | Ejemplo | Descripción |
|---|---|---|
| `VITE_PRIVY_APP_ID` | `clxxxxxxxxxx...` | App ID de [dashboard.privy.io](https://dashboard.privy.io). Sin este valor el onboarding usa flujo mock. |
| `VITE_POOL_CONTRACT_ADDRESS` | `CCNJFLHI...` | Dirección del contrato del pool en testnet. |
| `VITE_BLEND_MOCK_ADDRESS` | `CBAMMQTG...` | Dirección del contrato Blend mock. |
| `VITE_TOKEN_CONTRACT_ADDRESS` | `CDLZFC3S...` | SAC de XLM nativo (Stellar Asset Contract). |
| `VITE_STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | RPC de Soroban. El default apunta a testnet. |
| `VITE_HOSPITAL_1` | `GBINZTDE...` | Dirección del hospital 1 (Clínica Bíblica, San José). |
| `VITE_HOSPITAL_2` | `GAF2KFP6...` | Hospital 2 (Hospital CIMA, Escazú). |
| `VITE_HOSPITAL_3` | `GC6V72M2...` | Hospital 3 (Hospital Metropolitano, San José). |
| `VITE_HOSPITAL_4` | `GC4M6WOT...` | Hospital 4 (Hospital Clínica Católica, Guadalupe). |
| `VITE_VALIDATOR_1_SECRET` | `SBRW64TB...TR4` | Clave secreta del validador demo 1. **Solo testnet.** |
| `VITE_VALIDATOR_2_SECRET` | `SBRW64TB...G6C` | Clave secreta del validador demo 2. **Solo testnet.** |
| `VITE_VALIDATOR_3_SECRET` | `SBRW64TB...A6OS` | Clave secreta del validador demo 3. **Solo testnet.** |

Para Vercel: configurar las mismas variables en **Settings → Environment Variables** y hacer redeploy.

---

## Estructura del repositorio

```
Cora/
│
├── README.md
│
├── frontend/                          React app — Vite
│   ├── src/
│   │   ├── app.jsx                    Router principal, auth state, PrivyAuthWatcher
│   │   ├── main.jsx                   Entry point, PrivyProvider condicional, Buffer polyfill
│   │   ├── config.js                  Direcciones de contratos y parámetros del producto
│   │   ├── shell.jsx                  Sidebar, BottomBar, MobileHeader
│   │   ├── components.jsx             Design system (Card, Button, Badge, Money, etc.)
│   │   ├── hooks.jsx                  useAsync — hook genérico para llamadas asíncronas
│   │   ├── services/
│   │   │   ├── contract-service.js    Capa de datos real — invoca contratos Soroban
│   │   │   ├── wallet-service.js      Abstracción Privy / Freighter
│   │   │   └── mock-service.js        Implementación en memoria para desarrollo sin red
│   │   └── screens/
│   │       ├── Dashboard.jsx          Vista principal: cobertura, carencia, estado del fondo
│   │       ├── Aportar.jsx            Formulario de contribución + historial
│   │       ├── Cobertura.jsx          Elegibilidad, condiciones y red de hospitales
│   │       ├── Solicitar.jsx          Formulario de claim + ClaimTimeline component
│   │       ├── Solicitudes.jsx        Historial de claims del usuario
│   │       ├── Validador.jsx          Bandeja de validación — `getPendingClaims()`
│   │       ├── Fondo.jsx              Transparencia: reserva, composición, yield
│   │       └── Onboarding.jsx         Login con Privy / Freighter
│   ├── .env.example                   Plantilla de variables de entorno
│   ├── package.json
│   └── vite.config.js                 Buffer polyfill config para stellar-sdk
│
├── contracts/
│   ├── Cargo.toml                     Workspace — pool + blend-mock
│   ├── pool/
│   │   ├── Cargo.toml                 soroban-sdk = "22", blend-mock como dependencia local
│   │   └── src/lib.rs                 Contrato del pool: join, contribute, claims, yield
│   └── blend-mock/
│       ├── Cargo.toml
│       └── src/lib.rs                 Simulador de Blend: deposit, withdraw (+0.5%), get_balance
│
└── scripts/
    ├── init-contract.js               Inicializa el pool en testnet (Node.js, correr una vez)
    ├── setup-testnet.sh               Genera cuentas admin/validadores y token USDC en testnet
    ├── .env                           Claves reales (en .gitignore)
    └── .env.example                   Plantilla con los valores del testnet desplegado
```
