# Prompt para Claude Design — Frontend de Cora

Construí el frontend de una app web llamada **CORA**: un fondo mutual de salud para la clase media costarricense. La gente aporta una cuota mensual a una bolsa común; cuando un miembro lleva demasiado tiempo en lista de espera de la CCSS, el fondo le co-paga atención en un hospital privado. El público **NO** es cripto-nativo: gente común que desconfía de lo técnico. Tono: serio, confiable y cálido a la vez — transmitir calma y respaldo, no urgencia ni "fintech fría". Idioma: español de Costa Rica, trato de "vos".

---

## Prioridad de construcción (importante)

Construí en este orden y NO lo alteres:

1. **Primero, TODO lo funcional:** el sistema de diseño, la capa de servicio (`coraService`) con sus tipos y mocks, y las 8 pantallas del app conectables al backend. Esto es lo esencial y debe quedar completo y andando antes que nada.
2. **Solo cuando lo funcional esté listo y probado**, construí la página de aterrizaje (landing) con las animaciones de scroll. La landing es un stretch opcional: si el tiempo no alcanza, se omite sin afectar el app.

Nunca sacrifiques pantallas funcionales, la capa de servicio ni la calidad del app por avanzar la landing.

---

## Dirección estética (obligatoria)

Estilo **"botica moderna / editorial cálido"**: terroso, humano, calmado, con tipografía de revista. Minimalista pero con carácter, ejecutado con precisión. NADA de aspecto genérico de IA.

**PROHIBIDO** (esto es lo que hace que algo se vea "hecho por IA"):
- Gradientes azules o morados; fondos blancos con celeste/azul.
- Glassmorphism, blur frosted, "blobs" de gradiente, hero centrado con forma abstracta.
- Fuentes Inter, Roboto, Arial, system-ui o Space Grotesk.
- Iconos genéricos por defecto en todo; exceso de pills rounded-2xl; sombras pesadas.
- Emojis. Texto de relleno tipo Lorem ipsum. Formas 3D de stock.

---

## Sistema de diseño

### Color (usar estos tokens exactos como CSS variables)

- Lienzo / fondo:        `#F3EFE6`  (papel hueso cálido)
- Superficie / tarjeta:  `#FBF8F1`
- Tinta / texto:         `#20201C`
- Texto secundario:      `#6C6557`
- Verde bosque (primario, confianza, acción principal): `#1E4A3C`
- Verde oscuro (hover/pressed):                          `#143328`
- Verde tenue (badges "activo", fondos suaves):          `#E2EAE2`
- Terracota / arcilla (acento cálido, el "corazón" de Cora, highlights, CTA secundaria): `#C25A3E`
- Arcilla tenue (tints):  `#F0DACE`
- Ámbar (detalle / estado, uso mínimo): `#D99A4E`
- Borde / hairline:      `#E3DCCD`
- Éxito `#1E4A3C` · Advertencia `#C9892B` · Error `#A93B2C`

El verde bosque domina (confianza/estabilidad); el terracota es acento de uso mínimo (un highlight, un detalle, nunca llenando pantallas); el ámbar es aún más puntual (estados/detalles).

### Tipografía (Google Fonts, gratuitas)

- Títulos y cifras grandes: **Fraunces** (pesos 400–600, optical size alto para suavidad).
- Cuerpo y UI: **Hanken Grotesk** (400/500/600).
- Montos de dinero: Hanken Grotesk con cifras tabulares (`font-feature-settings: 'tnum'`).
- IDs / hashes de transacción: **IBM Plex Mono**.

### Iconografía

**Phosphor Icons**, peso "regular", uso funcional y discreto (no decorativo).

### Profundidad y textura

Grano de papel MUY sutil sobre el lienzo (overlay de ruido a baja opacidad). Hairlines de 1px (`#E3DCCD`) en vez de sombras fuertes; sombras solo muy suaves y difusas. Radio de borde consistente de 10px. Escala de espaciado de 8px.

### Layout

Editorial, jerarquía alineada a la izquierda, asimetría intencional, espacio en blanco con ritmo. Navegación lateral persistente en desktop, barra inferior en mobile. El dashboard es el "home". Responsive y accesible (contraste AA).

### Motion dentro del app (con moderación)

