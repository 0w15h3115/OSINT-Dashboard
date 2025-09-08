//! Geospatial intelligence processing and analysis

use crate::{Result, Error, models::*};
use serde::{Deserialize, Serialize};
use geo::{Point, Geometry, Contains, HaversineDistance};
use geojson::{GeoJson, Feature, FeatureCollection};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;

/// Geospatial intelligence engine
#[derive(Debug)]
pub struct GeoIntelEngine {
    geometries: HashMap<Uuid, GeoIntel>,
    spatial_index: SpatialIndex,
    country_boundaries: Option<FeatureCollection>,
}

/// Spatial indexing for efficient geographic queries
#[derive(Debug)]
pub struct SpatialIndex {
    // Simplified spatial index - in production, use R-tree or similar
    grid: HashMap<GridCell, Vec<Uuid>>,
    cell_size: f64, // degrees
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct GridCell {
    x: i32,
    y: i32,
}

/// Geographic analysis query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoQuery {
    pub geometry: Option<Geometry>,
    pub radius_km: Option<f64>,
    pub countries: Option<Vec<String>>,
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    pub accuracy_threshold: Option<f32>,
}

/// Geospatial analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoAnalysisResult {
    pub query_id: Uuid,
    pub matches: Vec<GeoMatch>,
    pub clusters: Vec<GeoCluster>,
    pub statistics: GeoStatistics,
    pub created_at: DateTime<Utc>,
}

/// Geographic match result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoMatch {
    pub geo_intel_id: Uuid,
    pub distance_km: Option<f64>,
    pub relevance_score: f32,
    pub match_type: GeoMatchType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum GeoMatchType {
    ExactLocation,
    WithinRadius,
    SameCountry,
    SameRegion,
    SameCity,
}

/// Geographic cluster of related points
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoCluster {
    pub id: Uuid,
    pub center: Point,
    pub radius_km: f64,
    pub members: Vec<Uuid>,
    pub density: f32,
    pub created_at: DateTime<Utc>,
}

/// Geographic statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoStatistics {
    pub total_points: usize,
    pub countries: HashMap<String, usize>,
    pub accuracy_distribution: HashMap<String, usize>, // ranges like "0-10m", "10-100m", etc.
    pub data_sources: HashMap<String, usize>,
}

impl GeoIntelEngine {
    /// Create new geospatial intelligence engine
    pub fn new() -> Self {
        Self {
            geometries: HashMap::new(),
            spatial_index: SpatialIndex::new(0.1), // 0.1 degree cells (~11km)
            country_boundaries: None,
        }
    }

    /// Load country boundary data
    pub async fn load_country_boundaries(&mut self, geojson_data: &str) -> Result<()> {
        let geojson = geojson_data.parse::<GeoJson>()
            .map_err(|e| Error::Geospatial(format!("Failed to parse GeoJSON: {}", e)))?;

        match geojson {
            GeoJson::FeatureCollection(fc) => {
                self.country_boundaries = Some(fc);
                Ok(())
            }
            _ => Err(Error::Geospatial("Expected FeatureCollection for country boundaries".to_string()))
        }
    }

    /// Add geospatial intelligence data
    pub fn add_geo_intel(&mut self, geo_intel: GeoIntel) -> Result<()> {
        // Add to spatial index
        self.spatial_index.insert(geo_intel.id, &geo_intel.geometry)?;
        
        // Store the geometry
        self.geometries.insert(geo_intel.id, geo_intel);
        
        Ok(())
    }

    /// Perform geographic analysis query
    pub async fn analyze_geography(&self, query: &GeoQuery) -> Result<GeoAnalysisResult> {
        let mut matches = Vec::new();

        if let Some(query_geometry) = &query.geometry {
            matches = self.find_nearby_geometries(query_geometry, query.radius_km.unwrap_or(10.0))?;
        }

        // Filter by countries if specified
        if let Some(countries) = &query.countries {
            matches.retain(|m| {
                if let Some(geo_intel) = self.geometries.get(&m.geo_intel_id) {
                    if let Some(country) = &geo_intel.country {
                        countries.contains(country)
                    } else {
                        false
                    }
                } else {
                    false
                }
            });
        }

        // Filter by date range
        if let Some((start, end)) = &query.date_range {
            matches.retain(|m| {
                if let Some(geo_intel) = self.geometries.get(&m.geo_intel_id) {
                    geo_intel.collected_at >= *start && geo_intel.collected_at <= *end
                } else {
                    false
                }
            });
        }

        // Generate clusters
        let clusters = self.generate_clusters(&matches)?;

        // Calculate statistics
        let statistics = self.calculate_geo_statistics(&matches);

        Ok(GeoAnalysisResult {
            query_id: Uuid::new_v4(),
            matches,
            clusters,
            statistics,
            created_at: Utc::now(),
        })
    }

