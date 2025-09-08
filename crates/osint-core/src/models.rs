//! Core data models for intelligence analysis

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use geo::{Point, Geometry};
use std::collections::HashMap;

/// Intelligence entity representing any analyzed object
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelEntity {
    pub id: Uuid,
    pub entity_type: EntityType,
    pub name: String,
    pub description: Option<String>,
    pub confidence: f32, // 0.0 - 1.0
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub tags: Vec<String>,
    pub attributes: HashMap<String, serde_json::Value>,
    pub location: Option<Point>,
    pub relationships: Vec<EntityRelationship>,
}

/// Types of intelligence entities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EntityType {
    // Network entities
    IpAddress,
    Domain,
    Url,
    Email,
    
    // Threat entities
    Malware,
    ThreatActor,
    Campaign,
    Vulnerability,
    
    // Geospatial entities
    Location,
    Facility,
    Vehicle,
    
    // Human entities
    Person,
    Organization,
    Group,
    
    // Communication entities
    PhoneNumber,
    SocialMedia,
    Document,
    
    // Generic
    Unknown,
}

/// Relationship between entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRelationship {
    pub target_entity_id: Uuid,
    pub relationship_type: RelationshipType,
    pub confidence: f32,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RelationshipType {
    Controls,
    Communicates,
    Hosts,
    Uses,
    Located,
    Owns,
    Associates,
    Targets,
    Delivers,
    Contains,
    Related,
}

/// Threat intelligence indicator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIndicator {
    pub id: Uuid,
    pub indicator_type: IndicatorType,
    pub value: String,
    pub threat_type: ThreatType,
    pub severity: ThreatSeverity,
    pub confidence: f32,
    pub tlp: TrafficLightProtocol,
    pub source: String,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub valid_until: Option<DateTime<Utc>>,
    pub context: Option<String>,
    pub mitre_tactics: Vec<String>,
    pub mitre_techniques: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IndicatorType {
    Hash,
    IpAddress,
    Domain,
    Url,
    Email,
    Registry,
    Filename,
    Mutex,
    Certificate,
    Yara,
    Sigma,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ThreatType {
    Malware,
    Botnet,
    Phishing,
    CommandControl,
    Reconnaissance,
    Weaponization,
    Delivery,
    Exploitation,
    Installation,
    Persistence,
    LateralMovement,
    DataExfiltration,
    Impact,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ThreatSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TrafficLightProtocol {
    Red,    // No sharing
    Amber,  // Limited sharing
    Green,  // Community sharing
    White,  // Unlimited sharing
}

/// Geospatial intelligence data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoIntel {
    pub id: Uuid,
    pub geometry: Geometry,
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub accuracy: f32, // meters
    pub source: String,
    pub collected_at: DateTime<Utc>,
    pub properties: HashMap<String, serde_json::Value>,
}

/// Analysis session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSession {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub analyst_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: SessionStatus,
    pub priority: SessionPriority,
    pub tags: Vec<String>,
    pub entities: Vec<Uuid>,
    pub indicators: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum SessionStatus {
    Draft,
    Active,
    Paused,
    Completed,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum SessionPriority {
    Critical,
    High,
    Medium,
    Low,
}

/// Intelligence report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntelReport {
    pub id: Uuid,
    pub title: String,
    pub summary: String,
    pub content: String, // Markdown format
    pub classification: Classification,
    pub analyst_id: Uuid,
    pub session_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    pub tags: Vec<String>,
    pub entities_referenced: Vec<Uuid>,
    pub indicators_referenced: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Classification {
    Unclassified,
    Confidential,
    Secret,
    TopSecret,
}

impl Default for IntelEntity {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            entity_type: EntityType::Unknown,
            name: String::new(),
            description: None,
            confidence: 0.5,
            source: String::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            tags: Vec::new(),
            attributes: HashMap::new(),
            location: None,
            relationships: Vec::new(),
        }
    }
}

impl IntelEntity {
    /// Create new entity with specified type and name
    pub fn new(entity_type: EntityType, name: impl Into<String>, source: impl Into<String>) -> Self {
        Self {
            entity_type,
            name: name.into(),
            source: source.into(),
            ..Default::default()
        }
    }

    /// Add relationship to another entity
    pub fn add_relationship(&mut self, target_id: Uuid, rel_type: RelationshipType, confidence: f32, source: String) {
        self.relationships.push(EntityRelationship {
            target_entity_id: target_id,
            relationship_type: rel_type,
            confidence,
            first_seen: Utc::now(),
            last_seen: Utc::now(),
            source,
        });
        self.updated_at = Utc::now();
    }

    /// Update confidence score
    pub fn update_confidence(&mut self, new_confidence: f32) {
        self.confidence = new_confidence.clamp(0.0, 1.0);
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entity_creation() {
        let entity = IntelEntity::new(
            EntityType::IpAddress,
            "192.168.1.1",
            "manual_entry"
        );
        assert_eq!(entity.entity_type, EntityType::IpAddress);
        assert_eq!(entity.name, "192.168.1.1");
        assert_eq!(entity.confidence, 0.5);
    }

    #[test]
    fn test_add_relationship() {
        let mut entity1 = IntelEntity::new(EntityType::IpAddress, "1.1.1.1", "test");
        let entity2_id = Uuid::new_v4();
        
        entity1.add_relationship(entity2_id, RelationshipType::Communicates, 0.8, "test".to_string());
        
        assert_eq!(entity1.relationships.len(), 1);
        assert_eq!(entity1.relationships[0].target_entity_id, entity2_id);
    }
}