Usá la librería **Motion** (Framer Motion). Una entrada escalonada al cargar el dashboard y un count-up en las cifras clave. Transiciones 150–220ms ease-out. Cero rebotes y cero animaciones por todos lados. **Dentro del app NO hay animación al hacer scroll** (eso vive solo en la landing).

### Voz / microcopy

Claro, humano y tranquilizador, en español tico, trato de "vos". NUNCA mostrar jerga cripto al usuario (nada de "wallet", "gas", "blockchain", "smart contract", "on-chain"). Usar: "tu cuenta", "aporte", "cobertura", "el fondo", "la red de hospitales". Los montos se muestran en dólares (`$`).

---

## Arquitectura funcional (crítico — el front debe conectarse fácil a un backend)

Stack: **React + TypeScript + Tailwind** (tokens de arriba como theme). Listo para `npm run dev`.

**REGLA CLAVE:** toda lectura/escritura de datos pasa por UN solo módulo `src/services/coraService.ts`, con funciones async y tipos explícitos. Hoy devuelven datos mock desde `src/services/mocks.ts`. Un flag `USE_MOCKS = true` y un único punto de cambio permiten luego enchufar el backend real (`@stellar/stellar-sdk`) SIN tocar las pantallas. Marcá cada punto de conexión con `// TODO: conectar a Soroban`. Agregá `src/config.ts` con red (testnet), y placeholders de direcciones de contrato y token USDC.

### Tipos (TypeScript) y funciones del servicio (espejo exacto del contrato)

```ts
type ClaimStatus = 'enviado' | 'en_validacion' | 'aprobado' | 'pagado' | 'rechazado';

interface Member      { id; nombre; fechaIngreso; totalAportado; mesesActivos; mesesCarencia; elegible: boolean; }
interface PoolStatus  { reservaTotal; colocadoEnRendimiento; disponible; miembros; claimsPagados; }
interface YieldStatus { colocado; rendimientoAcumulado; apyAprox; }
interface Contribution{ id; fecha; monto; estado: 'pendiente' | 'confirmado'; }
interface Hospital    { id; nombre; ciudad; }
interface Claim       { id; fecha; hospital: Hospital; montoSolicitado; diasEnLista; referencia; estado: ClaimStatus; aprobaciones: number; aprobacionesNecesarias: number; }

login(): Promise<Member>                       // mock de Privy (login por email/passkey, UI)
getMember(): Promise<Member>
getPoolStatus(): Promise<PoolStatus>
getYieldStatus(): Promise<YieldStatus>
contribute(monto: number): Promise<Contribution>
getContributions(): Promise<Contribution[]>
getHospitals(): Promise<Hospital[]>
submitClaim(input): Promise<Claim>
getClaims(): Promise<Claim[]>
attestClaim(claimId, aprobar: boolean): Promise<Claim>   // vista validador
```

Cada pantalla debe contemplar estados de loading (skeletons), vacío y error.

### Datos mock realistas (usar estos valores para que se sienta real)

- Prima mensual: **$18** · Techo de cobertura: **$4,000** por evento · Carencia: **6 meses**.
- Fondo: reservaTotal **$42,300** · colocado en rendimiento **$31,000** · disponible **$11,300** · **154** miembros · **7** claims pagados · rendimiento acumulado **$1,240** · APY aprox **6.2%**.
- Miembro actual: **4 de 6** meses de carencia (aún no elegible), **$72** aportados.
- Hospitales: Clínica Bíblica (San José), Hospital CIMA (Escazú), Hospital Metropolitano (San José), Hospital Clínica Católica (Guadalupe).
- Un claim de ejemplo: **412 días** en lista de espera CCSS, hospital CIMA, **$3,200** solicitado, estado `en_validacion`, **1 de 2** aprobaciones.

---

## Pantallas a construir

1. **Ingreso / Onboarding:** login por email o passkey (mock de Privy) + una pantalla de bienvenida que explique Cora en una frase humana ("Cuando la salud no puede esperar, la resolvemos entre todos").
2. **Dashboard (home):** cobertura activa y su techo; tu progreso de carencia (4/6 meses); próximo aporte; resumen del fondo (reserva, lo que está generando rendimiento, miembros, disponible); rendimiento del fondo. Cifras clave con count-up.
3. **Aportar:** monto, confirmación, estado de la operación, e historial de aportes.
4. **Mi cobertura:** detalle de elegibilidad (carencia, días requeridos), techo de cobertura, y la red de hospitales.
5. **Solicitar ayuda (claim):** formulario con subir referencia de lista de espera CCSS, fecha de ingreso a la lista, hospital (dropdown de la whitelist) y monto; con validaciones. Al enviar, pantalla de estado con línea de tiempo: enviado → en validación (2-de-3) → aprobado → pagado al hospital.
6. **Mis solicitudes:** lista de claims con badges de estado.
7. **El fondo / Transparencia:** vista del pool con reserva, rendimiento, miembros y claims pagados (la "transparencia" del fondo común).
8. **(Opcional, detrás de un rol) Validador:** bandeja de claims por aprobar con aprobar/rechazar.

