//! OSINT Platform Command Line Interface

use clap::{Parser, Subcommand};
use osint_core::{OSINTPlatform, PlatformConfig, intelligence::*, Result};
use tracing::{info, warn, error};
use uuid::Uuid;

#[derive(Parser)]
#[command(name = "osint")]
#[command(about = "Government-Level OSINT Intelligence Platform")]
#[command(version = "1.0.0")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose logging
    #[arg(short, long)]
    verbose: bool,

    /// Configuration file path
    #[arg(short, long, value_name = "FILE")]
    config: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize the OSINT platform
    Init {
        /// Platform configuration
        #[arg(short, long, default_value = "default")]
        mode: String,
    },
    /// Process intelligence data
    Process {
        /// Input data file
        #[arg(short, long)]
        input: String,
        
        /// Data type
        #[arg(short, long, default_value = "text")]
        data_type: String,

        /// Source name
        #[arg(short, long, default_value = "manual")]
        source: String,
    },
    /// Search entities
    Search {
        /// Search query
        #[arg(short, long)]
        query: String,

        /// Entity type filter
        #[arg(short, long)]
        entity_type: Option<String>,
    },
    /// Show platform statistics
    Stats,
    /// Create new analysis session
    Session {
        /// Session name
        #[arg(short, long)]
        name: String,

        /// Analyst ID (UUID)
        #[arg(short, long)]
        analyst: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    let log_level = if cli.verbose { "debug" } else { "info" };
    tracing_subscriber::fmt()
        .with_env_filter(log_level)
        .with_target(false)
        .init();

    info!("🦀 OSINT Platform v1.0.0 - Government-Level Intelligence Analysis");

    // Load configuration
    let config = if let Some(config_path) = cli.config {
        info!("Loading configuration from: {}", config_path);
        // TODO: Load from file
        PlatformConfig::default()
    } else {
        PlatformConfig::default()
    };

    // Initialize platform
    info!("Initializing intelligence platform...");
    let platform = OSINTPlatform::new(config)?;
    info!("✅ Platform initialized successfully");

    // Execute command
    let result = match cli.command {
        Commands::Init { mode } => {
            info!("Initializing platform in {} mode", mode);
            
            println!("🎯 OSINT Platform Initialization");
            println!("================================");
            println!("Mode: {}", mode);
            println!("Threads: {}", platform.config().max_threads);
            println!("ML Enabled: {}", platform.config().ml_enabled);
            println!("Threat Sources: {:?}", platform.config().threat_sources);
            println!("✅ Platform ready for intelligence processing!");
        }

        Commands::Process { input, data_type, source } => {
            info!("Processing intelligence data from: {}", input);
            
            // Read input file
            let content = match std::fs::read_to_string(&input) {
                Ok(content) => content,
                Err(e) => {
                    error!("Failed to read input file '{}': {}", input, e);
                    return Err(e.into());
                }
            };

            // Create intelligence engine
            let mut engine = IntelligenceEngine::new();
            engine.add_processor(Box::new(TextProcessor));

            // Create intelligence data
            let data = IntelligenceData {
                id: Uuid::new_v4(),
                data_type: match data_type.as_str() {
                    "text" => DataType::Text,
                    "json" => DataType::Json,
                    "xml" => DataType::Xml,
                    _ => DataType::Text,
                },
                content,
                source,
                confidence: 0.8,
                collected_at: chrono::Utc::now(),
                metadata: std::collections::HashMap::new(),
            };

            // Process the data
            match engine.process_intelligence(data).await {
                Ok(result) => {
                    println!("📊 Processing Results");
                    println!("====================");
                    println!("Entities found: {}", result.entities.len());
                    println!("Indicators found: {}", result.indicators.len());
                    println!("Confidence: {:.2}", result.confidence);
                    
                    for entity in &result.entities {
                        println!("  • {} ({}): {:.2} confidence", 
                            entity.name, 
                            format!("{:?}", entity.entity_type),
                            entity.confidence
                        );
                    }
                }
                Err(e) => {
                    error!("Processing failed: {}", e);
                    return Err(e);
                }
            }
        }

        Commands::Search { query, entity_type } => {
            info!("Searching entities: {}", query);
            
            let engine = IntelligenceEngine::new();
            let search_query = EntityQuery {
                entity_types: entity_type.map(|_| vec![]), // TODO: Parse entity type
                name_pattern: Some(query.clone()),
                tags: None,
                min_confidence: None,
                source: None,
                date_range: None,
            };

            match engine.search_entities(&search_query).await {
                Ok(results) => {
                    println!("🔍 Search Results for: '{}'", query);
                    println!("================================");
                    if results.is_empty() {
                        println!("No entities found matching the query.");
                    } else {
                        for entity in results {
                            println!("  • {} ({}): {:.2} confidence", 
                                entity.name,
                                format!("{:?}", entity.entity_type),
                                entity.confidence
                            );
                        }
                    }
                }
                Err(e) => {
                    error!("Search failed: {}", e);
                    return Err(e);
                }
            }
        }

        Commands::Stats => {
            info!("Retrieving platform statistics");
            
            let engine = IntelligenceEngine::new();
            let stats = engine.get_statistics().await;

            println!("📈 Platform Statistics");
            println!("=====================");
            println!("Total Entities: {}", stats.total_entities);
            println!("Total Indicators: {}", stats.total_indicators);
            println!("Total Sessions: {}", stats.total_sessions);
            
            if !stats.entity_types.is_empty() {
                println!("\nEntity Types:");
                for (entity_type, count) in stats.entity_types {
                    println!("  • {:?}: {}", entity_type, count);
                }
            }
            
            if !stats.threat_types.is_empty() {
                println!("\nThreat Types:");
                for (threat_type, count) in stats.threat_types {
                    println!("  • {:?}: {}", threat_type, count);
                }
            }
        }

        Commands::Session { name, analyst } => {
            info!("Creating new analysis session: {}", name);
            
            let analyst_id = match Uuid::parse_str(&analyst) {
                Ok(id) => id,
                Err(e) => {
                    error!("Invalid analyst UUID '{}': {}", analyst, e);
                    return Err(e.into());
                }
            };

            let engine = IntelligenceEngine::new();
            match engine.create_session(name.clone(), analyst_id).await {
                Ok(session) => {
                    println!("🎯 New Analysis Session Created");
                    println!("==============================");
                    println!("Session ID: {}", session.id);
                    println!("Name: {}", session.name);
                    println!("Analyst: {}", session.analyst_id);
                    println!("Created: {}", session.created_at.format("%Y-%m-%d %H:%M:%S UTC"));
                    println!("Status: {:?}", session.status);
                }
                Err(e) => {
                    error!("Session creation failed: {}", e);
                    return Err(e);
                }
            }
        }
    };

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_cli() {
        use clap::CommandFactory;
        Cli::command().debug_assert()
    }
}