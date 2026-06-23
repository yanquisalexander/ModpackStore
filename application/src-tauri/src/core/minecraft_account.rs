use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftAccount {
    username: String,
    uuid: String,
    access_token: Option<String>,
    user_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    token_expiration: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    microsoft_access_token: Option<String>,
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
            refresh_token: None,
            token_expiration: None,
            microsoft_access_token: None,
        }
    }

    pub fn with_microsoft_tokens(
        mut self,
        refresh_token: String,
        token_expiration: u64,
        microsoft_access_token: String,
    ) -> Self {
        self.refresh_token = Some(refresh_token);
        self.token_expiration = Some(token_expiration);
        self.microsoft_access_token = Some(microsoft_access_token);
        self
    }

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

    pub fn refresh_token(&self) -> Option<&str> {
        self.refresh_token.as_deref()
    }

    pub fn token_expiration(&self) -> Option<u64> {
        self.token_expiration
    }

    pub fn microsoft_access_token(&self) -> Option<&str> {
        self.microsoft_access_token.as_deref()
    }

    pub fn is_expired(&self) -> bool {
        match self.token_expiration {
            Some(exp) => {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                now >= exp
            }
            None => true,
        }
    }

    pub fn set_access_token(&mut self, access_token: Option<String>) {
        self.access_token = access_token;
    }

    pub fn set_token_expiration(&mut self, expiration: Option<u64>) {
        self.token_expiration = expiration;
    }

    pub fn set_microsoft_access_token(&mut self, token: Option<String>) {
        self.microsoft_access_token = token;
    }

    pub fn set_refresh_token(&mut self, token: Option<String>) {
        self.refresh_token = token;
    }
}

impl fmt::Display for MinecraftAccount {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "MinecraftAccount {{ username: '{}', uuid: '{}', user_type: '{}' }}",
            self.username, self.uuid, self.user_type
        )
    }
}
