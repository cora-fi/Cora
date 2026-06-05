# Cora — Fondo mutual de salud descentralizado

> Hackathon Morpho · Stellar / Soroban · Costa Rica

## El problema

En Costa Rica, el acceso a atención médica privada es caro e inaccesible para la mayoría. Los seguros de salud tradicionales tienen comités de aprobación subjetivos, procesos opacos y el dinero pasa por múltiples intermediarios. La lista de espera de la CCSS (Caja Costarricense de Seguro Social) puede durar años para ciertos procedimientos.

## La solución

Cora es un fondo mutual de salud descentralizado sobre Stellar/Soroban. Los miembros aportan una prima mensual en XLM a una bolsa común. El capital ocioso genera rendimiento en Blend. Cuando un miembro cumple condiciones verificables de cobertura, el contrato libera fondos **directamente al hospital** — sin intermediarios, sin juicios subjetivos.

## Qué hace diferente a Cora

- **Disparador paramétrico**: el pago no depende de un médico evaluando un expediente. Depende de hechos verificables: tiempo en lista de espera de la CCSS + meses de aporte cumplidos. Si los números cuadran, el contrato ejecuta.
- **El dinero nunca llega al usuario**: los fondos se transfieren directamente al hospital de una lista verificada. Elimina el fraude en la reclamación.
- **Validación multisig 2 de 3**: reemplaza el comité de aprobación tradicional con un proceso transparente y auditable en blockchain.
- **Yield sobre la reserva**: el capital ocioso genera rendimiento vía Blend, haciendo el fondo más sostenible con el tiempo.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Contratos | Rust + Soroban SDK |
| Frontend | React + Vite, desplegado en Vercel |
| Auth / wallet | Privy (onboarding sin seed phrase) + Freighter (fallback) |
| Token de prueba | XLM nativo vía Stellar Asset Contract |
| Yield | Blend mock (intercambiable con Blend real cambiando una dirección) |
| SDK on-chain | `@stellar/stellar-sdk` v15 |

## Contratos desplegados en testnet

| Contrato | Dirección |
|---|---|
| Pool principal | `CCNJFLHICHXBCRYFKXDWCYLOLSWB66JHUYD53ZIUZCPJYW3NN23KQDUO` |
| Blend mock | `CBAMMQTGJDACUIPZN442RRRB5SUN2LZIFX72XDHHWCGQK3JOFBRLHVPW` |

## Flujo completo

```
1. El miembro conecta su wallet (Privy o Freighter)
2. Llama join() → queda registrado en el contrato
3. Aporta mensualmente con contribute() → XLM se transfiere al pool
4. El admin deposita parte de la reserva en Blend → genera rendimiento
5. El miembro con 6+ meses de carencia envía un claim con:
   · número de referencia de lista de espera CCSS
   · hospital de la red donde quiere atenderse
   · monto solicitado
6. 2 de 3 validadores aprueban el caso
7. execute_claim() verifica el disparador paramétrico:
   · active_months ≥ 6 (sigue siendo miembro activo)
   · fecha_referencia + 90 días ≤ ahora (tiempo real en lista)
8. Si se cumplen las condiciones, los fondos van directo al hospital
```

## Cómo correr el proyecto localmente

### Requisitos previos

- Node.js 18+
- Rust + `soroban-cli` (para compilar/testear el contrato)

### Frontend

```bash
git clone https://github.com/cora-fi/Cora.git
cd Cora/frontend
npm install

# Crear el archivo de variables de entorno
cp .env.example .env
# Editar .env y completar VITE_PRIVY_APP_ID con tu App ID de dashboard.privy.io
# Las demás variables ya tienen los valores del testnet desplegado

npm run dev
# La app corre en http://localhost:5173/app.html
```

### Contrato

```bash
cd Cora/contracts/pool
cargo test          # corre los tests unitarios

# Si necesitás re-inicializar el contrato en testnet:
cd Cora/scripts
node init-contract.js
```

## Variables de entorno

Todas van en `frontend/.env` (copiar de `frontend/.env.example`):

| Variable | Descripción |
|---|---|
| `VITE_PRIVY_APP_ID` | App ID de [dashboard.privy.io](https://dashboard.privy.io). Sin este valor la app usa el flujo mock de desarrollo. |
| `VITE_POOL_CONTRACT_ADDRESS` | Dirección del contrato del pool en testnet. |
| `VITE_BLEND_MOCK_ADDRESS` | Dirección del contrato Blend mock en testnet. |
| `VITE_TOKEN_CONTRACT_ADDRESS` | Dirección del SAC de XLM nativo (Stellar Asset Contract). |
| `VITE_STELLAR_RPC_URL` | RPC de Soroban. Default: `https://soroban-testnet.stellar.org`. |
| `VITE_HOSPITAL_1..4` | Direcciones Stellar de los hospitales registrados en el contrato. |
| `VITE_VALIDATOR_1..3_SECRET` | Claves secretas de los validadores demo. **Solo testnet — nunca en mainnet.** |

Para el deploy en Vercel, configurar las mismas variables en **Settings → Environment Variables**.

## Estructura del repositorio

```
Cora/
├── frontend/               React app (Vite)
│   ├── src/
│   │   ├── services/
│   │   │   ├── contract-service.js   capa de datos → contratos Soroban
│   │   │   ├── wallet-service.js     abstracción Privy / Freighter
│   │   │   └── mock-service.js       implementación de referencia (sin red)
│   │   ├── screens/                  vistas: Dashboard, Aportar, Solicitar, etc.
│   │   ├── app.jsx                   router principal + auth state
│   │   ├── shell.jsx                 sidebar, nav, header
│   │   └── components.jsx            design system interno
│   └── .env.example                  plantilla de variables de entorno
│
├── contracts/
│   └── pool/               Contrato Soroban en Rust
│       └── src/lib.rs      lógica del pool, claims, yield, validación
│
└── scripts/
    ├── init-contract.js    inicializa el pool en testnet (correr una vez)
    ├── setup-testnet.sh    genera cuentas y fondea en testnet
    └── .env.example        variables para los scripts de deploy
```
