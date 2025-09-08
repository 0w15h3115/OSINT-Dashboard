// OSINT Dashboard - Enhanced Edition
// Required dependencies:
// npm install react lucide-react d3 topojson-client d3-geo-projection

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
// Note: You need to install d3-geo-projection: npm install d3-geo-projection
import { geoRobinson, geoWinkel3, geoEckert4 } from 'd3-geo-projection';
import { 
  Search, AlertCircle, Activity, Database, Globe, Shield, Terminal, Filter, 
  BarChart3, Map, ChevronLeft, Download, RefreshCw, Settings, Bell, 
  Sun, Moon, Plus, X, Eye, TrendingUp, Clock, Wifi, WifiOff, Lock,
  FileText, ExternalLink, Zap, AlertTriangle, CheckCircle, Info, Maximize2, Minimize2, HelpCircle
} from 'lucide-react';

const OSINTDashboard = () => {
  // Core state
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('map');
  const [activeTool, setActiveTool] = useState(null);
  const [threatLevel, setThreatLevel] = useState('medium');
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [selectedIncidents, setSelectedIncidents] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [dataSource, setDataSource] = useState('live');
  const [alerts, setAlerts] = useState([]);
  const [networkStatus, setNetworkStatus] = useState('online');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [mapProjection, setMapProjection] = useState('natural');
  const [showMapHelp, setShowMapHelp] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState({
    threatLevel: 'all',
    timeRange: '24h',
    category: 'all',
    country: 'all',
    severity: 'all'
  });
  
  // Tool inputs state
  const [toolInputs, setToolInputs] = useState({
    ip: '',
    domain: '',
    hash: '',
    networkInterface: 'eth0',
    apiKey: '',
    apiEndpoint: ''
  });
  
  // Tool results state
  const [toolResults, setToolResults] = useState({});
  const [analysisHistory, setAnalysisHistory] = useState([]);
  
  // Settings state
  const [settings, setSettings] = useState({
    notifications: true,
    soundAlerts: false,
    autoExport: false,
    dataRetention: 30,
    mapStyle: 'dark',
    language: 'en'
  });

  // Refs
  const mapContainerRef = useRef(null);
  const d3Container = useRef(null);

  // Enhanced country data with more details
  const [countryData, setCountryData] = useState({
    'United States': { 
      threats: 45, 
      incidents: 12, 
      riskLevel: 'high', 
      lastUpdate: '2 hours ago',
      trend: 'increasing',
      activeThreats: ['DDoS', 'Ransomware', 'APT'],
      topTargets: ['Finance', 'Healthcare', 'Government'],
      mitigationStatus: 'In Progress'
    },
    'China': { 
      threats: 38, 
      incidents: 8, 
      riskLevel: 'high', 
      lastUpdate: '4 hours ago',
      trend: 'stable',
      activeThreats: ['Espionage', 'Data Theft'],
      topTargets: ['Technology', 'Defense'],
      mitigationStatus: 'Monitoring'
    },
    'Russia': { 
      threats: 42, 
      incidents: 15, 
      riskLevel: 'high', 
      lastUpdate: '1 hour ago',
      trend: 'increasing',
      activeThreats: ['Ransomware', 'Supply Chain'],
      topTargets: ['Infrastructure', 'Energy'],
      mitigationStatus: 'Critical'
    },
    'Germany': { 
      threats: 12, 
      incidents: 3, 
      riskLevel: 'medium', 
      lastUpdate: '6 hours ago',
      trend: 'decreasing',
      activeThreats: ['Phishing'],
      topTargets: ['Manufacturing'],
      mitigationStatus: 'Contained'
    },
    'Brazil': { 
      threats: 18, 
      incidents: 5, 
      riskLevel: 'medium', 
      lastUpdate: '3 hours ago',
      trend: 'stable',
      activeThreats: ['Banking Trojans'],
      topTargets: ['Finance', 'Retail'],
      mitigationStatus: 'Monitoring'
    }
  });

  // Add notification
  const addNotification = useCallback((message, type = 'info') => {
    const newNotification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 10));
    
    if (settings.notifications && Notification.permission === 'granted') {
      new Notification('OSINT Dashboard Alert', {
        body: message,
        icon: '/favicon.ico'
      });
    }
  }, [settings.notifications]);

  // Refresh data
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    addNotification('Refreshing data...', 'info');
    
    setTimeout(() => {
      const updatedCountryData = { ...countryData };
      Object.keys(updatedCountryData).forEach(country => {
        const change = Math.random() > 0.5 ? 1 : -1;
        updatedCountryData[country].threats += change * Math.floor(Math.random() * 5);
        updatedCountryData[country].lastUpdate = 'Just now';
      });
      setCountryData(updatedCountryData);
      
      setIsLoading(false);
      addNotification('Data refreshed successfully', 'success');
    }, 1500);
  }, [countryData, addNotification]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        setIsMapFullscreen(false);
        return;
      }
      
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            setActiveTab('map');
            break;
          case '2':
            e.preventDefault();
            setActiveTab('incidents');
            break;
          case '3':
            e.preventDefault();
            setActiveTab('analytics');
            break;
          case '4':
            e.preventDefault();
            setActiveTab('tools');
            break;
          case 'k':
            e.preventDefault();
            document.querySelector('input[type="text"]')?.focus();
            break;
          case 'r':
            e.preventDefault();
            handleRefresh();
            break;
          case 'd':
            e.preventDefault();
            setDarkMode(!darkMode);
            break;
          case 'f':
            e.preventDefault();
            if (activeTab === 'map') {
              setIsMapFullscreen(!isMapFullscreen);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [darkMode, isMapFullscreen, activeTab, handleRefresh]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        handleRefresh();
      }, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, handleRefresh]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus('online');
      addNotification('Connection restored', 'success');
    };
    
    const handleOffline = () => {
      setNetworkStatus('offline');
      addNotification('Connection lost - entering offline mode', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addNotification]);

  // Initialize D3 world map with enhanced features
  useEffect(() => {
    if (!d3Container.current || activeTab !== 'map') return;

    const width = d3Container.current.clientWidth;
    const height = isMapFullscreen 
      ? window.innerHeight - 100 
      : Math.min(900, Math.max(700, window.innerHeight - 250)); // Dynamic height with constraints

    d3.select(d3Container.current).selectAll("*").remove();

    const svg = d3.select(d3Container.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("background-color", darkMode ? "#000000" : "#f3f4f6")
      .style("display", "block")
      .style("margin", "0 auto");

    const g = svg.append("g");

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("padding", "10px")
      .style("background", darkMode ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)")
      .style("color", darkMode ? "white" : "black")
      .style("border", "1px solid #ccc")
      .style("border-radius", "5px")
      .style("pointer-events", "none");

    // Select projection based on user choice
    let projectionFunc;
    let scaleMultiplier = 1;
    switch (mapProjection) {
      case 'mercator':
        projectionFunc = d3.geoMercator();
        scaleMultiplier = 0.08;
        break;
      case 'equirectangular':
        projectionFunc = d3.geoEquirectangular();
        scaleMultiplier = 0.11;
        break;
      case 'robinson':
        projectionFunc = geoRobinson();
        scaleMultiplier = 0.11;
        break;
      case 'winkel3':
        projectionFunc = geoWinkel3();
        scaleMultiplier = 0.11;
        break;
      case 'eckert4':
        projectionFunc = geoEckert4();
        scaleMultiplier = 0.11;
        break;
      case 'orthographic':
        projectionFunc = d3.geoOrthographic();
        scaleMultiplier = 0.4;
        break;
      default:
        projectionFunc = d3.geoNaturalEarth1();
        scaleMultiplier = 0.08;
    }
    
    const projection = projectionFunc
      .scale(Math.min(width, height) * scaleMultiplier)
      .translate([width / 2, height / 2]);
      
    // Special handling for orthographic projection
    if (mapProjection === 'orthographic') {
      projection.clipAngle(90);
      
      // Enable rotation on drag
      let v0, q0, r0;
      
      function dragstarted(event) {
        v0 = d3.pointer(event);
        q0 = projection.rotate();
      }
      
      function dragged(event) {
        const v1 = d3.pointer(event);
        const r1 = [q0[0] + (v1[0] - v0[0]) * 0.5, q0[1] - (v1[1] - v0[1]) * 0.5];
        projection.rotate(r1);
        g.selectAll("path").attr("d", path);
      }
      
      if (mapProjection === 'orthographic') {
        svg.call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged));
      }
    }

    const path = d3.geoPath().projection(projection);

    const minZoom = mapProjection === 'orthographic' ? 0.8 : 0.5;
    const zoom = d3.zoom()
      .scaleExtent([minZoom, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Double-click to reset zoom
    svg.on("dblclick.zoom", () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    });

    // Add zoom controls
    const zoomIn = svg.append("g")
      .attr("transform", `translate(${width - 60}, 20)`)
      .style("cursor", "pointer")
      .on("click", () => svg.transition().call(zoom.scaleBy, 1.3));

    zoomIn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", darkMode ? "#1f2937" : "#e5e7eb")
      .attr("stroke", darkMode ? "#4b5563" : "#9ca3af");

    zoomIn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", darkMode ? "white" : "black")
      .text("+");
      
    zoomIn.append("title").text("Zoom In");

    const zoomOut = svg.append("g")
      .attr("transform", `translate(${width - 60}, 55)`)
      .style("cursor", "pointer")
      .on("click", () => svg.transition().call(zoom.scaleBy, 0.7));

    zoomOut.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", darkMode ? "#1f2937" : "#e5e7eb")
      .attr("stroke", darkMode ? "#4b5563" : "#9ca3af");

    zoomOut.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", darkMode ? "white" : "black")
      .text("-");
      
    zoomOut.append("title").text("Zoom Out");

    // Add reset zoom button
    const resetZoom = svg.append("g")
      .attr("transform", `translate(${width - 60}, 90)`)
      .style("cursor", "pointer")
      .on("click", () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));

    resetZoom.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", darkMode ? "#1f2937" : "#e5e7eb")
      .attr("stroke", darkMode ? "#4b5563" : "#9ca3af");

    resetZoom.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", darkMode ? "white" : "black")
      .attr("font-size", "12px")
      .text("⟲");
      
    resetZoom.append("title").text("Reset Zoom");
    
    // Add fit to window button
    const fitToWindow = svg.append("g")
      .attr("transform", `translate(${width - 60}, 125)`)
      .style("cursor", "pointer")
      .on("click", () => {
        // Reset to initial zoom that shows entire world
        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity.scale(0.9));
      });

    fitToWindow.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", darkMode ? "#1f2937" : "#e5e7eb")
      .attr("stroke", darkMode ? "#4b5563" : "#9ca3af");

    fitToWindow.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", darkMode ? "white" : "black")
      .attr("font-size", "12px")
      .text("⊡");
      
    fitToWindow.append("title").text("Fit to Window");

    // Load and render map
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((world) => {
      const countries = topojson.feature(world, world.objects.countries);

      g.selectAll("path")
        .data(countries.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", (d) => {
          const countryName = d.properties.name;
          const data = countryData[countryName];
          if (data) {
            if (data.riskLevel === 'high') return "#ef4444";
            if (data.riskLevel === 'medium') return "#f59e0b";
            return "#10b981";
          }
          return darkMode ? "#374151" : "#e5e7eb";
        })
        .attr("stroke", darkMode ? "#1f2937" : "#d1d5db")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
          const countryName = d.properties.name;
          const data = countryData[countryName];
          
          d3.select(this)
            .attr("stroke", "#ef4444")
            .attr("stroke-width", 2);
          
          tooltip.transition()
            .duration(200)
            .style("opacity", .9);
          
          tooltip.html(`
            <strong>${countryName}</strong><br/>
            ${data ? `
              Threats: ${data.threats}<br/>
              Risk: ${data.riskLevel}<br/>
              Trend: ${data.trend}
            ` : 'No data available'}
          `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
          d3.select(this)
            .attr("stroke", darkMode ? "#1f2937" : "#d1d5db")
            .attr("stroke-width", 0.5);
          
          tooltip.transition()
            .duration(500)
            .style("opacity", 0);
        })
        .on("click", function(event, d) {
          const countryName = d.properties.name;
          setSelectedCountry({
            name: countryName,
            data: countryData[countryName] || { 
              threats: 0, 
              incidents: 0, 
              riskLevel: 'low', 
              lastUpdate: 'No data',
              trend: 'stable',
              activeThreats: [],
              topTargets: [],
              mitigationStatus: 'N/A'
            }
          });
        });

      // Animated threat indicators
      const pulseData = Object.entries(countryData)
        .filter(([_, data]) => data.riskLevel === 'high')
        .map(([country, data]) => {
          const feature = countries.features.find(f => f.properties.name === country);
          return feature ? { country, data, centroid: path.centroid(feature) } : null;
        })
        .filter(Boolean);

      const pulses = g.selectAll("circle")
        .data(pulseData)
        .enter().append("circle")
        .attr("cx", d => d.centroid[0])
        .attr("cy", d => d.centroid[1])
        .attr("r", 5)
        .attr("fill", "none")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2)
        .attr("opacity", 0.8);

      function animatePulse() {
        pulses
          .attr("r", 5)
          .attr("opacity", 0.8)
          .transition()
          .duration(2000)
          .attr("r", 20)
          .attr("opacity", 0)
          .on("end", animatePulse);
      }
      animatePulse();
    });

    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };
  }, [activeTab, countryData, darkMode, isMapFullscreen, mapProjection]);

  // Enhanced incident data with more fields
  useEffect(() => {
    const generateIncidents = () => {
      const types = ['Cyber Attack', 'Data Breach', 'Malware', 'Phishing', 'Vulnerability', 'APT', 'Ransomware'];
      const statuses = ['Active', 'Contained', 'Resolved', 'Investigating'];
      const countries = Object.keys(countryData);
      
      const newIncidents = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        country: countries[Math.floor(Math.random() * countries.length)],
        type: types[Math.floor(Math.random() * types.length)],
        severity: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        description: `Security incident detected - ID: ${Math.random().toString(36).substr(2, 9)}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        affectedSystems: Math.floor(Math.random() * 100) + 1,
        responseTime: `${Math.floor(Math.random() * 60)} min`,
        assignedTo: ['Team Alpha', 'Team Beta', 'Team Gamma'][Math.floor(Math.random() * 3)]
      }));
      
      setIncidents(newIncidents);
    };
    
    generateIncidents();
  }, [countryData]);

  // Export functionality
  const exportData = (format) => {
    const data = {
      incidents: filteredIncidents,
      countryData,
      timestamp: new Date().toISOString(),
      filters
    };
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `osint-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addNotification('Data exported as JSON', 'success');
    } else if (format === 'csv') {
      const csv = [
        ['ID', 'Country', 'Type', 'Severity', 'Status', 'Timestamp', 'Description'],
        ...filteredIncidents.map(inc => [
          inc.id,
          inc.country,
          inc.type,
          inc.severity,
          inc.status,
          inc.timestamp,
          inc.description
        ])
      ].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incidents-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addNotification('Incidents exported as CSV', 'success');
    }
  };

  // Filter incidents
  const filteredIncidents = incidents.filter(incident => {
    if (filters.category !== 'all' && incident.type !== filters.category) return false;
    if (filters.threatLevel !== 'all' && incident.severity !== filters.threatLevel) return false;
    if (filters.country !== 'all' && incident.country !== filters.country) return false;
    if (searchQuery && !Object.values(incident).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    )) return false;
    
    const incidentTime = new Date(incident.timestamp);
    const now = new Date();
    const hoursDiff = (now - incidentTime) / (1000 * 60 * 60);
    
    switch(filters.timeRange) {
      case '1h':
        if (hoursDiff > 1) return false;
        break;
      case '24h':
        if (hoursDiff > 24) return false;
        break;
      case '7d':
        if (hoursDiff > 168) return false;
        break;
      case '30d':
        if (hoursDiff > 720) return false;
        break;
    }
    
    return true;
  });

  // View detailed report
  const viewDetailedReport = (country) => {
    const reportWindow = window.open('', '_blank');
    const reportData = countryData[country];
    
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OSINT Report - ${country}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #1a1a1a; color: white; }
          h1 { color: #ef4444; }
          .section { margin: 20px 0; padding: 15px; background: #2a2a2a; border-radius: 8px; }
          .metric { display: flex; justify-content: space-between; margin: 10px 0; }
          .high { color: #ef4444; }
          .medium { color: #f59e0b; }
          .low { color: #10b981; }
        </style>
      </head>
      <body>
        <h1>OSINT Detailed Report: ${country}</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <div class="section">
          <h2>Threat Overview</h2>
          <div class="metric"><span>Active Threats:</span> <strong>${reportData.threats}</strong></div>
          <div class="metric"><span>Recent Incidents:</span> <strong>${reportData.incidents}</strong></div>
          <div class="metric"><span>Risk Level:</span> <strong class="${reportData.riskLevel}">${reportData.riskLevel.toUpperCase()}</strong></div>
          <div class="metric"><span>Trend:</span> <strong>${reportData.trend}</strong></div>
          <div class="metric"><span>Last Update:</span> <strong>${reportData.lastUpdate}</strong></div>
        </div>
        
        <div class="section">
          <h2>Active Threats</h2>
          <ul>
            ${reportData.activeThreats.map(threat => `<li>${threat}</li>`).join('')}
          </ul>
        </div>
        
        <div class="section">
          <h2>Top Targets</h2>
          <ul>
            ${reportData.topTargets.map(target => `<li>${target}</li>`).join('')}
          </ul>
        </div>
        
        <div class="section">
          <h2>Mitigation Status</h2>
          <p>${reportData.mitigationStatus}</p>
        </div>
      </body>
      </html>
    `;
    
    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    addNotification(`Detailed report generated for ${country}`, 'success');
  };

  // Network Monitor Tool Component
  const NetworkMonitor = () => {
    const [packets, setPackets] = useState([]);
    const [isMonitoring, setIsMonitoring] = useState(false);
    
    useEffect(() => {
      if (isMonitoring) {
        const interval = setInterval(() => {
          const newPacket = {
            id: Date.now(),
            source: `192.168.1.${Math.floor(Math.random() * 255)}`,
            destination: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            protocol: ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'][Math.floor(Math.random() * 5)],
            size: Math.floor(Math.random() * 1500) + 100,
            timestamp: new Date().toLocaleTimeString()
          };
          setPackets(prev => [newPacket, ...prev].slice(0, 50));
        }, 500);
        
        return () => clearInterval(interval);
      }
    }, [isMonitoring]);
    
    return (
      <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Network Monitor</h2>
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              isMonitoring 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
        </div>
        
        <div className="mb-4">
          <select 
            className={`${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded px-3 py-1`}
            value={toolInputs.networkInterface}
            onChange={(e) => setToolInputs({...toolInputs, networkInterface: e.target.value})}
          >
            <option value="eth0">eth0</option>
            <option value="wlan0">wlan0</option>
            <option value="lo">lo (loopback)</option>
          </select>
        </div>
        
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className={`sticky top-0 ${darkMode ? 'bg-black' : 'bg-gray-100'}`}>
              <tr className={`border-b ${darkMode ? 'border-white/20' : 'border-gray-200'}`}>
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Source</th>
                <th className="text-left py-2">Destination</th>
                <th className="text-left py-2">Protocol</th>
                <th className="text-left py-2">Size</th>
              </tr>
            </thead>
            <tbody>
              {packets.map(packet => (
                <tr key={packet.id} className={`border-b ${darkMode ? 'border-white/10' : 'border-gray-100'}`}>
                  <td className="py-1">{packet.timestamp}</td>
                  <td className="py-1 font-mono text-xs">{packet.source}</td>
                  <td className="py-1 font-mono text-xs">{packet.destination}</td>
                  <td className="py-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      packet.protocol === 'HTTP' ? 'bg-yellow-500' :
                      packet.protocol === 'HTTPS' ? 'bg-green-500' :
                      'bg-blue-500'
                    } text-white`}>
                      {packet.protocol}
                    </span>
                  </td>
                  <td className="py-1">{packet.size} bytes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // API Integration Tool Component
  const APIIntegration = () => {
    const [apiStatus, setApiStatus] = useState('disconnected');
    const [apiLogs, setApiLogs] = useState([]);
    
    const testConnection = () => {
      setApiStatus('connecting');
      addNotification('Testing API connection...', 'info');
      
      setTimeout(() => {
        if (toolInputs.apiKey && toolInputs.apiEndpoint) {
          setApiStatus('connected');
          addNotification('API connection successful', 'success');
          setApiLogs(prev => [{
            timestamp: new Date().toISOString(),
            message: 'Successfully connected to API',
            type: 'success'
          }, ...prev]);
        } else {
          setApiStatus('error');
          addNotification('API connection failed - check credentials', 'error');
          setApiLogs(prev => [{
            timestamp: new Date().toISOString(),
            message: 'Connection failed - invalid credentials',
            type: 'error'
          }, ...prev]);
        }
      }, 2000);
    };
    
    return (
      <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
        <h2 className="text-2xl font-bold mb-4">API Integration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Endpoint</label>
              <input 
                type="text" 
                placeholder="https://api.example.com/v1/"
                className={`w-full px-4 py-2 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded-lg focus:outline-none focus:border-red-500`}
                value={toolInputs.apiEndpoint}
                onChange={(e) => setToolInputs({...toolInputs, apiEndpoint: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input 
                type="password" 
                placeholder="Enter your API key"
                className={`w-full px-4 py-2 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded-lg focus:outline-none focus:border-red-500`}
                value={toolInputs.apiKey}
                onChange={(e) => setToolInputs({...toolInputs, apiKey: e.target.value})}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={testConnection}
                className="bg-red-500 text-white font-semibold px-6 py-2 rounded hover:bg-red-600 transition-colors"
              >
                Test Connection
              </button>
              
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  apiStatus === 'connected' ? 'bg-green-500' :
                  apiStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  apiStatus === 'error' ? 'bg-red-500' :
                  'bg-gray-500'
                }`}></div>
                <span className="text-sm capitalize">{apiStatus}</span>
              </div>
            </div>
            
            {apiStatus === 'connected' && (
              <div className="space-y-3 pt-4 border-t border-white/20">
                <h3 className="font-semibold">Available Endpoints</h3>
                <div className="space-y-2">
                  <button className={`w-full text-left px-3 py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} rounded transition-colors`}>
                    <div className="font-semibold">/threats</div>
                    <div className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Get current threat intelligence</div>
                  </button>
                  <button className={`w-full text-left px-3 py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} rounded transition-colors`}>
                    <div className="font-semibold">/incidents</div>
                    <div className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Retrieve incident reports</div>
                  </button>
                  <button className={`w-full text-left px-3 py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} rounded transition-colors`}>
                    <div className="font-semibold">/ioc</div>
                    <div className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Search indicators of compromise</div>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="font-semibold mb-3">API Logs</h3>
            <div className={`${darkMode ? 'bg-black/50' : 'bg-gray-100'} rounded p-3 h-64 overflow-y-auto font-mono text-xs`}>
              {apiLogs.length === 0 ? (
                <div className={darkMode ? 'text-white/40' : 'text-gray-500'}>No logs yet...</div>
              ) : (
                apiLogs.map((log, idx) => (
                  <div key={idx} className={`mb-2 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    darkMode ? 'text-white/80' : 'text-gray-700'
                  }`}>
                    <span className={darkMode ? 'text-white/40' : 'text-gray-500'}>[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Settings Panel Component
  const SettingsPanel = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
      <div className={`${darkMode ? 'bg-gray-900 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6 max-w-md w-full`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Dashboard Settings</h2>
          <button onClick={() => setShowSettings(false)} className={darkMode ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-gray-900'}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Enable Notifications</span>
            <button
              onClick={() => setSettings({...settings, notifications: !settings.notifications})}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.notifications ? 'bg-red-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.notifications ? 'translate-x-6' : 'translate-x-0.5'
              }`}></div>
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Sound Alerts</span>
            <button
              onClick={() => setSettings({...settings, soundAlerts: !settings.soundAlerts})}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.soundAlerts ? 'bg-red-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.soundAlerts ? 'translate-x-6' : 'translate-x-0.5'
              }`}></div>
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Auto Export Reports</span>
            <button
              onClick={() => setSettings({...settings, autoExport: !settings.autoExport})}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.autoExport ? 'bg-red-500' : 'bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                settings.autoExport ? 'translate-x-6' : 'translate-x-0.5'
              }`}></div>
            </button>
          </div>
          
          <div>
            <label className="block text-sm mb-2">Data Retention (days)</label>
            <input
              type="number"
              value={settings.dataRetention}
              onChange={(e) => setSettings({...settings, dataRetention: parseInt(e.target.value)})}
              className={`w-full px-3 py-2 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded focus:outline-none focus:border-red-500`}
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2">Auto-refresh Interval (seconds)</label>
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              className={`w-full px-3 py-2 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded focus:outline-none focus:border-red-500`}
            />
          </div>
        </div>
        
        <button
          onClick={() => {
            setShowSettings(false);
            addNotification('Settings saved', 'success');
          }}
          className="w-full mt-6 bg-red-500 text-white font-semibold py-2 rounded hover:bg-red-600 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-black border-b border-white/20' : 'bg-white border-b border-gray-200 shadow'}`}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-bold">OSINT Dashboard</h1>
              {networkStatus === 'offline' && (
                <div className="flex items-center space-x-2 text-yellow-500">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm">Offline Mode</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search countries, threats, incidents..."
                  className={`pl-10 pr-4 py-2 ${
                    darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'
                  } border rounded-lg focus:outline-none focus:border-red-500 text-sm w-64`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors relative"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                
                {showNotifications && (
                  <div className={`absolute right-0 mt-2 w-80 ${
                    darkMode ? 'bg-gray-900' : 'bg-white'
                  } border ${
                    darkMode ? 'border-white/20' : 'border-gray-200'
                  } rounded-lg shadow-xl z-50`}>
                    <div className="p-4">
                      <h3 className="font-semibold mb-3">Notifications</h3>
                      {notifications.length === 0 ? (
                        <p className="text-sm text-gray-500">No new notifications</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {notifications.map(notif => (
                            <div key={notif.id} className={`p-2 rounded ${
                              notif.type === 'error' ? 'bg-red-500/20' :
                              notif.type === 'success' ? 'bg-green-500/20' :
                              'bg-blue-500/20'
                            }`}>
                              <p className="text-sm">{notif.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(notif.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleRefresh}
                className={`p-2 ${isLoading ? 'animate-spin' : ''} hover:bg-white/10 rounded-lg transition-colors`}
                disabled={isLoading}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              <Terminal className="w-6 h-6 text-gray-400 cursor-pointer hover:text-red-500" />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className={`${darkMode ? 'bg-black border-b border-white/20' : 'bg-white border-b border-gray-200'}`}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['map', 'incidents', 'analytics', 'tools'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-red-500 text-red-500'
                    : `border-transparent ${darkMode ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                }`}
              >
                <div className="flex items-center space-x-2">
                  {tab === 'map' && <Map className="w-4 h-4" />}
                  {tab === 'incidents' && <AlertCircle className="w-4 h-4" />}
                  {tab === 'analytics' && <BarChart3 className="w-4 h-4" />}
                  {tab === 'tools' && <Database className="w-4 h-4" />}
                  <span className="capitalize">{tab}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-2" style={{ minHeight: 'calc(100vh - 150px)' }}>
        {activeTab === 'map' && (
          <div className={isMapFullscreen ? "fixed inset-0 z-50 bg-black" : "grid grid-cols-1 xl:grid-cols-6 gap-6"} style={{ maxWidth: isMapFullscreen ? '100%' : '2000px', margin: '0 auto' }}>
            {/* Map Container */}
            <div className={isMapFullscreen ? "w-full h-full" : "xl:col-span-5"}>
              <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-4 pb-8 ${isMapFullscreen ? 'h-full' : ''} relative overflow-hidden`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Global Threat Map</h2>
                    <p className={`text-xs ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>
                      Use mouse wheel to zoom • Double-click to reset • Ctrl+F for fullscreen • Try different projections for better views
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <select
                      value={mapProjection}
                      onChange={(e) => setMapProjection(e.target.value)}
                      className={`${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded px-2 py-1 text-sm`}
                      title="Change map projection"
                    >
                      <option value="natural">Natural Earth</option>
                      <option value="mercator">Mercator</option>
                      <option value="equirectangular">Equirectangular</option>
                      <option value="robinson">Robinson</option>
                      <option value="winkel3">Winkel Tripel</option>
                      <option value="eckert4">Eckert IV</option>
                      <option value="orthographic">Globe View</option>
                    </select>
                    <button
                      onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title={isMapFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                      {isMapFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setShowMapHelp(!showMapHelp)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Show map help"
                    >
                      <HelpCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        // Save map as image
                        const svgElement = d3Container.current.querySelector('svg');
                        if (svgElement) {
                          const svgData = new XMLSerializer().serializeToString(svgElement);
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          const img = new Image();
                          canvas.width = svgElement.width.baseVal.value;
                          canvas.height = svgElement.height.baseVal.value;
                          img.onload = () => {
                            ctx.drawImage(img, 0, 0);
                            canvas.toBlob((blob) => {
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `osint-map-${Date.now()}.png`;
                              a.click();
                              URL.revokeObjectURL(url);
                            });
                          };
                          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                          addNotification('Map saved as image', 'success');
                        }
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Save map as image"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm">Auto-refresh</label>
                      <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          autoRefresh ? 'bg-red-500' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          autoRefresh ? 'translate-x-6' : 'translate-x-0.5'
                        }`}></div>
                      </button>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>High Risk</span>
                      <span className="flex items-center"><span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>Medium Risk</span>
                      <span className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>Low Risk</span>
                    </div>
                  </div>
                </div>
                <div ref={d3Container} className={`w-full ${isMapFullscreen ? 'h-[calc(100vh-100px)]' : 'h-[calc(100vh-250px)]'}`} style={{ minHeight: '900px' }}></div>
                
                {/* Map Help Overlay */}
                {showMapHelp && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40 rounded-lg">
                    <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} p-6 rounded-lg max-w-md`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Map Controls</h3>
                        <button onClick={() => setShowMapHelp(false)} className="text-gray-500 hover:text-gray-700">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold">🖱️</span>
                          </div>
                          <div>
                            <div className="font-semibold">Mouse Controls</div>
                            <div className={darkMode ? 'text-white/60' : 'text-gray-600'}>
                              • Scroll to zoom in/out<br/>
                              • Click and drag to pan<br/>
                              • Click country for details<br/>
                              • Double-click to reset view<br/>
                              • Globe View: Drag to rotate Earth
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold">⌨️</span>
                          </div>
                          <div>
                            <div className="font-semibold">Keyboard Shortcuts</div>
                            <div className={darkMode ? 'text-white/60' : 'text-gray-600'}>
                              • Ctrl+F: Toggle fullscreen<br/>
                              • Escape: Exit fullscreen<br/>
                              • +/-: Zoom in/out
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold">🗺️</span>
                          </div>
                          <div>
                            <div className="font-semibold">Map Projections</div>
                            <div className={darkMode ? 'text-white/60' : 'text-gray-600'}>
                              • Natural Earth: Balanced view<br/>
                              • Mercator: Navigation accurate<br/>
                              • Robinson: Aesthetic compromise<br/>
                              • Winkel Tripel: Low distortion<br/>
                              • Eckert IV: Equal-area<br/>
                              • Equirectangular: Simple grid<br/>
                              • Globe View: 3D Earth (drag to rotate)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Country Details Sidebar */}
            {!isMapFullscreen && (
              <div className="xl:col-span-1">
                <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-4`}>
                  <h3 className="text-lg font-semibold mb-4">Country Details</h3>
                  {selectedCountry ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xl font-bold text-red-500">{selectedCountry.name}</h4>
                        <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>
                          Last updated: {selectedCountry.data.lastUpdate}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Active Threats:</span>
                          <span className="font-semibold">{selectedCountry.data.threats}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Incidents (24h):</span>
                          <span className="font-semibold">{selectedCountry.data.incidents}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Risk Level:</span>
                          <span className={`font-semibold capitalize ${
                            selectedCountry.data.riskLevel === 'high' ? 'text-red-500' :
                            selectedCountry.data.riskLevel === 'medium' ? 'text-yellow-500' :
                            'text-green-500'
                          }`}>{selectedCountry.data.riskLevel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Trend:</span>
                          <span className="font-semibold flex items-center">
                            {selectedCountry.data.trend}
                            {selectedCountry.data.trend === 'increasing' && <TrendingUp className="w-4 h-4 ml-1 text-red-500" />}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Status:</span>
                          <span className="font-semibold">{selectedCountry.data.mitigationStatus}</span>
                        </div>
                      </div>
                      
                      {/* Active Threats */}
                      <div>
                        <h5 className="font-semibold mb-2">Active Threats</h5>
                        <div className="space-y-1">
                          {selectedCountry.data.activeThreats.map((threat, idx) => (
                            <div key={idx} className="text-sm bg-red-500/20 px-2 py-1 rounded">
                              {threat}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Top Targets */}
                      <div>
                        <h5 className="font-semibold mb-2">Top Targets</h5>
                        <div className="space-y-1">
                          {selectedCountry.data.topTargets.map((target, idx) => (
                            <div key={idx} className="text-sm bg-yellow-500/20 px-2 py-1 rounded">
                              {target}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => viewDetailedReport(selectedCountry.name)}
                        className="w-full bg-red-500 text-white font-semibold py-2 rounded hover:bg-red-600 transition-colors"
                      >
                        View Detailed Report
                      </button>
                    </div>
                  ) : (
                    <p className={`${darkMode ? 'text-white/60' : 'text-gray-600'} text-center py-8`}>
                      Select a country to view details
                    </p>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="mt-6 space-y-4">
                  <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Global Threats</p>
                        <p className="text-2xl font-bold text-red-500">
                          {Object.values(countryData).reduce((sum, c) => sum + c.threats, 0)}
                        </p>
                      </div>
                      <Activity className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                  <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Active Monitors</p>
                        <p className="text-2xl font-bold text-red-500">12</p>
                      </div>
                      <Globe className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'incidents' && (
          <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-4`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Incidents ({filteredIncidents.length})</h2>
              <div className="flex items-center space-x-4">
                {/* Export buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => exportData('json')}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors flex items-center space-x-1"
                  >
                    <Download className="w-4 h-4" />
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => exportData('csv')}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors flex items-center space-x-1"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                </div>
                
                {/* Filters */}
                <select
                  className={`${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded px-3 py-1 text-sm focus:outline-none focus:border-red-500`}
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                >
                  <option value="all">All Categories</option>
                  <option value="Cyber Attack">Cyber Attack</option>
                  <option value="Data Breach">Data Breach</option>
                  <option value="Malware">Malware</option>
                  <option value="Phishing">Phishing</option>
                  <option value="Vulnerability">Vulnerability</option>
                  <option value="APT">APT</option>
                  <option value="Ransomware">Ransomware</option>
                </select>
                <select
                  className={`${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded px-3 py-1 text-sm focus:outline-none focus:border-red-500`}
                  value={filters.threatLevel}
                  onChange={(e) => setFilters({...filters, threatLevel: e.target.value})}
                >
                  <option value="all">All Levels</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  className={`${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded px-3 py-1 text-sm focus:outline-none focus:border-red-500`}
                  value={filters.timeRange}
                  onChange={(e) => setFilters({...filters, timeRange: e.target.value})}
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
                <select
                  className={`${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded px-3 py-1 text-sm focus:outline-none focus:border-red-500`}
                  value={filters.country}
                  onChange={(e) => setFilters({...filters, country: e.target.value})}
                >
                  <option value="all">All Countries</option>
                  {Object.keys(countryData).map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? 'border-white/20' : 'border-gray-200'}`}>
                    <th className="text-left py-3 px-4">
                      <input 
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIncidents(filteredIncidents.map(i => i.id));
                          } else {
                            setSelectedIncidents([]);
                          }
                        }}
                      />
                    </th>
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Country</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Severity</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Timestamp</th>
                    <th className="text-left py-3 px-4">Response Time</th>
                    <th className="text-left py-3 px-4">Assigned To</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map((incident) => (
                    <tr key={incident.id} className={`border-b ${darkMode ? 'border-white/10 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className="py-3 px-4">
                        <input 
                          type="checkbox"
                          checked={selectedIncidents.includes(incident.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIncidents([...selectedIncidents, incident.id]);
                            } else {
                              setSelectedIncidents(selectedIncidents.filter(id => id !== incident.id));
                            }
                          }}
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">#{incident.id}</td>
                      <td className="py-3 px-4">{incident.country}</td>
                      <td className="py-3 px-4">{incident.type}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          incident.severity === 'high' ? 'bg-red-500 text-white' :
                          incident.severity === 'medium' ? 'bg-yellow-500 text-black' :
                          'bg-green-500 text-white'
                        }`}>
                          {incident.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          incident.status === 'Active' ? 'bg-red-500 text-white' :
                          incident.status === 'Investigating' ? 'bg-yellow-500 text-black' :
                          incident.status === 'Contained' ? 'bg-blue-500 text-white' :
                          'bg-green-500 text-white'
                        }`}>
                          {incident.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{new Date(incident.timestamp).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm">{incident.responseTime}</td>
                      <td className="py-3 px-4 text-sm">{incident.assignedTo}</td>
                      <td className="py-3 px-4">
                        <button className="text-red-500 hover:text-red-600">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {selectedIncidents.length > 0 && (
              <div className="mt-4 p-4 bg-blue-500/20 rounded flex items-center justify-between">
                <span>{selectedIncidents.length} incidents selected</span>
                <div className="space-x-2">
                  <button className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">
                    Mark as Resolved
                  </button>
                  <button className="px-3 py-1 bg-yellow-500 text-black rounded text-sm hover:bg-yellow-600">
                    Escalate
                  </button>
                  <button 
                    onClick={() => setSelectedIncidents([])}
                    className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Threat Distribution */}
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h3 className="text-lg font-semibold mb-4">Threat Distribution by Country</h3>
              <div className="space-y-4">
                {Object.entries(countryData)
                  .sort((a, b) => b[1].threats - a[1].threats)
                  .slice(0, 5)
                  .map(([country, data]) => (
                  <div key={country}>
                    <div className="flex justify-between mb-1">
                      <span>{country}</span>
                      <span className="font-semibold">{data.threats}</span>
                    </div>
                    <div className={`w-full ${darkMode ? 'bg-white/10' : 'bg-gray-200'} rounded-full h-2`}>
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(data.threats / 45) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Incident Timeline */}
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h3 className="text-lg font-semibold mb-4">Incident Timeline (7 Days)</h3>
              <div className="h-64 flex items-end justify-between space-x-2">
                {[65, 45, 80, 35, 90, 70, 55].map((height, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div className="text-xs mb-2">{height}</div>
                    <div
                      className="bg-red-500 rounded-t w-full transition-all duration-500 hover:bg-red-600"
                      style={{ height: `${height}%` }}
                    ></div>
                    <p className="text-xs text-center mt-2">Day {i + 1}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Threat Types */}
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h3 className="text-lg font-semibold mb-4">Threat Types</h3>
              <div className="space-y-3">
                {[
                  { type: 'Ransomware', count: 23, color: 'bg-red-500' },
                  { type: 'Phishing', count: 18, color: 'bg-yellow-500' },
                  { type: 'DDoS', count: 15, color: 'bg-orange-500' },
                  { type: 'Malware', count: 12, color: 'bg-purple-500' },
                  { type: 'APT', count: 8, color: 'bg-blue-500' }
                ].map((threat) => (
                  <div key={threat.type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${threat.color}`}></div>
                      <span>{threat.type}</span>
                    </div>
                    <span className="font-semibold">{threat.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex justify-between text-sm">
                  <span>Total Active Threats</span>
                  <span className="font-bold text-red-500">76</span>
                </div>
              </div>
            </div>
            
            {/* Risk Trend */}
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h3 className="text-lg font-semibold mb-4">Risk Trend (30 Days)</h3>
              <div className="h-48">
                <svg className="w-full h-full">
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    points="0,150 50,120 100,130 150,90 200,100 250,60 300,70 350,40"
                  />
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    points="0,180 50,160 100,165 150,140 200,145 250,120 300,125 350,110"
                  />
                </svg>
              </div>
              <div className="flex items-center justify-center space-x-4 mt-4 text-sm">
                <span className="flex items-center"><span className="w-4 h-0.5 bg-red-500 mr-2"></span>High Risk</span>
                <span className="flex items-center"><span className="w-4 h-0.5 bg-yellow-500 mr-2" style={{borderTop: '2px dashed'}}></span>Medium Risk</span>
              </div>
            </div>
            
            {/* Response Times */}
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h3 className="text-lg font-semibold mb-4">Average Response Times</h3>
              <div className="space-y-4">
                {[
                  { team: 'Team Alpha', time: 12, benchmark: 15 },
                  { team: 'Team Beta', time: 18, benchmark: 15 },
                  { team: 'Team Gamma', time: 10, benchmark: 15 }
                ].map((team) => (
                  <div key={team.team}>
                    <div className="flex justify-between mb-1">
                      <span>{team.team}</span>
                      <span className={team.time <= team.benchmark ? 'text-green-500' : 'text-red-500'}>
                        {team.time} min
                      </span>
                    </div>
                    <div className="relative">
                      <div className={`w-full ${darkMode ? 'bg-white/10' : 'bg-gray-200'} rounded-full h-2`}>
                        <div
                          className={`h-2 rounded-full ${team.time <= team.benchmark ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${(team.time / 30) * 100}%` }}
                        ></div>
                      </div>
                      <div 
                        className="absolute top-0 w-0.5 h-2 bg-yellow-500"
                        style={{ left: `${(team.benchmark / 30) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-yellow-500">
                <span>Benchmark: 15 minutes</span>
              </div>
            </div>
            
            {/* Active Alerts */}
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h3 className="text-lg font-semibold mb-4">Active Alerts</h3>
              <div className="space-y-3">
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="font-semibold">Critical</span>
                    </div>
                    <span className="text-2xl font-bold">3</span>
                  </div>
                </div>
                <div className="p-3 bg-yellow-500/20 border border-yellow-500/50 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold">Warning</span>
                    </div>
                    <span className="text-2xl font-bold">8</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-500/20 border border-blue-500/50 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Info className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold">Info</span>
                    </div>
                    <span className="text-2xl font-bold">15</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && !activeTool && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'IP Lookup', icon: Globe, description: 'Geolocate and analyze IP addresses', id: 'ip-lookup' },
              { name: 'Domain Scanner', icon: Shield, description: 'Scan domains for threats and vulnerabilities', id: 'domain-scanner' },
              { name: 'Hash Analyzer', icon: Database, description: 'Analyze file hashes against threat databases', id: 'hash-analyzer' },
              { name: 'Network Monitor', icon: Activity, description: 'Real-time network traffic analysis', id: 'network-monitor' },
              { name: 'Threat Intel Feed', icon: AlertCircle, description: 'Subscribe to threat intelligence feeds', id: 'threat-feed' },
              { name: 'API Integration', icon: Terminal, description: 'Connect to external OSINT APIs', id: 'api-integration' }
            ].map((tool) => (
              <div 
                key={tool.name} 
                className={`${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-white border-gray-200 hover:border-red-500 hover:shadow-lg'} border rounded-lg p-6 transition-all cursor-pointer`}
                onClick={() => setActiveTool(tool.id)}
              >
                <tool.icon className="w-8 h-8 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{tool.name}</h3>
                <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>{tool.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* IP Lookup Tool */}
        {activeTab === 'tools' && activeTool === 'ip-lookup' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button onClick={() => setActiveTool(null)} className="text-red-500 hover:text-red-600 flex items-center space-x-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Tools</span>
              </button>
            </div>
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h2 className="text-2xl font-bold mb-4">IP Address Lookup</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Enter IP Address</label>
                  <input 
                    type="text" 
                    placeholder="e.g., 8.8.8.8"
                    className={`w-full px-4 py-2 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded-lg focus:outline-none focus:border-red-500`}
                    value={toolInputs.ip}
                    onChange={(e) => setToolInputs({...toolInputs, ip: e.target.value})}
                  />
                </div>
                <button 
                  onClick={() => {
                    const ip = toolInputs.ip;
                    if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
                      addNotification('Please enter a valid IP address', 'error');
                      return;
                    }
                    setToolResults({
                      ...toolResults,
                      ip: { 
                        address: ip, 
                        timestamp: new Date().toISOString(),
                        location: 'United States, California',
                        isp: 'Google LLC',
                        asn: 'AS15169',
                        threatScore: Math.floor(Math.random() * 100),
                        lastSeen: new Date(Date.now() - Math.random() * 86400000).toISOString()
                      }
                    });
                    setAnalysisHistory([
                      { type: 'IP', value: ip, timestamp: new Date().toISOString() },
                      ...analysisHistory
                    ]);
                  }}
                  className="bg-red-500 text-white font-semibold px-6 py-2 rounded hover:bg-red-600 transition-colors"
                >
                  Lookup IP
                </button>
                {toolResults.ip && (
                  <div className={`mt-6 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-gray-50 border-gray-200'} border rounded p-4`}>
                    <h3 className="font-semibold mb-3">IP Analysis Results</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>IP Address:</span>
                        <p className="font-mono">{toolResults.ip.address}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>ISP:</span>
                        <p>{toolResults.ip.isp}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>ASN:</span>
                        <p>{toolResults.ip.asn}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Threat Score:</span>
                        <p className={`font-bold ${
                          toolResults.ip.threatScore > 70 ? 'text-red-500' :
                          toolResults.ip.threatScore > 40 ? 'text-yellow-500' :
                          'text-green-500'
                        }`}>{toolResults.ip.threatScore}/100</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Last Seen:</span>
                        <p>{new Date(toolResults.ip.lastSeen).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>External lookups:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={`https://www.abuseipdb.com/check/${toolResults.ip.address}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>AbuseIPDB</span>
                        </a>
                        <a href={`https://www.virustotal.com/gui/ip-address/${toolResults.ip.address}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>VirusTotal</span>
                        </a>
                        <a href={`https://otx.alienvault.com/indicator/ip/${toolResults.ip.address}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>AlienVault OTX</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Domain Scanner Tool */}
        {activeTab === 'tools' && activeTool === 'domain-scanner' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button onClick={() => setActiveTool(null)} className="text-red-500 hover:text-red-600 flex items-center space-x-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Tools</span>
              </button>
            </div>
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h2 className="text-2xl font-bold mb-4">Domain Scanner</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Enter Domain</label>
                  <input 
                    type="text" 
                    placeholder="e.g., example.com"
                    className={`w-full px-4 py-2 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded-lg focus:outline-none focus:border-red-500`}
                    value={toolInputs.domain}
                    onChange={(e) => setToolInputs({...toolInputs, domain: e.target.value})}
                  />
                </div>
                <button 
                  onClick={() => {
                    const domain = toolInputs.domain;
                    if (!domain) {
                      addNotification('Please enter a domain', 'error');
                      return;
                    }
                    setToolResults({
                      ...toolResults,
                      domain: { 
                        name: domain, 
                        timestamp: new Date().toISOString(),
                        status: 'Active',
                        ssl: 'Valid',
                        reputation: 'Clean',
                        registrar: 'Example Registrar Inc.',
                        created: '2015-03-15',
                        expires: '2025-03-15',
                        nameservers: ['ns1.example.com', 'ns2.example.com']
                      }
                    });
                    setAnalysisHistory([
                      { type: 'Domain', value: domain, timestamp: new Date().toISOString() },
                      ...analysisHistory
                    ]);
                  }}
                  className="bg-red-500 text-white font-semibold px-6 py-2 rounded hover:bg-red-600 transition-colors"
                >
                  Scan Domain
                </button>
                {toolResults.domain && (
                  <div className={`mt-6 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-gray-50 border-gray-200'} border rounded p-4`}>
                    <h3 className="font-semibold mb-3">Domain Scan Results</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Domain:</span>
                        <p className="font-mono">{toolResults.domain.name}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Status:</span>
                        <p className="text-green-500 font-semibold">{toolResults.domain.status}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>SSL Certificate:</span>
                        <p className="text-green-500">{toolResults.domain.ssl}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Reputation:</span>
                        <p className="text-green-500">{toolResults.domain.reputation}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Registrar:</span>
                        <p>{toolResults.domain.registrar}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Created:</span>
                        <p>{toolResults.domain.created}</p>
                      </div>
                      <div className="col-span-2">
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Nameservers:</span>
                        <p className="font-mono text-sm">{toolResults.domain.nameservers.join(', ')}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Check this domain on:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={`https://www.virustotal.com/gui/domain/${toolResults.domain.name}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>VirusTotal</span>
                        </a>
                        <a href={`https://urlvoid.com/scan/${toolResults.domain.name}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>URLVoid</span>
                        </a>
                        <a href={`https://www.shodan.io/search?query=${toolResults.domain.name}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>Shodan</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hash Analyzer Tool */}
        {activeTab === 'tools' && activeTool === 'hash-analyzer' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button onClick={() => setActiveTool(null)} className="text-red-500 hover:text-red-600 flex items-center space-x-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Tools</span>
              </button>
            </div>
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h2 className="text-2xl font-bold mb-4">File Hash Analyzer</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Enter File Hash (MD5, SHA1, SHA256)</label>
                  <textarea 
                    placeholder="e.g., d41d8cd98f00b204e9800998ecf8427e"
                    className={`w-full px-4 py-2 ${darkMode ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'} border rounded-lg focus:outline-none focus:border-red-500 font-mono text-sm`}
                    rows="3"
                    value={toolInputs.hash}
                    onChange={(e) => setToolInputs({...toolInputs, hash: e.target.value})}
                  />
                </div>
                <button 
                  onClick={() => {
                    const hash = toolInputs.hash.trim();
                    if (!hash) {
                      addNotification('Please enter a file hash', 'error');
                      return;
                    }
                    const hashType = hash.length === 32 ? 'MD5' : 
                                   hash.length === 40 ? 'SHA1' : 
                                   hash.length === 64 ? 'SHA256' : 'Unknown';
                    
                    const isMalicious = Math.random() > 0.7;
                    setToolResults({
                      ...toolResults,
                      hash: { 
                        value: hash, 
                        type: hashType, 
                        timestamp: new Date().toISOString(),
                        status: isMalicious ? 'Malicious' : 'Clean',
                        detections: isMalicious ? Math.floor(Math.random() * 50) + 10 : 0,
                        totalEngines: 70,
                        firstSeen: new Date(Date.now() - Math.random() * 31536000000).toISOString(),
                        fileType: 'PE32 executable',
                        fileSize: Math.floor(Math.random() * 10000000) + ' bytes'
                      }
                    });
                    setAnalysisHistory([
                      { type: 'Hash', value: hash.substring(0, 16) + '...', timestamp: new Date().toISOString() },
                      ...analysisHistory
                    ]);
                  }}
                  className="bg-red-500 text-white font-semibold px-6 py-2 rounded hover:bg-red-600 transition-colors"
                >
                  Analyze Hash
                </button>
                {toolResults.hash && (
                  <div className={`mt-6 ${darkMode ? 'bg-white/5 border-white/20' : 'bg-gray-50 border-gray-200'} border rounded p-4`}>
                    <h3 className="font-semibold mb-3">Hash Analysis Results</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Hash:</span>
                        <p className="font-mono text-xs break-all">{toolResults.hash.value}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Type:</span>
                        <p>{toolResults.hash.type}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Status:</span>
                        <p className={`font-semibold ${
                          toolResults.hash.status === 'Malicious' ? 'text-red-500' : 'text-green-500'
                        }`}>{toolResults.hash.status}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>Detection Rate:</span>
                        <p className={toolResults.hash.detections > 0 ? 'text-red-500' : 'text-green-500'}>
                          {toolResults.hash.detections}/{toolResults.hash.totalEngines}
                        </p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>File Type:</span>
                        <p>{toolResults.hash.fileType}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>File Size:</span>
                        <p>{toolResults.hash.fileSize}</p>
                      </div>
                      <div>
                        <span className={darkMode ? 'text-white/60' : 'text-gray-600'}>First Seen:</span>
                        <p>{new Date(toolResults.hash.firstSeen).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Analyze this hash on:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={`https://www.virustotal.com/gui/file/${toolResults.hash.value}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>VirusTotal</span>
                        </a>
                        <a href={`https://www.hybrid-analysis.com/search?query=${toolResults.hash.value}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>Hybrid Analysis</span>
                        </a>
                        <a href={`https://otx.alienvault.com/indicator/file/${toolResults.hash.value}`} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 text-sm flex items-center space-x-1">
                          <ExternalLink className="w-3 h-3" />
                          <span>AlienVault OTX</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Analysis History */}
              {analysisHistory.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Recent Analysis History</h3>
                  <div className="space-y-2">
                    {analysisHistory.slice(0, 5).map((item, idx) => (
                      <div key={idx} className={`p-2 ${darkMode ? 'bg-white/5' : 'bg-gray-100'} rounded flex items-center justify-between`}>
                        <div>
                          <span className="text-sm font-medium">{item.type}:</span>
                          <span className="text-sm ml-2 font-mono">{item.value}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Network Monitor Tool */}
        {activeTab === 'tools' && activeTool === 'network-monitor' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <button onClick={() => setActiveTool(null)} className="text-red-500 hover:text-red-600 flex items-center space-x-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Tools</span>
              </button>
            </div>
            <NetworkMonitor />
          </div>
        )}

        {/* API Integration Tool */}
        {activeTab === 'tools' && activeTool === 'api-integration' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <button onClick={() => setActiveTool(null)} className="text-red-500 hover:text-red-600 flex items-center space-x-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Tools</span>
              </button>
            </div>
            <APIIntegration />
          </div>
        )}

        {/* Threat Intel Feed */}
        {activeTab === 'tools' && activeTool === 'threat-feed' && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <button onClick={() => setActiveTool(null)} className="text-red-500 hover:text-red-600 flex items-center space-x-2">
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Tools</span>
              </button>
            </div>
            <div className={`${darkMode ? 'bg-white/5 border-white/20' : 'bg-white border-gray-200'} border rounded-lg p-6`}>
              <h2 className="text-2xl font-bold mb-6">Threat Intelligence Feeds</h2>
              
              {/* Popular OSINT Feeds */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-500">Popular OSINT Feeds</h3>
                  <div className="space-y-3">
                    <a href="https://otx.alienvault.com/" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">AlienVault OTX</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Open Threat Exchange - collaborative threat intelligence</p>
                    </a>
                    <a href="https://www.abuseipdb.com/" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">AbuseIPDB</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>IP address threat intelligence</p>
                    </a>
                    <a href="https://threatfeeds.io/" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">ThreatFeeds.io</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Aggregated threat intelligence feeds</p>
                    </a>
                    <a href="https://www.virustotal.com/" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">VirusTotal</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>File and URL analysis</p>
                    </a>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-red-500">Government & Security Feeds</h3>
                  <div className="space-y-3">
                    <a href="https://www.cisa.gov/news-events/cybersecurity-advisories" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">CISA Advisories</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>US Cybersecurity & Infrastructure Security Agency</p>
                    </a>
                    <a href="https://www.us-cert.gov/ncas/alerts" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">US-CERT Alerts</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>United States Computer Emergency Readiness Team</p>
                    </a>
                    <a href="https://github.com/mitre/cti" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">MITRE ATT&CK</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Adversarial tactics and techniques</p>
                    </a>
                    <a href="https://urlhaus.abuse.ch/" target="_blank" rel="noopener noreferrer" className={`block p-4 ${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded transition-colors`}>
                      <h4 className="font-semibold">URLhaus</h4>
                      <p className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>Malware URL exchange</p>
                    </a>
                  </div>
                </div>
              </div>

              {/* Live Feed Display */}
              <div className="border-t border-white/20 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Recent Threat Activity</h3>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                    <span className="text-sm text-yellow-500">Live Feed</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { time: '2 min ago', type: 'Malware', description: 'New ransomware variant detected in Eastern Europe', severity: 'high', source: 'AlienVault OTX' },
                    { time: '5 min ago', type: 'Phishing', description: 'Banking phishing campaign targeting US customers', severity: 'medium', source: 'US-CERT' },
                    { time: '12 min ago', type: 'Vulnerability', description: 'Critical RCE vulnerability in popular CMS', severity: 'high', source: 'CISA' },
                    { time: '18 min ago', type: 'Botnet', description: 'Mirai variant spreading through IoT devices', severity: 'medium', source: 'URLhaus' },
                    { time: '25 min ago', type: 'Data Breach', description: 'Healthcare provider reports patient data exposure', severity: 'high', source: 'Have I Been Pwned' },
                    { time: '32 min ago', type: 'APT', description: 'APT group activity detected targeting critical infrastructure', severity: 'high', source: 'MITRE ATT&CK' }
                  ].map((threat, index) => (
                    <div key={index} className={`${darkMode ? 'bg-white/5 border-white/20 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-500'} border rounded p-3 transition-colors`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-3">
                          <span className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>{threat.time}</span>
                          <span className="text-xs text-blue-500">{threat.source}</span>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          threat.severity === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                        } text-white`}>
                          {threat.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="font-semibold">{threat.type}</div>
                      <div className={`text-sm ${darkMode ? 'text-white/80' : 'text-gray-700'}`}>{threat.description}</div>
                    </div>
                  ))}
                </div>
                
                <button className="w-full mt-4 py-2 bg-red-500/20 border border-red-500/50 rounded hover:bg-red-500/30 transition-colors">
                  Load More Threats
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer with enhanced information */}
      <footer className={`${darkMode ? 'bg-black border-t border-white/20' : 'bg-white border-t border-gray-200'} mt-12`}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>
                <span className="font-semibold">Keyboard Shortcuts:</span>
                <div className="mt-1 space-y-1">
                  <div>Ctrl+1 (Map) • Ctrl+2 (Incidents) • Ctrl+3 (Analytics) • Ctrl+4 (Tools)</div>
                  <div>Ctrl+K (Search) • Ctrl+R (Refresh) • Ctrl+D (Toggle Theme) • Ctrl+F (Fullscreen Map)</div>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>
                <div className="flex items-center justify-center space-x-4">
                  <span>Data Source: {dataSource === 'live' ? 'Live' : 'Cached'}</span>
                  <span>•</span>
                  <span className="flex items-center">
                    {networkStatus === 'online' ? (
                      <>
                        <Wifi className="w-4 h-4 mr-1 text-green-500" />
                        Online
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 mr-1 text-red-500" />
                        Offline
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm ${darkMode ? 'text-white/60' : 'text-gray-600'}`}>
                OSINT Dashboard v2.0 - Enhanced Edition
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Settings Panel Overlay */}
      {showSettings && <SettingsPanel />}
    </div>
  );
};

export default OSINTDashboard;