//! Data fusion engine for combining intelligence from multiple sources

use crate::{Result, Error, models::*};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use std::collections::{HashMap, HashSet, BTreeMap};
use tokio::sync::RwLock;

/// Data fusion engine for correlating intelligence from multiple sources
#[derive(Debug)]
pub struct DataFusionEngine {
    fusion_rules: Vec<FusionRule>,
    entity_cache: RwLock<HashMap<Uuid, IntelEntity>>,
    correlation_cache: RwLock<HashMap<String, Vec<CorrelationMatch>>>,
    confidence_models: HashMap<String, ConfidenceModel>,
}

/// Rule for fusing data from different sources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FusionRule {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub source_types: Vec<String>,
    pub entity_types: Vec<EntityType>,
    pub fusion_strategy: FusionStrategy,
    pub confidence_threshold: f32,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FusionStrategy {
    /// Take highest confidence value
    HighestConfidence,
    /// Average all confidence values
    AverageConfidence,
    /// Weighted average based on source reliability
    WeightedAverage,
    /// Bayesian fusion
    BayesianFusion,
    /// Temporal decay fusion (newer data weighted more)
    TemporalDecay,
}

/// Result of data fusion operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FusionResult {
    pub fused_entity: IntelEntity,
    pub source_entities: Vec<Uuid>,
    pub confidence_delta: f32,
    pub fusion_method: FusionStrategy,
    pub quality_score: f32,
    pub created_at: DateTime<Utc>,
}

/// Correlation match between entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationMatch {
    pub entity1_id: Uuid,
    pub entity2_id: Uuid,
    pub correlation_type: CorrelationType,
    pub confidence: f32,
    pub evidence: Vec<CorrelationEvidence>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CorrelationType {
    SameEntity,        // Exact same entity from different sources
    RelatedEntity,     // Related but different entities
    SpatialProximity,  // Geographically close
    TemporalProximity, // Close in time
    NetworkConnection, // Connected through network analysis
    SemanticSimilarity,// Similar meaning/context
}

/// Evidence supporting a correlation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrelationEvidence {
    pub evidence_type: EvidenceType,
    pub value: String,
    pub confidence: f32,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EvidenceType {
    ExactMatch,
    FuzzyMatch,
    GeographicProximity,
    TemporalOverlap,
    NetworkPath,
    SemanticSimilarity,
    SourceCitation,
}

/// Confidence model for a specific source or data type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidenceModel {
    pub source_name: String,
    pub base_confidence: f32,
    pub reliability_score: f32,
    pub decay_rate: f32, // Per day
    pub quality_factors: HashMap<String, f32>,
}

impl DataFusionEngine {
    /// Create new data fusion engine
    pub fn new() -> Self {
        Self {
            fusion_rules: Vec::new(),
            entity_cache: RwLock::new(HashMap::new()),
            correlation_cache: RwLock::new(HashMap::new()),
            confidence_models: HashMap::new(),
        }
    }

    /// Add fusion rule
    pub fn add_fusion_rule(&mut self, rule: FusionRule) {
        self.fusion_rules.push(rule);
    }

    /// Add confidence model for a source
    pub fn add_confidence_model(&mut self, model: ConfidenceModel) {
        self.confidence_models.insert(model.source_name.clone(), model);
    }

    /// Fuse entities from multiple sources
    pub async fn fuse_entities(&self, entities: Vec<IntelEntity>) -> Result<Vec<FusionResult>> {
        if entities.len() < 2 {
            return Ok(Vec::new());
        }

        let mut fusion_results = Vec::new();
        let mut processed_entities = HashSet::new();

        // Group entities by similarity
        let correlation_groups = self.find_correlation_groups(&entities).await?;

        for group in correlation_groups {
            if group.len() < 2 {
                continue;
            }

            // Skip if any entity already processed
            if group.iter().any(|id| processed_entities.contains(id)) {
                continue;
            }

            // Get entities for this group
            let group_entities: Vec<_> = entities.iter()
                .filter(|e| group.contains(&e.id))
                .cloned()
                .collect();

            if let Some(fusion_result) = self.fuse_entity_group(group_entities).await? {
                for entity_id in &group {
                    processed_entities.insert(*entity_id);
                }
                fusion_results.push(fusion_result);
            }
        }

        Ok(fusion_results)
    }

