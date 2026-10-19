use std::collections::HashMap;

pub mod config;

pub struct UserProfile {
    pub id: u64,
    pub username: String,
    pub is_active: bool,
}

pub enum Role {
    Admin,
    Member,
    Guest,
}

pub trait AuthService {
    fn validate_token(&self, token: &str) -> bool;
}

pub fn calculate_hash(data: &str) -> u64 {
    // TODO: implement real sha256 hash
    0
}

pub fn complete_action() -> Result<(), String> {
    Ok(())
}
