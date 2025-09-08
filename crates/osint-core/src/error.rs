//! Error types for the OSINT platform

use thiserror::Error;

/// Main error type for OSINT operations
#[derive(Error, Debug)]
pub enum Error {
    #[error("Initialization failed: {0}")]
    InitializationFailed(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Data processing error: {0}")]
    DataProcessing(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Authentication failed: {0}")]
    Authentication(String),

    #[error("Authorization failed: {0}")]
    Authorization(String),

    #[error("Parsing error: {0}")]
    Parsing(String),

    #[error("ML processing error: {0}")]
    MachineLearning(String),

    #[error("Geospatial processing error: {0}")]
    Geospatial(String),

    #[error("Threat intelligence error: {0}")]
    ThreatIntel(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),

    #[error("UUID error: {0}")]
    Uuid(#[from] uuid::Error),
}

/// Result type alias for OSINT operations
pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    /// Check if error is retriable
    pub fn is_retriable(&self) -> bool {
        matches!(
            self,
            Error::Network(_) | Error::Database(_) | Error::Internal(_)
        )
    }

    /// Get error severity level
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            Error::InitializationFailed(_) => ErrorSeverity::Critical,
            Error::Configuration(_) => ErrorSeverity::High,
            Error::Authentication(_) | Error::Authorization(_) => ErrorSeverity::High,
            Error::Network(_) | Error::Database(_) => ErrorSeverity::Medium,
            Error::Parsing(_) | Error::InvalidInput(_) => ErrorSeverity::Low,
            _ => ErrorSeverity::Medium,
        }
    }
}

/// Error severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorSeverity {
    Critical,
    High,
    Medium,
    Low,
}