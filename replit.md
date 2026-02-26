# SpeedWatch - Real-Time Speedometer & Speed Limit Tracker

## Overview
A real-time speedometer web app that uses GPS to measure speed of motion and compares it against road speed limits fetched from OpenStreetMap. Includes comprehensive driving safety features and eco-driving efficiency metrics.

## Features
- Real-time speed measurement using browser Geolocation API
- Beautiful animated speedometer gauge with needle
- Road speed limit fetching from OpenStreetMap Overpass API
- Tiered speed alarm system (mild/moderate/aggressive based on how far over the limit)
- Visual warnings: red screen flash, speed number shake, tier-colored alert cards
- Voice alerts via Web Speech API ("Reduce speed.", speed zone announcements)
- Drowsy driving detection - alerts after 2 hours of continuous driving, then every 30 minutes
- Sharp turn warning - detects rapid heading changes at speed
- Speed zone announcements - voice alert when entering a new speed zone
- School zone detection - announces nearby schools, shows blue alert card
- Trip summary - end-of-trip report with speeding incidents, distance, duration, safety stats
- Night mode - extra-dim red-tinted display for night driving
- Hands-free mode - large speed display with voice-only interaction
- Trip statistics (max speed, avg speed, distance, duration, altitude, heading)
- Toggle between km/h and mph
- Dark/light theme toggle
- PWA support (add to home screen)
- Responsive mobile-first design

### Eco Driving Features
- **Fuel efficiency estimate** - GPS-based scoring from speed patterns, acceleration, idling
- **Acceleration & smoothness tracking** - Detects harsh accelerations (>2.5 m/s²) and harsh brakes (<-3.0 m/s²)
- **Hard cornering detection** - Lateral G-force estimation from GPS heading changes and speed (>0.3g = hard corner)
- **Speed discipline** - Percentage of time within speed limit
- **Idling behavior** - Tracks idle time and number of idle periods
- **Anticipatory driving** - Measures coast-down events and gentle braking patterns
- **Live eco score** - Real-time eco score displayed during tracking (color-coded green/yellow/red)
- **Practical driving tips** - Personalized tips in trip summary based on actual driving behavior (great for teens and unfamiliar roads)
- **Driver Efficiency Profile** (in trip summary):
  - **Eco Score** (0-100): Weighted from fuel efficiency factors
  - **Smoothness Score** (0-100): Based on harsh vs smooth acceleration/braking ratio + cornering penalty
  - **Fatigue Risk Score** (0-100, lower = better): Based on duration, speed variance, time of day

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js serving API endpoints
- **No database** - this is a real-time tracking app with no persistence needed
- **Speed Limit Data**: OpenStreetMap Overpass API (free, no API key)

## Project Structure
- `client/src/pages/speedometer.tsx` - Main speedometer page (integrates all features)
- `client/src/components/speedometer-gauge.tsx` - SVG speedometer gauge component
- `client/src/components/speed-limit-badge.tsx` - Speed limit display badge
- `client/src/components/trip-stats.tsx` - Trip statistics grid
- `client/src/components/trip-summary.tsx` - End-of-trip summary dialog with eco scores
- `client/src/hooks/use-geolocation.ts` - GPS tracking hook
- `client/src/hooks/use-speed-limit.ts` - Speed limit fetching hook
- `client/src/hooks/use-speed-alarm.ts` - Tiered speed alarm (mild/moderate/aggressive)
- `client/src/hooks/use-drowsy-alert.ts` - Drowsy driving detection hook
- `client/src/hooks/use-turn-warning.ts` - Sharp turn warning hook
- `client/src/hooks/use-zone-announce.ts` - Speed zone voice announcement hook
- `client/src/hooks/use-trip-recorder.ts` - Trip recording with speeding incident tracking + eco data
- `client/src/hooks/use-eco-driving.ts` - Eco driving metrics: acceleration, idling, speed discipline, scores
- `server/routes.ts` - API endpoint for speed limit lookup + school zone detection

## API Endpoints
- `GET /api/speed-limit?lat=XX&lon=YY` - Returns `{ speedLimit: number|null, roadName: string|null, isSchoolZone: boolean }`

## Running
- `npm run dev` starts the Express backend + Vite frontend on port 5000
