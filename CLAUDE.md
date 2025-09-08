# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an OSINT (Open Source Intelligence) Dashboard built with React - a comprehensive web application for security intelligence analysis and threat monitoring. The application provides defensive security capabilities including threat visualization, incident tracking, and security data analysis.

## Development Commands

### Core Commands
- `npm start` - Start development server (runs on http://localhost:3000)
- `npm test` - Run test suite in interactive watch mode
- `npm run build` - Build production bundle to `build/` folder
- `npm run eject` - Eject from Create React App (one-way operation)

### Dependencies Management
- `npm install` - Install all dependencies
- Key dependencies include React 19.1.0, D3.js for data visualization, and Tailwind CSS for styling

## Architecture

### Core Structure
- **Single-page React application** built with Create React App
- **Main component**: `OSINTDashboard` in `src/App.js` (~2300 lines)
- **Styling**: Tailwind CSS with dark/light mode support
- **Visualization**: D3.js for interactive maps and charts
- **Geography**: Uses d3-geo-projection for map projections (Robinson, Winkel3, Eckert4)

### Key Features
- Interactive world map with threat visualization
- Multi-tab interface (map, analytics, tools, reports)
- Real-time threat monitoring and incident tracking
- Export capabilities for reports and data
- Notification system with auto-refresh
- Responsive design with fullscreen mode support
- Multiple data visualization modes

### State Management
The application uses React hooks for state management with extensive state including:
- UI states (active tabs, modals, notifications)
- Data states (incidents, threats, country data)
- Filter states (threat levels, time ranges, categories)
- Tool states (various OSINT tools and their inputs)

### Testing
- Uses React Testing Library and Jest
- Test files follow `*.test.js` pattern
- Run single test: `npm test -- --testNamePattern="test name"`

## Important Notes

- This is a defensive security application focused on OSINT analysis
- The main application logic is contained in a single large component (`App.js`)
- Tailwind CSS is configured but config files are not present in the project root
- The application includes extensive D3.js visualizations requiring geographic data