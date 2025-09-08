//! Intelligence processing and analysis engine

use crate::{Result, Error, models::*};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use tokio::sync::RwLock;
use std::sync::Arc;

/// Intelligence processing engine
pub struct IntelligenceEngine {
    entities: Arc<RwLock<HashMap<Uuid, IntelEntity>>>,
    indicators: Arc<RwLock<HashMap<Uuid, ThreatIndicator>>>,
    sessions: Arc<RwLock<HashMap<Uuid, AnalysisSession>>>,
    processors: Vec<Box<dyn IntelProcessor + Send + Sync>>,
}

/// Trait for intelligence processors
#[async_trait::async_trait]
pub trait IntelProcessor: Send + Sync {
    /// Process raw intelligence data
    async fn process(&self, data: &IntelligenceData) -> Result<ProcessingResult>;
    
    /// Get processor name
    fn name(&self) -> &str;
    
    /// Check if processor can handle this data type
    fn can_process(&self, data: &IntelligenceData) -> bool;
}

/// Raw intelligence data input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceData {
    pub id: Uuid,
    pub data_type: DataType,
    pub content: String,
    pub source: String,
    pub confidence: f32,
    pub collected_at: DateTime<Utc>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DataType {
    Text,
    Json,
    Xml,
    Binary,
    Image,
    Network,
    Social,
    Geographic,
    Financial,
}

/// Processing result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingResult {
    pub entities: Vec<IntelEntity>,
    pub indicators: Vec<ThreatIndicator>,
    pub relationships: Vec<EntityRelationship>,
    pub confidence: f32,
    pub processing_notes: Option<String>,
}

impl IntelligenceEngine {
    /// Create new intelligence engine
    pub fn new() -> Self {
        Self {
            entities: Arc::new(RwLock::new(HashMap::new())),
            indicators: Arc::new(RwLock::new(HashMap::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            processors: Vec::new(),
        }
    }

    /// Add intelligence processor
    pub fn add_processor(&mut self, processor: Box<dyn IntelProcessor + Send + Sync>) {
        self.processors.push(processor);
    }

    /// Process intelligence data
    pub async fn process_intelligence(&self, data: IntelligenceData) -> Result<ProcessingResult> {
        // Find suitable processor
        let processor = self.processors.iter()
            .find(|p| p.can_process(&data))
            .ok_or_else(|| Error::DataProcessing("No suitable processor found".to_string()))?;

        // Process the data
        let result = processor.process(&data).await?;

        // Store entities and indicators
        {
            let mut entities = self.entities.write().await;
            for entity in &result.entities {
                entities.insert(entity.id, entity.clone());
            }
        }

        {
            let mut indicators = self.indicators.write().await;
            for indicator in &result.indicators {
                indicators.insert(indicator.id, indicator.clone());
            }
        }

        Ok(result)
    }

    /// Get entity by ID
    pub async fn get_entity(&self, id: &Uuid) -> Result<Option<IntelEntity>> {
        let entities = self.entities.read().await;
        Ok(entities.get(id).cloned())
    }

    /// Search entities by criteria
    pub async fn search_entities(&self, query: &EntityQuery) -> Result<Vec<IntelEntity>> {
        let entities = self.entities.read().await;
        let mut results = Vec::new();

        for entity in entities.values() {
            if query.matches(entity) {
                results.push(entity.clone());
            }
        }

        // Sort by relevance (confidence)
        results.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        
        Ok(results)
    }

    /// Create new analysis session
    pub async fn create_session(&self, name: String, analyst_id: Uuid) -> Result<AnalysisSession> {
        let session = AnalysisSession {
            id: Uuid::new_v4(),
            name,
            description: None,
            analyst_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            status: SessionStatus::Draft,
            priority: SessionPriority::Medium,
            tags: Vec::new(),
            entities: Vec::new(),
            indicators: Vec::new(),
        };

        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id, session.clone());

        Ok(session)
    }

    /// Get session by ID
    pub async fn get_session(&self, id: &Uuid) -> Result<Option<AnalysisSession>> {
        let sessions = self.sessions.read().await;
        Ok(sessions.get(id).cloned())
    }

    /// Update session status
    pub async fn update_session_status(&self, session_id: &Uuid, status: SessionStatus) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.status = status;
            session.updated_at = Utc::now();
            Ok(())
        } else {
            Err(Error::NotFound("Session not found".to_string()))
        }
    }

    /// Get intelligence statistics
    pub async fn get_statistics(&self) -> IntelligenceStats {
        let entities = self.entities.read().await;
        let indicators = self.indicators.read().await;
        let sessions = self.sessions.read().await;

        let mut entity_types = HashMap::new();
        for entity in entities.values() {
            *entity_types.entry(entity.entity_type.clone()).or_insert(0) += 1;
        }

        let mut threat_types = HashMap::new();
        for indicator in indicators.values() {
            *threat_types.entry(indicator.threat_type.clone()).or_insert(0) += 1;
        }

        let mut session_statuses = HashMap::new();
        for session in sessions.values() {
            *session_statuses.entry(session.status.clone()).or_insert(0) += 1;
        }

        IntelligenceStats {
            total_entities: entities.len(),
            total_indicators: indicators.len(),
            total_sessions: sessions.len(),
            entity_types,
            threat_types,
            session_statuses,
        }
    }
}