    /// Find correlation groups among entities
    async fn find_correlation_groups(&self, entities: &[IntelEntity]) -> Result<Vec<Vec<Uuid>>> {
        let mut correlation_matrix: HashMap<(Uuid, Uuid), f32> = HashMap::new();
        let mut groups = Vec::new();

        // Calculate pairwise correlations
        for i in 0..entities.len() {
            for j in i + 1..entities.len() {
                let correlation = self.calculate_entity_correlation(&entities[i], &entities[j]).await?;
                if correlation.confidence >= 0.7 {
                    correlation_matrix.insert((entities[i].id, entities[j].id), correlation.confidence);
                }
            }
        }

        // Use Union-Find to group correlated entities
        let mut parent: HashMap<Uuid, Uuid> = HashMap::new();
        
        // Initialize each entity as its own parent
        for entity in entities {
            parent.insert(entity.id, entity.id);
        }

        // Find root of entity (with path compression)
        fn find_root(parent: &mut HashMap<Uuid, Uuid>, id: Uuid) -> Uuid {
            let mut root = id;
            while parent[&root] != root {
                let grandparent = parent[&parent[&root]];
                parent.insert(root, grandparent); // Path compression
                root = parent[&root];
            }
            root
        }

        // Union entities with high correlation
        for ((id1, id2), _confidence) in &correlation_matrix {
            let root1 = find_root(&mut parent, *id1);
            let root2 = find_root(&mut parent, *id2);
            
            if root1 != root2 {
                parent.insert(root1, root2);
            }
        }

        // Group entities by their root
        let mut group_map: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
        for entity in entities {
            let root = find_root(&mut parent, entity.id);
            group_map.entry(root).or_insert_with(Vec::new).push(entity.id);
        }

        // Return groups with more than one entity
        for (_root, group) in group_map {
            if group.len() > 1 {
                groups.push(group);
            }
        }

        Ok(groups)
    }