Entregá una estructura de carpetas limpia, componentes reutilizables, tokens centralizados y el servicio de datos totalmente desacoplado de la UI.

---

## Página de aterrizaje (landing) — OPCIONAL / STRETCH

Construí, **COMO PÁGINA SEPARADA del app** (su propia ruta, ej. `/`; el app va detrás del login), una landing pública para presentar Cora. Es **OPCIONAL**: constrúila solo después de que el app funcional y la capa de servicio estén listas. NO debe importar nada del app ni modificar su código; GSAP se carga solo en la landing, no en el bundle del app.

**OBJETIVO:** enganchar emocionalmente y explicar Cora en un scroll. Es la única parte del proyecto con animación al hacer scroll.

**TÉCNICA (gratis):** usá **GSAP** con el plugin **ScrollTrigger** (en React: `npm i gsap` y registrá el plugin; o por CDN de cdnjs). SOLO reveals al hacer scroll: cada elemento entra una vez al aparecer en pantalla, con opacity 0 → 1 y un leve translateY (~24px → 0), duración ~0.6s, ease `power2.out`, y stagger en los grupos. Animá únicamente `transform` y `opacity` (rendimiento). Usá `toggleActions: 'play none none none'` (que NO se re-animen al subir).

**PROHIBIDO en la landing** (esto la satura y la vuelve frágil):
- NADA de scroll-jacking: ni pinned sections, ni scrub/scrubbing del scroll, ni scroll-snap a pantalla completa, ni hijack horizontal, ni parallax pesado. La página scrollea normal; el scroll NUNCA se siente trabado ni secuestrado.
- Respetá `prefers-reduced-motion`: si el usuario lo tiene activo, desactivá las animaciones.
- Las animaciones son mejora progresiva: el contenido debe ser legible aunque no carguen. Debe ir fluida en celulares modestos.

**DISEÑO:** mismos tokens y tipografías que el app (fondo papel `#F3EFE6`, verde bosque `#1E4A3C`, terracota `#C25A3E`, Fraunces para títulos y cifras, Hanken Grotesk para el cuerpo). Editorial, mucho aire, tipografía grande, tono serio-cálido. Español de Costa Rica, trato de "vos", sin jerga cripto.

**ARCO NARRATIVO** (secciones, en este orden, cada una revelándose al scroll):
1. **Hero:** la marca "Cora" + promesa en una línea ("Cuando la salud no puede esperar, la resolvemos entre todos") + botón principal ("Conocé Cora" / "Quiero unirme"). Entrada calmada.
2. **El problema (el golpe):** tres cifras reales de la CCSS que aparecen una por una al scrollear, con los números grandes en Fraunces y count-up al entrar en pantalla:
   - 1.253.790 personas esperando atención
   - 567 días en promedio para ver a un especialista
   - 430 días en promedio para una cirugía
3. **La brecha:** una línea corta — la clase media atrapada entre una Caja lenta y un hospital privado impagable (una cirugía privada cuesta ₡5–15 millones, 2 a 3 años de salario).
4. **Cómo funciona Cora:** tres pasos simples que se revelan en secuencia, en lenguaje llano: "Aportás una cuota mensual" → "El fondo común crece entre todos" → "Cuando te toca, Cora co-paga tu atención en un hospital privado". Sin tecnicismos.
5. **Confianza / transparencia:** una línea sobre el fondo común y transparente (metáfora del latido: el corazón bombea a donde el cuerpo lo necesita; Cora lleva el fondo a quien le toca).
6. **Cierre:** frase fuerte ("Salí de la fila. Entre todos.") + botón de CTA hacia el ingreso al app.

Entregá la landing como página/ruta independiente, con su propio componente, sin acoplarse al app.
