#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token,
    Address, Env, Vec,
};

// ============================================================
// Tipos de retorno (mismo shape que mock-service.js)
// ============================================================

#[contracttype]
#[derive(Clone)]
pub struct MemberInfo {
    pub join_date:         u64,   // Unix timestamp de ingreso
    pub total_contributed: i128,  // Total aportado en stroops
    pub active_months:     u32,   // Número de aportes realizados
    pub is_eligible:       bool,  // active_months >= meses_carencia
}

#[contracttype]
#[derive(Clone)]
pub struct PoolStatus {
    pub total_reserve: i128, // Reserva total del fondo en stroops
    pub yield_amount:  i128, // Rendimiento acumulado (0 hasta Fase 4)
    pub member_count:  u32,  // Número de miembros registrados
    pub available:     i128, // Disponible para atenciones (= total_reserve)
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
    Initialized,
    Member(Address),
    MemberCount,
    TotalReserve,
}

// ============================================================
// Errores
// ============================================================

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    MemberAlreadyExists = 2,
    MemberNotFound      = 3,
    InvalidAmount       = 4,
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
    ) -> Result<(), Error> {
        // Falla rápido antes de requerir auth
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
        s.set(&DataKey::Initialized,    &true);
        s.set(&DataKey::MemberCount,    &0u32);
        s.set(&DataKey::TotalReserve,   &0i128);

        Ok(())
    }

    /// Registra un nuevo miembro. Requiere auth del miembro.
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

        // Transferir USDC del miembro al contrato
        let token_id: Address = env.storage().instance().get(&DataKey::TokenUsdc).unwrap();
        token::Client::new(&env, &token_id)
            .transfer(&miembro, &env.current_contract_address(), &monto);

        // Actualizar estado del miembro
        let meses_carencia: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MesesCarencia)
            .unwrap_or(6);

        info.total_contributed += monto;
        info.active_months     += 1;
        info.is_eligible        = info.active_months >= meses_carencia;
        env.storage().persistent().set(&key, &info);

        // Actualizar reserva total
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
            yield_amount: 0,           // se conecta a Blend en Fase 4
            member_count,
            available: total_reserve,
        }
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
        vec, Env,
    };

    // Monto de prueba: $18 expresado en stroops (7 decimales)
    const MONTO_MES: i128 = 18_0000000;

    fn setup_env() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin      = Address::generate(&env);
        let validador1 = Address::generate(&env);
        let validador2 = Address::generate(&env);
        let validador3 = Address::generate(&env);

        // Token USDC de prueba (Stellar Asset Contract)
        let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();

        // Desplegar y configurar el contrato del pool
        let pool_id = env.register(PoolContract, ());
        PoolContractClient::new(&env, &pool_id).init(
            &admin,
            &token_id,
            &4_000_0000000i128,
            &6u32,
            &vec![&env, validador1, validador2, validador3],
        );

        (env, pool_id, token_id)
    }

    fn mint(env: &Env, token_id: &Address, to: &Address, amount: i128) {
        StellarAssetClient::new(env, token_id).mint(to, &amount);
    }

    // ---- join ----

    #[test]
    fn test_join_exitoso() {
        let (env, pool_id, _) = setup_env();
        let client = PoolContractClient::new(&env, &pool_id);
        let user   = Address::generate(&env);

        client.join(&user);

        let info = client.get_member(&user);
        assert_eq!(info.active_months,     0);
        assert_eq!(info.total_contributed, 0);
        assert!(!info.is_eligible);

        let pool = client.get_pool_status();
        assert_eq!(pool.member_count, 1);
    }

    #[test]
    fn test_join_duplicado_devuelve_error() {
        let (env, pool_id, _) = setup_env();
        let client = PoolContractClient::new(&env, &pool_id);
        let user   = Address::generate(&env);

        client.join(&user);
        assert!(client.try_join(&user).is_err());
    }

    // ---- contribute ----

    #[test]
    fn test_contribute_actualiza_saldos() {
        let (env, pool_id, token_id) = setup_env();
        let client = PoolContractClient::new(&env, &pool_id);
        let user   = Address::generate(&env);

        client.join(&user);
        mint(&env, &token_id, &user, MONTO_MES);
        client.contribute(&user, &MONTO_MES);

        let info = client.get_member(&user);
        assert_eq!(info.total_contributed, MONTO_MES);
        assert_eq!(info.active_months,     1);
        assert!(!info.is_eligible); // faltan 5 meses

        let pool = client.get_pool_status();
        assert_eq!(pool.total_reserve, MONTO_MES);
        assert_eq!(pool.available,     MONTO_MES);
    }

    #[test]
    fn test_contribute_sin_ser_miembro_devuelve_error() {
        let (env, pool_id, token_id) = setup_env();
        let client  = PoolContractClient::new(&env, &pool_id);
        let intruso = Address::generate(&env);

        mint(&env, &token_id, &intruso, MONTO_MES);
        assert!(client.try_contribute(&intruso, &MONTO_MES).is_err());
    }

    // ---- get_member ----

    #[test]
    fn test_get_member_datos_correctos() {
        let (env, pool_id, token_id) = setup_env();
        let client = PoolContractClient::new(&env, &pool_id);
        let user   = Address::generate(&env);

        env.ledger().with_mut(|l| l.timestamp = 1_700_000_000);
        client.join(&user);
        mint(&env, &token_id, &user, MONTO_MES * 2);
        client.contribute(&user, &MONTO_MES);
        client.contribute(&user, &MONTO_MES);

        let info = client.get_member(&user);
        assert_eq!(info.join_date,         1_700_000_000);
        assert_eq!(info.total_contributed, MONTO_MES * 2);
        assert_eq!(info.active_months,     2);
        assert!(!info.is_eligible);
    }

    #[test]
    fn test_get_member_no_existente_devuelve_error() {
        let (env, pool_id, _) = setup_env();
        let client  = PoolContractClient::new(&env, &pool_id);
        let fantasma = Address::generate(&env);

        assert!(client.try_get_member(&fantasma).is_err());
    }

    // ---- get_pool_status ----

    #[test]
    fn test_pool_status_refleja_multiples_miembros() {
        let (env, pool_id, token_id) = setup_env();
        let client = PoolContractClient::new(&env, &pool_id);

        let u1 = Address::generate(&env);
        let u2 = Address::generate(&env);
        client.join(&u1);
        client.join(&u2);

        mint(&env, &token_id, &u1, MONTO_MES);
        mint(&env, &token_id, &u2, MONTO_MES);
        client.contribute(&u1, &MONTO_MES);
        client.contribute(&u2, &MONTO_MES);

        let pool = client.get_pool_status();
        assert_eq!(pool.member_count,  2);
        assert_eq!(pool.total_reserve, MONTO_MES * 2);
        assert_eq!(pool.available,     MONTO_MES * 2);
        assert_eq!(pool.yield_amount,  0);
    }

    #[test]
    fn test_elegibilidad_tras_carencia_completa() {
        let (env, pool_id, token_id) = setup_env();
        let client = PoolContractClient::new(&env, &pool_id);
        let user   = Address::generate(&env);

        client.join(&user);
        mint(&env, &token_id, &user, MONTO_MES * 6);

        for _ in 0..6 {
            client.contribute(&user, &MONTO_MES);
        }

        let info = client.get_member(&user);
        assert_eq!(info.active_months, 6);
        assert!(info.is_eligible);
    }
}
