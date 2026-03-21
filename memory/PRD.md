# UBUYBOX Dashboard - Product Requirements Document

## Project Overview
**Name:** UBUYBOX Investment Dashboard  
**Type:** Frontend SaaS Dashboard  
**Tech Stack:** Vite 5 + React 18 + TypeScript + Tailwind CSS  
**Updated:** March 21, 2026

## Problem Statement
Build a full desktop to mobile fintech SaaS dashboard UI matching the provided design reference with dark modern fintech aesthetic, glassmorphism styling, and responsive layout.

## User Personas
1. **Investment Manager** - Reviews deals, manages SPVs, tracks capital distributions
2. **Fund Administrator** - Uploads documents, monitors deal status, processes waterfalls
3. **Investor** - Views deal details, accesses documents, tracks portfolio

## Core Requirements (Static)
- Dark theme fintech/SaaS dashboard aesthetic
- Left sidebar navigation with UBUYBOX branding
- Top header with search and notifications
- Stats cards: Total Deals, Active SPVs, Total Capital, Avg Monthly Payment
- Deal cards with Senior/Mezz/Equity capital stack visualization
- Recent activity feed and quick actions
- Fully responsive (desktop + mobile with hamburger menu)
- Netlify-ready with SPA routing support

## What's Been Implemented ✅
**Date: March 21, 2026**

### Layout Components
- ✅ Sidebar with navigation, logo, user profile (responsive)
- ✅ Header with page title, date, search, notifications
- ✅ Mobile hamburger menu with overlay

### Pages (9 Total)
1. **Dashboard** - Stats grid, deal cards, activity feed, quick actions
2. **Capital Stack** - Portfolio distribution bar, all deals grid
3. **Deal Detail** - Capital stack visualization, key metrics
4. **Opportunity Intake** - Property submission form
5. **SPV Registry** - Data table with SPV details
6. **Waterfalls** - Distribution waterfall visualization
7. **HoldCo Summary** - Holding company cards
8. **Documents** - Document cards with search
9. **Notifications** - Notification list with status

### Reusable Components
- `StatCard` - Metric cards with icons and change indicators
- `DealCard` - Deal display with capital stack bar
- `ActivityFeed` - Timeline activity list
- `QuickActions` - Action buttons

### Styling
- ✅ Tailwind CSS with custom dark theme
- ✅ Glass-card utility class for glassmorphism
- ✅ Consistent spacing and typography
- ✅ Color system: Blue (senior), Purple (mezz), Orange (equity/CTA), Green (positive), Red (negative)

### Infrastructure
- ✅ Vite 5.4.21 configuration
- ✅ TypeScript configuration
- ✅ Tailwind CSS 3.4.14
- ✅ React Router v6 with BrowserRouter
- ✅ Netlify configuration (netlify.toml + _redirects)
- ✅ Production build: 213KB JS (62KB gzipped)

## Test Results
- Frontend: 100% pass rate
- All navigation routes working
- Mobile responsive layout verified
- Direct URL routing verified

## Deployment
**Target:** Netlify  
**Build Command:** `npm run build`  
**Output Directory:** `dist`  
**SPA Routing:** Configured via `netlify.toml`

## Next Tasks
1. Connect to real backend API for deal data
2. Implement authentication system
3. Add document upload functionality
4. Real-time notifications with WebSocket