    /// Calculate correlation between two entities
    async fn calculate_entity_correlation(&self, entity1: &IntelEntity, entity2: &IntelEntity) -> Result<CorrelationMatch> {
        let mut evidence = Vec::new();
        let mut total_confidence = 0.0;
        let mut evidence_count = 0;

        // Check for exact name match
        if entity1.name.to_lowercase() == entity2.name.to_lowercase() {
            evidence.push(CorrelationEvidence {
                evidence_type: EvidenceType::ExactMatch,
                value: entity1.name.clone(),
                confidence: 0.95,
                source: "name_comparison".to_string(),
            });
            total_confidence += 0.95;
            evidence_count += 1;
        }
        // Check for fuzzy name match
        else if self.fuzzy_match(&entity1.name, &entity2.name) > 0.8 {
            let similarity = self.fuzzy_match(&entity1.name, &entity2.name);
            evidence.push(CorrelationEvidence {
                evidence_type: EvidenceType::FuzzyMatch,
                value: format!("{}% similarity", (similarity * 100.0) as u32),
                confidence: similarity,
                source: "fuzzy_match".to_string(),
            });
            total_confidence += similarity;
            evidence_count += 1;
        }

        // Check entity type compatibility
        if entity1.entity_type == entity2.entity_type {
            total_confidence += 0.2;
            evidence_count += 1;
        }

        // Check geographic proximity if both have locations
        if let (Some(loc1), Some(loc2)) = (&entity1.location, &entity2.location) {
            let distance = self.calculate_distance(loc1, loc2);
            if distance < 1000.0 { // Within 1km
                let geo_confidence = (1000.0 - distance) / 1000.0;
                evidence.push(CorrelationEvidence {
                    evidence_type: EvidenceType::GeographicProximity,
                    value: format!("{:.1}m apart", distance),
                    confidence: geo_confidence as f32,
                    source: "geographic_analysis".to_string(),
                });
                total_confidence += geo_confidence as f32;
                evidence_count += 1;
            }
        }

        // Check temporal proximity
        let time_diff = (entity1.created_at - entity2.created_at).num_seconds().abs();
        if time_diff < 3600 { // Within 1 hour
            let temporal_confidence = (3600 - time_diff) as f32 / 3600.0;
            evidence.push(CorrelationEvidence {
                evidence_type: EvidenceType::TemporalOverlap,
                value: format!("{} seconds apart", time_diff),
                confidence: temporal_confidence,
                source: "temporal_analysis".to_string(),
            });
            total_confidence += temporal_confidence;
            evidence_count += 1;
        }

        // Check for common tags
        let common_tags: HashSet<_> = entity1.tags.iter()
            .filter(|tag| entity2.tags.contains(tag))
            .collect();
        
        if !common_tags.is_empty() {
            let tag_confidence = (common_tags.len() as f32) / 
                ((entity1.tags.len() + entity2.tags.len()) as f32 / 2.0).max(1.0);
            evidence.push(CorrelationEvidence {
                evidence_type: EvidenceType::SemanticSimilarity,
                value: format!("{} common tags", common_tags.len()),
                confidence: tag_confidence.min(1.0),
                source: "tag_analysis".to_string(),
            });
            total_confidence += tag_confidence.min(1.0);
            evidence_count += 1;
        }

        let final_confidence = if evidence_count > 0 {
            total_confidence / evidence_count as f32
        } else {
            0.0
        };

        let correlation_type = if final_confidence > 0.9 {
            CorrelationType::SameEntity
        } else if final_confidence > 0.7 {
            CorrelationType::RelatedEntity
        } else {
            CorrelationType::SemanticSimilarity
        };

        Ok(CorrelationMatch {
            entity1_id: entity1.id,
            entity2_id: entity2.id,
            correlation_type,
            confidence: final_confidence,
            evidence,
            created_at: Utc::now(),
        })
    }

    /// Fuse a group of correlated entities
    async fn fuse_entity_group(&self, entities: Vec<IntelEntity>) -> Result<Option<FusionResult>> {
        if entities.is_empty() {
            return Ok(None);
        }

        // Find applicable fusion rule
        let fusion_rule = self.find_applicable_fusion_rule(&entities)?;
        
        // Create fused entity
        let mut fused_entity = entities[0].clone();
        fused_entity.id = Uuid::new_v4();
        fused_entity.updated_at = Utc::now();

        let source_confidence = fused_entity.confidence;
        let source_entities: Vec<_> = entities.iter().map(|e| e.id).collect();

        // Apply fusion strategy
        match fusion_rule.fusion_strategy {
            FusionStrategy::HighestConfidence => {
                if let Some(best_entity) = entities.iter().max_by(|a, b| 
                    a.confidence.partial_cmp(&b.confidence).unwrap_or(std::cmp::Ordering::Equal)
                ) {
                    fused_entity.confidence = best_entity.confidence;
                    fused_entity.name = best_entity.name.clone();
                }
            }
            
            FusionStrategy::AverageConfidence => {
                let total_confidence: f32 = entities.iter().map(|e| e.confidence).sum();
                fused_entity.confidence = total_confidence / entities.len() as f32;
            }
            
            FusionStrategy::WeightedAverage => {
                let mut weighted_sum = 0.0;
                let mut weight_sum = 0.0;
                
                for entity in &entities {
                    let weight = self.get_source_weight(&entity.source);
                    weighted_sum += entity.confidence * weight;
                    weight_sum += weight;
                }
                
                if weight_sum > 0.0 {
                    fused_entity.confidence = weighted_sum / weight_sum;
                }
            }
            
            FusionStrategy::TemporalDecay => {
                let now = Utc::now();
                let mut weighted_sum = 0.0;
                let mut weight_sum = 0.0;
                
                for entity in &entities {
                    let age_days = (now - entity.created_at).num_days() as f32;
                    let decay_rate = 0.1; // 10% decay per day
                    let temporal_weight = (-decay_rate * age_days).exp();
                    
                    weighted_sum += entity.confidence * temporal_weight;
                    weight_sum += temporal_weight;
                }
                
                if weight_sum > 0.0 {
                    fused_entity.confidence = weighted_sum / weight_sum;
                }
            }
            
            _ => {
                // Default to average confidence
                let total_confidence: f32 = entities.iter().map(|e| e.confidence).sum();
                fused_entity.confidence = total_confidence / entities.len() as f32;
            }
        }

        // Merge tags from all entities
        let mut all_tags = HashSet::new();
        for entity in &entities {
            all_tags.extend(entity.tags.iter().cloned());
        }
        fused_entity.tags = all_tags.into_iter().collect();

        // Merge attributes
        for entity in &entities {
            for (key, value) in &entity.attributes {
                // Simple merge strategy - keep first occurrence
                fused_entity.attributes.entry(key.clone()).or_insert(value.clone());
            }
        }

        // Calculate quality score
        let quality_score = self.calculate_fusion_quality(&entities, &fused_entity);

        let confidence_delta = fused_entity.confidence - source_confidence;

        Ok(Some(FusionResult {
            fused_entity,
            source_entities,
            confidence_delta,
            fusion_method: fusion_rule.fusion_strategy.clone(),
            quality_score,
            created_at: Utc::now(),
        }))
    }