    /// Find geometries near a given location
    fn find_nearby_geometries(&self, query_geometry: &Geometry, radius_km: f64) -> Result<Vec<GeoMatch>> {
        let mut matches = Vec::new();

        let query_point = match query_geometry {
            Geometry::Point(p) => *p,
            _ => return Err(Error::Geospatial("Only point queries are currently supported".to_string())),
        };

        // Get candidate cells from spatial index
        let candidate_ids = self.spatial_index.query_radius(&query_point, radius_km)?;

        for id in candidate_ids {
            if let Some(geo_intel) = self.geometries.get(&id) {
                let distance = match &geo_intel.geometry {
                    Geometry::Point(p) => query_point.haversine_distance(p) / 1000.0, // Convert to km
                    _ => continue, // Skip non-point geometries for now
                };

                if distance <= radius_km {
                    let match_type = if distance < 0.1 {
                        GeoMatchType::ExactLocation
                    } else {
                        GeoMatchType::WithinRadius
                    };

                    let relevance_score = (1.0 - (distance / radius_km)).max(0.0) as f32;

                    matches.push(GeoMatch {
                        geo_intel_id: id,
                        distance_km: Some(distance),
                        relevance_score,
                        match_type,
                    });
                }
            }
        }

        // Sort by relevance
        matches.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap_or(std::cmp::Ordering::Equal));

        Ok(matches)
    }

    /// Generate geographic clusters using DBSCAN-like algorithm
    fn generate_clusters(&self, matches: &[GeoMatch]) -> Result<Vec<GeoCluster>> {
        let mut clusters = Vec::new();
        let mut visited = vec![false; matches.len()];
        let min_points = 3;
        let cluster_radius = 5.0; // km

        for i in 0..matches.len() {
            if visited[i] {
                continue;
            }

            visited[i] = true;
            
            if let Some(geo_intel) = self.geometries.get(&matches[i].geo_intel_id) {
                if let Geometry::Point(center) = geo_intel.geometry {
                    let mut cluster_members = vec![matches[i].geo_intel_id];
                    
                    // Find all points within cluster radius
                    for j in i + 1..matches.len() {
                        if visited[j] {
                            continue;
                        }

                        if let Some(other_geo) = self.geometries.get(&matches[j].geo_intel_id) {
                            if let Geometry::Point(other_point) = other_geo.geometry {
                                let distance = center.haversine_distance(&other_point) / 1000.0;
                                
                                if distance <= cluster_radius {
                                    visited[j] = true;
                                    cluster_members.push(matches[j].geo_intel_id);
                                }
                            }
                        }
                    }

                    if cluster_members.len() >= min_points {
                        let density = cluster_members.len() as f32 / (std::f32::consts::PI * cluster_radius as f32 * cluster_radius as f32);
                        
                        clusters.push(GeoCluster {
                            id: Uuid::new_v4(),
                            center,
                            radius_km: cluster_radius,
                            members: cluster_members,
                            density,
                            created_at: Utc::now(),
                        });
                    }
                }
            }
        }

        Ok(clusters)
    }

    /// Calculate geographic statistics
    fn calculate_geo_statistics(&self, matches: &[GeoMatch]) -> GeoStatistics {
        let mut countries = HashMap::new();
        let mut accuracy_distribution = HashMap::new();
        let mut data_sources = HashMap::new();

        for geo_match in matches {
            if let Some(geo_intel) = self.geometries.get(&geo_match.geo_intel_id) {
                // Count countries
                if let Some(country) = &geo_intel.country {
                    *countries.entry(country.clone()).or_insert(0) += 1;
                }

                // Accuracy distribution
                let accuracy_range = match geo_intel.accuracy {
                    a if a <= 10.0 => "0-10m",
                    a if a <= 100.0 => "10-100m",
                    a if a <= 1000.0 => "100m-1km",
                    a if a <= 10000.0 => "1-10km",
                    _ => ">10km",
                };
                *accuracy_distribution.entry(accuracy_range.to_string()).or_insert(0) += 1;

                // Data sources
                *data_sources.entry(geo_intel.source.clone()).or_insert(0) += 1;
            }
        }

        GeoStatistics {
            total_points: matches.len(),
            countries,
            accuracy_distribution,
            data_sources,
        }
    }

    /// Get geographic summary for a region
    pub fn get_regional_summary(&self, bounds: &Geometry) -> Result<RegionalSummary> {
        let mut entities_in_region = Vec::new();
        let mut threat_indicators: Vec<ThreatIndicator> = Vec::new();

        for geo_intel in self.geometries.values() {
            if bounds.contains(&geo_intel.geometry) {
                entities_in_region.push(geo_intel.id);
                
                // This would be extended to link with threat intelligence
                // For now, it's a placeholder
            }
        }

        Ok(RegionalSummary {
            id: Uuid::new_v4(),
            bounds: bounds.clone(),
            entity_count: entities_in_region.len(),
            threat_level: ThreatLevel::Medium, // Would be calculated based on threats
            last_activity: Utc::now(),
            entities: entities_in_region,
        })
    }
}

