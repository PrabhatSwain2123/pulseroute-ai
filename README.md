# PulseRoute AI

## Problem Statement
Urban commuters in Bengaluru often see current traffic conditions, but still struggle to make reliable route decisions because they lack clear visibility into predicted near-future congestion.

## Solution
PulseRoute AI is a predictive traffic intelligence prototype focused on the ITPL to Electronic City commute corridor. It combines live route alternatives with a prediction layer and Gemini-powered natural language insights to help commuters choose the best route.

## Key Features
- Live route comparison
- Current ETA vs predicted ETA
- Reliability score per route
- AI-generated commuter explanation
- Bengaluru-specific corridor focus

## Google Technologies Used
- Google Maps JavaScript API
- Google Gemini API
- Google AI Studio API key setup

## Tech Stack
- HTML
- CSS
- JavaScript
- Google Maps Platform
- Gemini API

## How to Run
1. Open the project folder in VS Code.
2. Replace the Google Maps API key in `index.html`.
3. Replace the Gemini API key in `script.js`.
4. Run with Live Server.
5. Open the app in browser.

## MVP Note
This prototype uses live route retrieval and an MVP prediction layer for near-future congestion simulation.

## Future Scope
- Historical corridor learning with BigQuery
- Event-aware congestion modeling
- Real-time city operations dashboard
- Fleet and emergency route optimization