    /// Find applicable fusion rule for entities
    fn find_applicable_fusion_rule(&self, entities: &[IntelEntity]) -> Result<&FusionRule> {
        for rule in &self.fusion_rules {
            if !rule.enabled {
                continue;
            }

            // Check if entity types match
            let entity_types: HashSet<_> = entities.iter().map(|e| &e.entity_type).collect();
            if rule.entity_types.iter().any(|t| entity_types.contains(&t)) {
                return Ok(rule);
            }
        }

        // Default rule if none found
        use std::sync::LazyLock;
        static DEFAULT_RULE: LazyLock<FusionRule> = LazyLock::new(|| FusionRule {
            id: Uuid::nil(),
            name: "Default".to_string(),
            description: "Default fusion rule".to_string(),
            source_types: Vec::new(),
            entity_types: Vec::new(),
            fusion_strategy: FusionStrategy::AverageConfidence,
            confidence_threshold: 0.5,
            enabled: true,
            created_at: DateTime::<Utc>::MIN_UTC,
        });

        Ok(&DEFAULT_RULE)
    }

    /// Get weight for a source based on reliability
    fn get_source_weight(&self, source: &str) -> f32 {
        self.confidence_models
            .get(source)
            .map(|model| model.reliability_score)
            .unwrap_or(1.0)
    }

    /// Calculate fusion quality score
    fn calculate_fusion_quality(&self, source_entities: &[IntelEntity], fused_entity: &IntelEntity) -> f32 {
        let mut quality_factors = Vec::new();

        // Source diversity
        let unique_sources: HashSet<_> = source_entities.iter().map(|e| &e.source).collect();
        let source_diversity = unique_sources.len() as f32 / source_entities.len() as f32;
        quality_factors.push(source_diversity);

        // Confidence consistency
        let confidences: Vec<_> = source_entities.iter().map(|e| e.confidence).collect();
        let mean_confidence = confidences.iter().sum::<f32>() / confidences.len() as f32;
        let variance = confidences.iter()
            .map(|c| (c - mean_confidence).powi(2))
            .sum::<f32>() / confidences.len() as f32;
        let consistency = 1.0 - variance.sqrt(); // Lower variance = higher consistency
        quality_factors.push(consistency.max(0.0));

        // Temporal freshness
        let avg_age = source_entities.iter()
            .map(|e| (Utc::now() - e.created_at).num_days())
            .sum::<i64>() as f32 / source_entities.len() as f32;
        let freshness = (1.0 / (1.0 + avg_age / 30.0)).min(1.0); // Decay over 30 days
        quality_factors.push(freshness);

        // Overall quality
        quality_factors.iter().sum::<f32>() / quality_factors.len() as f32
    }