/// Entity search query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityQuery {
    pub entity_types: Option<Vec<EntityType>>,
    pub name_pattern: Option<String>,
    pub tags: Option<Vec<String>>,
    pub min_confidence: Option<f32>,
    pub source: Option<String>,
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
}

impl EntityQuery {
    /// Check if entity matches query criteria
    pub fn matches(&self, entity: &IntelEntity) -> bool {
        if let Some(types) = &self.entity_types {
            if !types.contains(&entity.entity_type) {
                return false;
            }
        }

        if let Some(pattern) = &self.name_pattern {
            if !entity.name.to_lowercase().contains(&pattern.to_lowercase()) {
                return false;
            }
        }

        if let Some(tags) = &self.tags {
            if !tags.iter().any(|tag| entity.tags.contains(tag)) {
                return false;
            }
        }

        if let Some(min_conf) = self.min_confidence {
            if entity.confidence < min_conf {
                return false;
            }
        }

        if let Some(source) = &self.source {
            if entity.source != *source {
                return false;
            }
        }

        if let Some((start, end)) = &self.date_range {
            if entity.created_at < *start || entity.created_at > *end {
                return false;
            }
        }

        true
    }
}

/// Intelligence statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelligenceStats {
    pub total_entities: usize,
    pub total_indicators: usize,
    pub total_sessions: usize,
    pub entity_types: HashMap<EntityType, usize>,
    pub threat_types: HashMap<ThreatType, usize>,
    pub session_statuses: HashMap<SessionStatus, usize>,
}

/// Default text processor implementation
pub struct TextProcessor;

#[async_trait::async_trait]
impl IntelProcessor for TextProcessor {
    async fn process(&self, data: &IntelligenceData) -> Result<ProcessingResult> {
        let mut entities = Vec::new();
        let indicators = Vec::new();

        // Simple entity extraction (IP addresses, domains, emails)
        let ip_regex = regex::Regex::new(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")
            .map_err(|e| Error::Parsing(e.to_string()))?;
        
        let domain_regex = regex::Regex::new(r"\b[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}\b")
            .map_err(|e| Error::Parsing(e.to_string()))?;

        let email_regex = regex::Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
            .map_err(|e| Error::Parsing(e.to_string()))?;

        // Extract IP addresses
        for ip_match in ip_regex.find_iter(&data.content) {
            let ip = ip_match.as_str();
            let entity = IntelEntity::new(EntityType::IpAddress, ip, &data.source);
            entities.push(entity);
        }

        // Extract domains
        for domain_match in domain_regex.find_iter(&data.content) {
            let domain = domain_match.as_str();
            let entity = IntelEntity::new(EntityType::Domain, domain, &data.source);
            entities.push(entity);
        }

        // Extract emails
        for email_match in email_regex.find_iter(&data.content) {
            let email = email_match.as_str();
            let entity = IntelEntity::new(EntityType::Email, email, &data.source);
            entities.push(entity);
        }

        Ok(ProcessingResult {
            entities,
            indicators,
            relationships: Vec::new(),
            confidence: data.confidence * 0.8, // Slightly lower confidence for automated processing
            processing_notes: Some("Automated text processing".to_string()),
        })
    }

    fn name(&self) -> &str {
        "TextProcessor"
    }

    fn can_process(&self, data: &IntelligenceData) -> bool {
        matches!(data.data_type, DataType::Text)
    }
}

impl Default for IntelligenceEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_intelligence_engine() {
        let mut engine = IntelligenceEngine::new();
        engine.add_processor(Box::new(TextProcessor));

        let data = IntelligenceData {
            id: Uuid::new_v4(),
            data_type: DataType::Text,
            content: "Suspicious IP 192.168.1.1 contacted malware.example.com".to_string(),
            source: "test".to_string(),
            confidence: 0.9,
            collected_at: Utc::now(),
            metadata: HashMap::new(),
        };

        let result = engine.process_intelligence(data).await.unwrap();
        assert!(!result.entities.is_empty());
    }

    #[tokio::test]
    async fn test_session_management() {
        let engine = IntelligenceEngine::new();
        let analyst_id = Uuid::new_v4();
        
        let session = engine.create_session("Test Session".to_string(), analyst_id).await.unwrap();
        assert_eq!(session.name, "Test Session");
        assert_eq!(session.status, SessionStatus::Draft);

        let retrieved = engine.get_session(&session.id).await.unwrap();
        assert!(retrieved.is_some());
    }
}