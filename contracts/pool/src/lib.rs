#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token,
    Address, Env, String, Vec,
};

// ============================================================
// Tipos de retorno
// ============================================================

#[contracttype]
#[derive(Clone)]
pub struct MemberInfo {
    pub join_date:         u64,
    pub total_contributed: i128,
    pub active_months:     u32,
    pub is_eligible:       bool,
}

#[contracttype]
#[derive(Clone)]
pub struct PoolStatus {
    pub total_reserve: i128,
    pub yield_amount:  i128,
    pub member_count:  u32,
    pub available:     i128,
}

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum ClaimStatus {
    Pending,
    Approved,
    Executed,
    Rejected,
}

#[contracttype]
#[derive(Clone)]
pub struct Claim {
    pub claim_id:         u32,
    pub miembro:          Address,
    pub referencia:       String,  // número de lista CCSS
    pub fecha_referencia: u64,     // timestamp: cuándo entró a la lista
    pub hospital:         Address,
    pub monto:            i128,
    pub status:           ClaimStatus,
    pub attestations:     Vec<Address>, // validadores que aprobaron
}

// ============================================================
// Almacenamiento
// ============================================================

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    TokenUsdc,
    TechoCobertura,
    MesesCarencia,
    Validadores,
    Hospitals,      // Vec<Address> de hospitales en whitelist
    Initialized,
    Member(Address),
    MemberCount,
    TotalReserve,
    ClaimEntry(u32), // Claim almacenado por ID
    ClaimCount,      // auto-incremento de IDs
}

// ============================================================
// Errores
// ============================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // Fase 2 — pool
    AlreadyInitialized  = 1,
    MemberAlreadyExists = 2,
    MemberNotFound      = 3,
    InvalidAmount       = 4,
    // Fase 3 — claims
    NotEligible         = 5,
    HospitalNotInList   = 6,
    ClaimNotFound       = 7,
    NotAValidator       = 8,
    AlreadyAttested     = 9,
    ClaimNotApproved    = 10,
    TriggerNotMet       = 11,
    InsufficientFunds   = 12,
}

// 2 de 3 validadores para aprobar
const ATTESTATIONS_REQUIRED: u32 = 2;
// 90 días expresados en segundos
const DIAS_LISTA_REQUERIDOS: u64 = 90 * 24 * 60 * 60;

// ============================================================
// Helpers internos
// ============================================================

fn addr_in_vec(vec: &Vec<Address>, addr: &Address) -> bool {
    for a in vec.iter() {
        if a == *addr {
            return true;
        }
    }
    false
}

// ============================================================
// Contrato
// ============================================================

#[contract]
pub struct PoolContract;

#[contractimpl]
impl PoolContract {
    /// Inicializa el contrato. Solo puede llamarse una vez.
    pub fn init(
        env: Env,
        admin: Address,
        token_usdc: Address,
        techo_cobertura: i128,
        meses_carencia: u32,
        validadores: Vec<Address>,
        hospitales: Vec<Address>,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();

        let s = env.storage().instance();
        s.set(&DataKey::Admin,          &admin);
        s.set(&DataKey::TokenUsdc,      &token_usdc);
        s.set(&DataKey::TechoCobertura, &techo_cobertura);
        s.set(&DataKey::MesesCarencia,  &meses_carencia);
        s.set(&DataKey::Validadores,    &validadores);
        s.set(&DataKey::Hospitals,      &hospitales);
        s.set(&DataKey::Initialized,    &true);
        s.set(&DataKey::MemberCount,    &0u32);
        s.set(&DataKey::TotalReserve,   &0i128);
        s.set(&DataKey::ClaimCount,     &0u32);

        Ok(())
    }

    /// Registra un nuevo miembro.
    pub fn join(env: Env, miembro: Address) -> Result<(), Error> {
        miembro.require_auth();

        let key = DataKey::Member(miembro.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::MemberAlreadyExists);
        }

        env.storage().persistent().set(&key, &MemberInfo {
            join_date:         env.ledger().timestamp(),
            total_contributed: 0,
            active_months:     0,
            is_eligible:       false,
        });