/// Regional intelligence summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionalSummary {
    pub id: Uuid,
    pub bounds: Geometry,
    pub entity_count: usize,
    pub threat_level: ThreatLevel,
    pub last_activity: DateTime<Utc>,
    pub entities: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ThreatLevel {
    Critical,
    High,
    Medium,
    Low,
    Minimal,
}

impl SpatialIndex {
    fn new(cell_size: f64) -> Self {
        Self {
            grid: HashMap::new(),
            cell_size,
        }
    }

    fn insert(&mut self, id: Uuid, geometry: &Geometry) -> Result<()> {
        match geometry {
            Geometry::Point(point) => {
                let cell = self.point_to_cell(point);
                self.grid.entry(cell).or_insert_with(Vec::new).push(id);
                Ok(())
            }
            _ => Err(Error::Geospatial("Only point geometries supported in spatial index".to_string()))
        }
    }

    fn point_to_cell(&self, point: &Point) -> GridCell {
        GridCell {
            x: (point.x() / self.cell_size).floor() as i32,
            y: (point.y() / self.cell_size).floor() as i32,
        }
    }

    fn query_radius(&self, center: &Point, radius_km: f64) -> Result<Vec<Uuid>> {
        let mut results = Vec::new();
        let center_cell = self.point_to_cell(center);
        
        // Calculate how many cells to search (approximate)
        let cells_to_search = ((radius_km / 111.0) / self.cell_size).ceil() as i32 + 1;

        for x_offset in -cells_to_search..=cells_to_search {
            for y_offset in -cells_to_search..=cells_to_search {
                let cell = GridCell {
                    x: center_cell.x + x_offset,
                    y: center_cell.y + y_offset,
                };

                if let Some(ids) = self.grid.get(&cell) {
                    results.extend(ids.iter().cloned());
                }
            }
        }

        Ok(results)
    }
}

impl Default for GeoIntelEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_geo_intel_engine_creation() {
        let engine = GeoIntelEngine::new();
        assert_eq!(engine.geometries.len(), 0);
    }

    #[test]
    fn test_spatial_index() {
        let mut index = SpatialIndex::new(1.0);
        let point = Point::new(0.0, 0.0);
        let id = Uuid::new_v4();
        
        assert!(index.insert(id, &Geometry::Point(point)).is_ok());
        
        let results = index.query_radius(&point, 1.0).unwrap();
        assert!(results.contains(&id));
    }

    #[tokio::test]
    async fn test_geo_analysis() {
        let mut engine = GeoIntelEngine::new();
        
        let geo_intel = GeoIntel {
            id: Uuid::new_v4(),
            geometry: Geometry::Point(Point::new(0.0, 0.0)),
            country: Some("Test Country".to_string()),
            region: None,
            city: None,
            accuracy: 10.0,
            source: "test".to_string(),
            collected_at: Utc::now(),
            properties: HashMap::new(),
        };

        engine.add_geo_intel(geo_intel).unwrap();

        let query = GeoQuery {
            geometry: Some(Geometry::Point(Point::new(0.001, 0.001))),
            radius_km: Some(1.0),
            countries: None,
            date_range: None,
            accuracy_threshold: None,
        };

        let result = engine.analyze_geography(&query).await.unwrap();
        assert!(!result.matches.is_empty());
    }
}