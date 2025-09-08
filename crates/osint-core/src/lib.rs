//! # OSINT Core
//! 
//! Core intelligence analysis engine providing multi-source data fusion,
//! threat intelligence processing, and advanced analytics capabilities.

pub mod intelligence;
pub mod data_fusion;
pub mod threat_intel;
pub mod geo_intel;
pub mod network_intel;
pub mod ml_analysis;
pub mod models;
pub mod error;

pub use error::{Result, Error};

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Core intelligence platform configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    /// Maximum concurrent processing threads
    pub max_threads: usize,
    /// Data retention period in days
    pub retention_days: u32,
    /// Enable ML processing
    pub ml_enabled: bool,
    /// Threat intelligence sources
    pub threat_sources: Vec<String>,
    /// Geospatial processing configuration
    pub geo_config: GeoConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoConfig {
    /// Default map projection
    pub default_projection: String,
    /// Coordinate precision
    pub precision: u8,
    /// Enable spatial indexing
    pub spatial_index: bool,
}

impl Default for PlatformConfig {
    fn default() -> Self {
        Self {
            max_threads: num_cpus::get(),
            retention_days: 365,
            ml_enabled: true,
            threat_sources: vec![
                "misp".to_string(),
                "otx".to_string(),
                "virustotal".to_string(),
            ],
            geo_config: GeoConfig {
                default_projection: "WGS84".to_string(),
                precision: 6,
                spatial_index: true,
            },
        }
    }
}

/// Main OSINT platform engine
pub struct OSINTPlatform {
    config: PlatformConfig,
    thread_pool: rayon::ThreadPool,
}

impl OSINTPlatform {
    /// Create new platform instance
    pub fn new(config: PlatformConfig) -> Result<Self> {
        let thread_pool = rayon::ThreadPoolBuilder::new()
            .num_threads(config.max_threads)
            .build()
            .map_err(|e| Error::InitializationFailed(e.to_string()))?;

        Ok(Self {
            config,
            thread_pool,
        })
    }

    /// Initialize platform with default configuration
    pub fn default() -> Result<Self> {
        Self::new(PlatformConfig::default())
    }

    /// Get platform configuration
    pub fn config(&self) -> &PlatformConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_creation() {
        let platform = OSINTPlatform::default().unwrap();
        assert!(platform.config.max_threads > 0);
    }
}