    /// Simple fuzzy string matching
    fn fuzzy_match(&self, s1: &str, s2: &str) -> f32 {
        let s1 = s1.to_lowercase();
        let s2 = s2.to_lowercase();
        
        if s1 == s2 {
            return 1.0;
        }

        // Simple Levenshtein distance approximation
        let max_len = s1.len().max(s2.len());
        if max_len == 0 {
            return 1.0;
        }

        let distance = levenshtein_distance(&s1, &s2);
        1.0 - (distance as f32 / max_len as f32)
    }

    /// Calculate geographic distance between two points
    fn calculate_distance(&self, p1: &geo::Point, p2: &geo::Point) -> f64 {
        // Haversine distance in meters
        use geo::HaversineDistance;
        p1.haversine_distance(p2)
    }
}

/// Simple Levenshtein distance implementation
fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let len1 = s1.len();
    let len2 = s2.len();
    let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];

    // Initialize first row and column
    for i in 0..=len1 {
        matrix[i][0] = i;
    }
    for j in 0..=len2 {
        matrix[0][j] = j;
    }

    let s1_chars: Vec<_> = s1.chars().collect();
    let s2_chars: Vec<_> = s2.chars().collect();

    // Fill the matrix
    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] { 0 } else { 1 };
            matrix[i][j] = (matrix[i - 1][j] + 1)
                .min(matrix[i][j - 1] + 1)
                .min(matrix[i - 1][j - 1] + cost);
        }
    }

    matrix[len1][len2]
}

impl Default for DataFusionEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_levenshtein_distance() {
        assert_eq!(levenshtein_distance("hello", "hello"), 0);
        assert_eq!(levenshtein_distance("hello", "hallo"), 1);
        assert_eq!(levenshtein_distance("hello", "world"), 4);
    }

    #[tokio::test]
    async fn test_entity_correlation() {
        let engine = DataFusionEngine::new();
        
        let entity1 = IntelEntity::new(EntityType::IpAddress, "192.168.1.1", "source1");
        let entity2 = IntelEntity::new(EntityType::IpAddress, "192.168.1.1", "source2");
        
        let correlation = engine.calculate_entity_correlation(&entity1, &entity2).await.unwrap();
        assert!(correlation.confidence > 0.9);
        assert_eq!(correlation.correlation_type, CorrelationType::SameEntity);
    }

    #[tokio::test]
    async fn test_entity_fusion() {
        let mut engine = DataFusionEngine::new();
        
        // Add a simple fusion rule
        engine.add_fusion_rule(FusionRule {
            id: Uuid::new_v4(),
            name: "Test Rule".to_string(),
            description: "Test".to_string(),
            source_types: vec!["test".to_string()],
            entity_types: vec![EntityType::IpAddress],
            fusion_strategy: FusionStrategy::AverageConfidence,
            confidence_threshold: 0.5,
            enabled: true,
            created_at: Utc::now(),
        });

        let entity1 = IntelEntity {
            confidence: 0.8,
            ..IntelEntity::new(EntityType::IpAddress, "192.168.1.1", "source1")
        };
        
        let entity2 = IntelEntity {
            confidence: 0.6,
            ..IntelEntity::new(EntityType::IpAddress, "192.168.1.1", "source2")
        };

        let results = engine.fuse_entities(vec![entity1, entity2]).await.unwrap();
        assert!(!results.is_empty());
        
        let fused = &results[0];
        assert_eq!(fused.fused_entity.confidence, 0.7); // Average of 0.8 and 0.6
    }
}