        let s = env.storage().instance();
        let count: u32 = s.get(&DataKey::MemberCount).unwrap_or(0);
        s.set(&DataKey::MemberCount, &(count + 1));

        Ok(())
    }

    /// Transfiere USDC del miembro al contrato y actualiza su estado.
    pub fn contribute(env: Env, miembro: Address, monto: i128) -> Result<(), Error> {
        miembro.require_auth();

        if monto <= 0 {
            return Err(Error::InvalidAmount);
        }

        let key = DataKey::Member(miembro.clone());
        let mut info: MemberInfo = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::MemberNotFound)?;

        let token_id: Address = env.storage().instance().get(&DataKey::TokenUsdc).unwrap();
        token::Client::new(&env, &token_id)
            .transfer(&miembro, &env.current_contract_address(), &monto);

        let meses_carencia: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MesesCarencia)
            .unwrap_or(6);

        info.total_contributed += monto;
        info.active_months     += 1;
        info.is_eligible        = info.active_months >= meses_carencia;
        env.storage().persistent().set(&key, &info);

        let s = env.storage().instance();
        let reserve: i128 = s.get(&DataKey::TotalReserve).unwrap_or(0);
        s.set(&DataKey::TotalReserve, &(reserve + monto));

        Ok(())
    }

    /// Devuelve información del miembro.
    pub fn get_member(env: Env, miembro: Address) -> Result<MemberInfo, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Member(miembro))
            .ok_or(Error::MemberNotFound)
    }

    /// Devuelve el estado agregado del pool.
    pub fn get_pool_status(env: Env) -> PoolStatus {
        let s = env.storage().instance();
        let total_reserve: i128 = s.get(&DataKey::TotalReserve).unwrap_or(0);
        let member_count: u32   = s.get(&DataKey::MemberCount).unwrap_or(0);
        PoolStatus {
            total_reserve,
            yield_amount: 0,
            member_count,
            available: total_reserve,
        }
    }

    // ====================================================
    // Fase 3 — Claims y validación multisig
    // ====================================================

    /// Envía una solicitud de cobertura. El miembro debe ser elegible
    /// y el hospital debe estar en la whitelist.
    pub fn submit_claim(
        env: Env,
        miembro: Address,
        referencia: String,
        fecha_referencia: u64,
        hospital: Address,
        monto: i128,
    ) -> Result<u32, Error> {
        miembro.require_auth();

        // Verificar elegibilidad del miembro
        let info: MemberInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Member(miembro.clone()))
            .ok_or(Error::MemberNotFound)?;

        if !info.is_eligible {
            return Err(Error::NotEligible);
        }

        // Verificar que el hospital esté en la whitelist
        let hospitals: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Hospitals)
            .unwrap();

        if !addr_in_vec(&hospitals, &hospital) {
            return Err(Error::HospitalNotInList);
        }

        // Crear claim con ID autoincremental
        let s = env.storage().instance();
        let count: u32 = s.get(&DataKey::ClaimCount).unwrap_or(0);
        let claim_id = count + 1;

        let claim = Claim {
            claim_id,
            miembro,
            referencia,
            fecha_referencia,
            hospital,
            monto,
            status:       ClaimStatus::Pending,
            attestations: Vec::new(&env),
        };

        env.storage().persistent().set(&DataKey::ClaimEntry(claim_id), &claim);
        s.set(&DataKey::ClaimCount, &claim_id);

        Ok(claim_id)
    }

    /// Un validador vota para aprobar o rechazar un claim.
    /// Error si el validador ya votó este claim.
    pub fn attest_claim(
        env: Env,
        validador: Address,
        claim_id: u32,
        aprobar: bool,
    ) -> Result<ClaimStatus, Error> {
        validador.require_auth();

        // Solo validadores registrados en init
        let validadores: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Validadores)
            .unwrap();

        if !addr_in_vec(&validadores, &validador) {
            return Err(Error::NotAValidator);
        }

        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::ClaimEntry(claim_id))
            .ok_or(Error::ClaimNotFound)?;

        // Un validador solo puede votar una vez
        if addr_in_vec(&claim.attestations, &validador) {
            return Err(Error::AlreadyAttested);
        }

        if !aprobar {
            claim.status = ClaimStatus::Rejected;
            env.storage().persistent().set(&DataKey::ClaimEntry(claim_id), &claim);
            return Ok(ClaimStatus::Rejected);
        }

        claim.attestations.push_back(validador);

        if claim.attestations.len() >= ATTESTATIONS_REQUIRED {
            claim.status = ClaimStatus::Approved;
        }

        env.storage().persistent().set(&DataKey::ClaimEntry(claim_id), &claim);
        Ok(claim.status.clone())
    }

    /// Ejecuta un claim aprobado: verifica el disparador paramétrico
    /// y transfiere los fondos directamente al hospital.
    pub fn execute_claim(env: Env, claim_id: u32) -> Result<(), Error> {
        let mut claim: Claim = env
            .storage()
            .persistent()
            .get(&DataKey::ClaimEntry(claim_id))
            .ok_or(Error::ClaimNotFound)?;

        // Solo se puede ejecutar si está aprobado
        if !matches!(claim.status, ClaimStatus::Approved) {
            return Err(Error::ClaimNotApproved);
        }

        // Verificar disparador paramétrico
        let info: MemberInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Member(claim.miembro.clone()))
            .ok_or(Error::MemberNotFound)?;

        let meses_carencia: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MesesCarencia)
            .unwrap_or(6);

        // (a) El miembro sigue siendo elegible
        if info.active_months < meses_carencia {
            return Err(Error::TriggerNotMet);
        }

        // (b) El miembro lleva >= 90 días en lista de espera
        let now = env.ledger().timestamp();
        if now < claim.fecha_referencia.saturating_add(DIAS_LISTA_REQUERIDOS) {
            return Err(Error::TriggerNotMet);
        }

        // Verificar fondos suficientes en el pool
        let s = env.storage().instance();
        let reserve: i128 = s.get(&DataKey::TotalReserve).unwrap_or(0);
        if reserve < claim.monto {
            return Err(Error::InsufficientFunds);
        }

        // Transferir USDC directamente al hospital (nunca al miembro)
        let token_id: Address = s.get(&DataKey::TokenUsdc).unwrap();
        token::Client::new(&env, &token_id)
            .transfer(&env.current_contract_address(), &claim.hospital, &claim.monto);

        // Actualizar reserva del pool
        s.set(&DataKey::TotalReserve, &(reserve - claim.monto));

        // Marcar como ejecutado
        claim.status = ClaimStatus::Executed;
        env.storage().persistent().set(&DataKey::ClaimEntry(claim_id), &claim);

        Ok(())
    }

    /// Devuelve un claim por su ID.
    pub fn get_claim(env: Env, claim_id: u32) -> Result<Claim, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::ClaimEntry(claim_id))
            .ok_or(Error::ClaimNotFound)
    }
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::StellarAssetClient,
        vec, Env, String,
    };

    const MONTO_MES: i128 = 18_0000000;     // $18 en stroops (7 dec)
    const MONTO_CLAIM: i128 = 50_0000000;   // $5 en stroops — cabe dentro de 6×$18=$108

    // ---- Setup ----

    struct Setup {
        env:    Env,
        pool:   Address,
        token:  Address,
        val1:   Address,
        val2:   Address,
        val3:   Address,
        hosp1:  Address,
        hosp2:  Address,
    }

    fn setup() -> Setup {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let val1  = Address::generate(&env);
        let val2  = Address::generate(&env);
        let val3  = Address::generate(&env);
        let hosp1 = Address::generate(&env);
        let hosp2 = Address::generate(&env);
        let hosp3 = Address::generate(&env);

        let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let pool  = env.register(PoolContract, ());

        PoolContractClient::new(&env, &pool).init(
            &admin,
            &token,
            &4_000_0000000i128,
            &6u32,
            &vec![&env, val1.clone(), val2.clone(), val3.clone()],
            &vec![&env, hosp1.clone(), hosp2.clone(), hosp3.clone()],
        );

        Setup { env, pool, token, val1, val2, val3, hosp1, hosp2 }
    }

    fn mint(s: &Setup, to: &Address, amount: i128) {
        StellarAssetClient::new(&s.env, &s.token).mint(to, &amount);
    }

    /// Registra y hace elegible a un miembro (6 aportes).
    fn make_eligible(s: &Setup, user: &Address) {
        let client = PoolContractClient::new(&s.env, &s.pool);
        client.join(user);
        mint(s, user, MONTO_MES * 6);
        for _ in 0..6 {
            client.contribute(user, &MONTO_MES);
        }
    }

    // ---- Tests de Fase 2 (regresión) ----

    #[test]
    fn test_join_exitoso() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        client.join(&user);
        let info = client.get_member(&user);
        assert_eq!(info.active_months, 0);
        assert!(!info.is_eligible);
    }

    #[test]
    fn test_join_duplicado_devuelve_error() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        client.join(&user);
        assert!(client.try_join(&user).is_err());
    }

    #[test]
    fn test_contribute_actualiza_saldos() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        client.join(&user);
        mint(&s, &user, MONTO_MES);
        client.contribute(&user, &MONTO_MES);
        let info = client.get_member(&user);
        assert_eq!(info.total_contributed, MONTO_MES);
        assert_eq!(info.active_months, 1);
    }

    #[test]
    fn test_contribute_sin_ser_miembro_devuelve_error() {
        let s = setup();
        let client  = PoolContractClient::new(&s.env, &s.pool);
        let intruso = Address::generate(&s.env);
        mint(&s, &intruso, MONTO_MES);
        assert!(client.try_contribute(&intruso, &MONTO_MES).is_err());
    }

    #[test]
    fn test_elegibilidad_tras_carencia_completa() {
        let s = setup();
        let user = Address::generate(&s.env);
        make_eligible(&s, &user);
        let info = PoolContractClient::new(&s.env, &s.pool).get_member(&user);
        assert_eq!(info.active_months, 6);
        assert!(info.is_eligible);
    }

    #[test]
    fn test_pool_status_refleja_multiples_miembros() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let u1 = Address::generate(&s.env);
        let u2 = Address::generate(&s.env);
        client.join(&u1); client.join(&u2);
        mint(&s, &u1, MONTO_MES); mint(&s, &u2, MONTO_MES);
        client.contribute(&u1, &MONTO_MES);
        client.contribute(&u2, &MONTO_MES);
        let pool = client.get_pool_status();
        assert_eq!(pool.member_count, 2);
        assert_eq!(pool.total_reserve, MONTO_MES * 2);
    }

    // ---- Tests de Fase 3 — submit_claim ----

    #[test]
    fn test_submit_claim_exitoso() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        make_eligible(&s, &user);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-001"),
            &1_700_000_000u64,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        let claim = client.get_claim(&claim_id);
        assert_eq!(claim.claim_id, 1);
        assert!(matches!(claim.status, ClaimStatus::Pending));
        assert_eq!(claim.attestations.len(), 0);
    }

    #[test]
    fn test_submit_claim_miembro_no_elegible() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        client.join(&user); // sin completar carencia

        let result = client.try_submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-002"),
            &1_700_000_000u64,
            &s.hosp1,
            &MONTO_CLAIM,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_submit_claim_hospital_no_en_whitelist() {
        let s = setup();
        let client       = PoolContractClient::new(&s.env, &s.pool);
        let user         = Address::generate(&s.env);
        let hosp_intruso = Address::generate(&s.env);
        make_eligible(&s, &user);

        let result = client.try_submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-003"),
            &1_700_000_000u64,
            &hosp_intruso,
            &MONTO_CLAIM,
        );
        assert!(result.is_err());
    }

    // ---- Tests de Fase 3 — attest_claim ----

    #[test]
    fn test_attest_dos_aprobaciones_cambia_a_approved() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        make_eligible(&s, &user);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-004"),
            &1_700_000_000u64,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        client.attest_claim(&s.val1, &claim_id, &true);
        let status = client.attest_claim(&s.val2, &claim_id, &true);

        assert!(matches!(status, ClaimStatus::Approved));
        assert!(matches!(client.get_claim(&claim_id).status, ClaimStatus::Approved));
    }

    #[test]
    fn test_attest_rechazo_cambia_a_rejected() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        make_eligible(&s, &user);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-005"),
            &1_700_000_000u64,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        let status = client.attest_claim(&s.val1, &claim_id, &false);
        assert!(matches!(status, ClaimStatus::Rejected));
    }

    #[test]
    fn test_attest_validador_duplicado_devuelve_error() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        make_eligible(&s, &user);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-006"),
            &1_700_000_000u64,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        client.attest_claim(&s.val1, &claim_id, &true);
        // El mismo validador intenta votar de nuevo
        assert!(client.try_attest_claim(&s.val1, &claim_id, &true).is_err());
    }

    #[test]
    fn test_attest_no_validador_devuelve_error() {
        let s = setup();
        let client    = PoolContractClient::new(&s.env, &s.pool);
        let user      = Address::generate(&s.env);
        let impostor  = Address::generate(&s.env);
        make_eligible(&s, &user);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-007"),
            &1_700_000_000u64,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        assert!(client.try_attest_claim(&impostor, &claim_id, &true).is_err());
    }

    // ---- Tests de Fase 3 — execute_claim ----

    #[test]
    fn test_flujo_completo_submit_attest_execute() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);

        // Fijar tiempo base y hacer elegible al miembro
        let ahora: u64 = 1_760_000_000;
        s.env.ledger().with_mut(|l| l.timestamp = ahora);
        make_eligible(&s, &user);

        // fecha_referencia = hace 100 días (> 90 días requeridos)
        let fecha_ref = ahora - (100 * 24 * 60 * 60);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-008"),
            &fecha_ref,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        // 2 validadores aprueban
        client.attest_claim(&s.val1, &claim_id, &true);
        client.attest_claim(&s.val2, &claim_id, &true);

        // Ejecutar: fondos van directo al hospital
        client.execute_claim(&claim_id);

        let claim = client.get_claim(&claim_id);
        assert!(matches!(claim.status, ClaimStatus::Executed));

        // El hospital recibió los fondos
        let balance_hosp = soroban_sdk::token::Client::new(&s.env, &s.token)
            .balance(&s.hosp1);
        assert_eq!(balance_hosp, MONTO_CLAIM);

        // La reserva del pool se redujo
        let pool = client.get_pool_status();
        assert_eq!(pool.total_reserve, MONTO_MES * 6 - MONTO_CLAIM);
    }

    #[test]
    fn test_execute_claim_sin_aprobar_devuelve_error() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);
        make_eligible(&s, &user);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-009"),
            &1_700_000_000u64,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        // Solo un validador vota — no llega a Approved
        client.attest_claim(&s.val1, &claim_id, &true);
        assert!(client.try_execute_claim(&claim_id).is_err());
    }

    #[test]
    fn test_execute_claim_trigger_90_dias_no_cumplido() {
        let s = setup();
        let client = PoolContractClient::new(&s.env, &s.pool);
        let user   = Address::generate(&s.env);

        let ahora: u64 = 1_760_000_000;
        s.env.ledger().with_mut(|l| l.timestamp = ahora);
        make_eligible(&s, &user);

        // fecha_referencia = hace solo 30 días (< 90 requeridos)
        let fecha_ref = ahora - (30 * 24 * 60 * 60);

        let claim_id = client.submit_claim(
            &user,
            &String::from_str(&s.env, "CCSS-2024-010"),
            &fecha_ref,
            &s.hosp1,
            &MONTO_CLAIM,
        );

        client.attest_claim(&s.val1, &claim_id, &true);
        client.attest_claim(&s.val2, &claim_id, &true);

        // El trigger paramétrico falla porque no pasaron 90 días
        assert!(client.try_execute_claim(&claim_id).is_err());
    }
}
