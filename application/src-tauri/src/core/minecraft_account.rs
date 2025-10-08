use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftAccount {
    username: String,
    uuid: String,
    access_token: Option<String>,
    user_type: String,
    /// Custom nickname for ModpackStore accounts per instance
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ms_nickname: Option<String>,
}

impl MinecraftAccount {
    pub fn new(
        username: String,
        uuid: String,
        access_token: Option<String>,
        user_type: String,
    ) -> Self {
        MinecraftAccount {
            username,
            uuid,
            access_token,
            user_type,
            ms_nickname: None,
        }
    }

    // Getters
    pub fn username(&self) -> &str {
        &self.username
    }

    pub fn uuid(&self) -> &str {
        &self.uuid
    }

    pub fn access_token(&self) -> Option<&str> {
        self.access_token.as_deref()
    }

    pub fn user_type(&self) -> &str {
        &self.user_type
    }

    pub fn ms_nickname(&self) -> Option<&str> {
        self.ms_nickname.as_deref()
    }

    // Setters
    pub fn set_username(&mut self, username: String) {
        self.username = username;
    }

    pub fn set_uuid(&mut self, uuid: String) {
        self.uuid = uuid;
    }

    pub fn set_access_token(&mut self, access_token: Option<String>) {
        self.access_token = access_token;
    }

    pub fn set_user_type(&mut self, user_type: String) {
        self.user_type = user_type;
    }

    pub fn set_ms_nickname(&mut self, ms_nickname: Option<String>) {
        self.ms_nickname = ms_nickname;
    }
}

// Implement Display for better debugging
impl fmt::Display for MinecraftAccount {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "MinecraftAccount {{ username: '{}', uuid: '{}', access_token: '{}', user_type: '{}' }}",
            self.username,
            self.uuid,
            self.access_token.as_deref().unwrap_or("null"),
            self.user_type
        )
    }
}
