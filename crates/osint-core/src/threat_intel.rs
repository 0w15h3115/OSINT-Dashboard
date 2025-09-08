//! Threat intelligence processing and analysis

use crate::{Result, Error, models::*};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use std::collections::{HashMap, HashSet};
use reqwest::Client;
use tokio::time::sleep;

/// Threat intelligence engine for processing and correlating threat data
pub struct ThreatIntelEngine {
    http_client: Client,
    sources: HashMap<String, Box<dyn ThreatSource + Send + Sync>>,
    indicators: HashMap<Uuid, ThreatIndicator>,
    correlation_rules: Vec<CorrelationRule>,
}

/// Trait for threat intelligence sources
#[async_trait::async_trait]
pub trait ThreatSource: Send + Sync {
    /// Fetch latest threat indicators
    async fn fetch_indicators(&self) -> Result<Vec<ThreatIndicator>>;
    
    /// Get source name
    fn name(&self) -> &str;
    
    /// Get source type
    fn source_type(&self) -> ThreatSourceType;
    
    /// Check if source is available
    async fn is_available(&self) -> bool;
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ThreatSourceType {
    Commercial,
    OpenSource,
    Government,
    Community,
    Internal,
}

/// Correlation rule for threat indicators
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationRule {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub rule_type: CorrelationType,
    pub conditions: Vec<CorrelationCondition>,
    pub actions: Vec<CorrelationAction>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CorrelationType {
    Temporal,      // Time-based correlation
    Spatial,       // Geographic correlation
    Behavioral,    // Pattern-based correlation
    Attribution,   // Actor correlation
    Campaign,      // Campaign correlation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationCondition {
    pub field: String,
    pub operator: ConditionOperator,
    pub value: serde_json::Value,
    pub weight: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ConditionOperator {
    Equals,
    Contains,
    Matches,
    GreaterThan,
    LessThan,
    InTimeRange,
    InGeoRadius,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationAction {
    pub action_type: ActionType,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ActionType {
    CreateAlert,
    UpdateThreatLevel,
    NotifyAnalyst,
    CreateCase,
    BlockIndicator,
    EnrichIndicator,
}

/// Threat correlation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationResult {
    pub rule_id: Uuid,
    pub matched_indicators: Vec<Uuid>,
    pub correlation_score: f32,
    pub created_at: DateTime<Utc>,
    pub actions_taken: Vec<CorrelationAction>,
}

impl ThreatIntelEngine {
    /// Create new threat intelligence engine
    pub fn new() -> Self {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent("OSINT-Platform/1.0")
            .build()
            .expect("Failed to create HTTP client");

        Self {
            http_client,
            sources: HashMap::new(),
            indicators: HashMap::new(),
            correlation_rules: Vec::new(),
        }
    }

    /// Add threat intelligence source
    pub fn add_source(&mut self, name: String, source: Box<dyn ThreatSource + Send + Sync>) {
        self.sources.insert(name, source);
    }

    /// Fetch indicators from all sources
    pub async fn fetch_all_indicators(&mut self) -> Result<usize> {
        let mut total_fetched = 0;

        for (name, source) in &self.sources {
            if !source.is_available().await {
                tracing::warn!("Threat source {} is not available", name);
                continue;
            }

            match source.fetch_indicators().await {
                Ok(indicators) => {
                    for indicator in indicators {
                        self.indicators.insert(indicator.id, indicator);
                        total_fetched += 1;
                    }
                    tracing::info!("Fetched {} indicators from {}", total_fetched, name);
                }
                Err(e) => {
                    tracing::error!("Failed to fetch indicators from {}: {}", name, e);
                }
            }

            // Rate limiting
            sleep(std::time::Duration::from_secs(1)).await;
        }

        Ok(total_fetched)
    }

    /// Add correlation rule
    pub fn add_correlation_rule(&mut self, rule: CorrelationRule) {
        self.correlation_rules.push(rule);
    }

    /// Run correlation analysis
    pub async fn correlate_threats(&self) -> Result<Vec<CorrelationResult>> {
        let mut results = Vec::new();

        for rule in &self.correlation_rules {
            if !rule.enabled {
                continue;
            }

            let matched_indicators = self.find_matching_indicators(rule).await?;
            if matched_indicators.len() >= 2 {
                let correlation_score = self.calculate_correlation_score(rule, &matched_indicators);
                
                if correlation_score >= 0.7 {
                    let result = CorrelationResult {
                        rule_id: rule.id,
                        matched_indicators: matched_indicators.into_iter().collect(),
                        correlation_score,
                        created_at: Utc::now(),
                        actions_taken: rule.actions.clone(),
                    };
                    results.push(result);
                }
            }
        }

        Ok(results)
    }

    /// Find indicators matching correlation rule
    async fn find_matching_indicators(&self, rule: &CorrelationRule) -> Result<HashSet<Uuid>> {
        let mut matched = HashSet::new();

        for indicator in self.indicators.values() {
            let mut condition_matches = 0;
            let mut total_weight = 0.0;
            let mut matched_weight = 0.0;

            for condition in &rule.conditions {
                total_weight += condition.weight;
                
                if self.evaluate_condition(condition, indicator) {
                    condition_matches += 1;
                    matched_weight += condition.weight;
                }
            }

            // Require at least 70% of conditions to match by weight
            if matched_weight / total_weight >= 0.7 {
                matched.insert(indicator.id);
            }
        }

        Ok(matched)
    }

    /// Evaluate individual correlation condition
    fn evaluate_condition(&self, condition: &CorrelationCondition, indicator: &ThreatIndicator) -> bool {
        match condition.field.as_str() {
            "threat_type" => {
                match condition.operator {
                    ConditionOperator::Equals => {
                        if let Ok(threat_type) = serde_json::from_value::<ThreatType>(condition.value.clone()) {
                            indicator.threat_type == threat_type
                        } else { false }
                    }
                    _ => false,
                }
            }
            "severity" => {
                match condition.operator {
                    ConditionOperator::Equals => {
                        if let Ok(severity) = serde_json::from_value::<ThreatSeverity>(condition.value.clone()) {
                            indicator.severity == severity
                        } else { false }
                    }
                    ConditionOperator::GreaterThan => {
                        if let Ok(severity) = serde_json::from_value::<ThreatSeverity>(condition.value.clone()) {
                            indicator.severity >= severity
                        } else { false }
                    }
                    _ => false,
                }
            }
            "mitre_tactics" => {
                match condition.operator {
                    ConditionOperator::Contains => {
                        if let Some(tactic) = condition.value.as_str() {
                            indicator.mitre_tactics.contains(&tactic.to_string())
                        } else { false }
                    }
                    _ => false,
                }
            }
            "first_seen" => {
                match condition.operator {
                    ConditionOperator::InTimeRange => {
                        // Implement time range checking
                        true // Placeholder
                    }
                    _ => false,
                }
            }
            _ => false,
        }
    }

    /// Calculate correlation score for matched indicators
    fn calculate_correlation_score(&self, rule: &CorrelationRule, matched_indicators: &HashSet<Uuid>) -> f32 {
        let mut score = 0.0;
        let indicator_count = matched_indicators.len() as f32;

        // Base score from number of matched indicators
        score += (indicator_count - 1.0) * 0.2;

        // Bonus for rule type complexity
        score += match rule.rule_type {
            CorrelationType::Attribution => 0.3,
            CorrelationType::Campaign => 0.25,
            CorrelationType::Behavioral => 0.2,
            CorrelationType::Temporal => 0.15,
            CorrelationType::Spatial => 0.1,
        };

        // Average confidence of matched indicators
        let mut total_confidence = 0.0;
        let mut valid_indicators = 0;

        for indicator_id in matched_indicators {
            if let Some(indicator) = self.indicators.get(indicator_id) {
                total_confidence += indicator.confidence;
                valid_indicators += 1;
            }
        }

        if valid_indicators > 0 {
            let avg_confidence = total_confidence / valid_indicators as f32;
            score += avg_confidence * 0.3;
        }

        score.min(1.0)
    }

    /// Get threat statistics
    pub fn get_threat_stats(&self) -> ThreatStatistics {
        let mut threat_types = HashMap::new();
        let mut severities = HashMap::new();
        let mut sources = HashMap::new();
        let mut recent_count = 0;

        let one_day_ago = Utc::now() - Duration::days(1);

        for indicator in self.indicators.values() {
            *threat_types.entry(indicator.threat_type.clone()).or_insert(0) += 1;
            *severities.entry(indicator.severity.clone()).or_insert(0) += 1;
            *sources.entry(indicator.source.clone()).or_insert(0) += 1;

            if indicator.first_seen >= one_day_ago {
                recent_count += 1;
            }
        }

        ThreatStatistics {
            total_indicators: self.indicators.len(),
            recent_indicators: recent_count,
            threat_types,
            severities,
            sources,
        }
    }

    /// Search indicators by criteria
    pub fn search_indicators(&self, query: &ThreatQuery) -> Vec<&ThreatIndicator> {
        self.indicators.values()
            .filter(|indicator| query.matches(indicator))
            .collect()
    }
}

/// Threat query for searching indicators
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatQuery {
    pub threat_types: Option<Vec<ThreatType>>,
    pub severities: Option<Vec<ThreatSeverity>>,
    pub sources: Option<Vec<String>>,
    pub value_pattern: Option<String>,
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    pub min_confidence: Option<f32>,
}

impl ThreatQuery {
    pub fn matches(&self, indicator: &ThreatIndicator) -> bool {
        if let Some(types) = &self.threat_types {
            if !types.contains(&indicator.threat_type) {
                return false;
            }
        }

        if let Some(severities) = &self.severities {
            if !severities.contains(&indicator.severity) {
                return false;
            }
        }

        if let Some(sources) = &self.sources {
            if !sources.contains(&indicator.source) {
                return false;
            }
        }

        if let Some(pattern) = &self.value_pattern {
            if !indicator.value.to_lowercase().contains(&pattern.to_lowercase()) {
                return false;
            }
        }

        if let Some((start, end)) = &self.date_range {
            if indicator.first_seen < *start || indicator.first_seen > *end {
                return false;
            }
        }

        if let Some(min_conf) = self.min_confidence {
            if indicator.confidence < min_conf {
                return false;
            }
        }

        true
    }
}

/// Threat intelligence statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatStatistics {
    pub total_indicators: usize,
    pub recent_indicators: usize,
    pub threat_types: HashMap<ThreatType, usize>,
    pub severities: HashMap<ThreatSeverity, usize>,
    pub sources: HashMap<String, usize>,
}

/// MISP threat intelligence source implementation
pub struct MispSource {
    base_url: String,
    api_key: String,
    client: Client,
}

impl MispSource {
    pub fn new(base_url: String, api_key: String) -> Self {
        let client = Client::new();
        Self {
            base_url,
            api_key,
            client,
        }
    }
}

#[async_trait::async_trait]
impl ThreatSource for MispSource {
    async fn fetch_indicators(&self) -> Result<Vec<ThreatIndicator>> {
        // Implementation would fetch from MISP API
        // This is a placeholder implementation
        Ok(Vec::new())
    }

    fn name(&self) -> &str {
        "MISP"
    }

    fn source_type(&self) -> ThreatSourceType {
        ThreatSourceType::Community
    }

    async fn is_available(&self) -> bool {
        // Check MISP server availability
        true // Placeholder
    }
}

impl Default for ThreatIntelEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_threat_intel_engine_creation() {
        let engine = ThreatIntelEngine::new();
        assert_eq!(engine.indicators.len(), 0);
        assert_eq!(engine.sources.len(), 0);
    }

    #[test]
    fn test_correlation_condition_evaluation() {
        let engine = ThreatIntelEngine::new();
        let indicator = ThreatIndicator {
            id: Uuid::new_v4(),
            indicator_type: IndicatorType::IpAddress,
            value: "1.1.1.1".to_string(),
            threat_type: ThreatType::Malware,
            severity: ThreatSeverity::High,
            confidence: 0.9,
            tlp: TrafficLightProtocol::Green,
            source: "test".to_string(),
            first_seen: Utc::now(),
            last_seen: Utc::now(),
            valid_until: None,
            context: None,
            mitre_tactics: vec!["initial-access".to_string()],
            mitre_techniques: vec!["T1566".to_string()],
        };

        let condition = CorrelationCondition {
            field: "threat_type".to_string(),
            operator: ConditionOperator::Equals,
            value: serde_json::to_value(ThreatType::Malware).unwrap(),
            weight: 1.0,
        };

        assert!(engine.evaluate_condition(&condition, &indicator));
    }
}