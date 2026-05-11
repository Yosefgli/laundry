# Project: Laundry Operations Management System

## Goal
Build a laundry operations management system with separate employee and customer interfaces.
The system manages the full laundry workflow end-to-end, optimized for fast operational flow,
minimal mistakes, and real-time synchronization between workstations (tablets).

## Core Workflows
- Order creation, weight entry, service selection
- Real-time price calculation
- Barcode generation and scanning
- Payment tracking and receipt printing
- Order status management and delivery confirmation
- Active session management between employee and customer screens
- Workstation/device pairing and session recovery

## Tech Stack
- **Frontend:** Next.js (App Router), React, TypeScript
- **Backend:** Next.js API routes + server actions
- **Database + Auth + Realtime:** Supabase
- **Deployment:** Vercel
- **Source Control:** GitHub

## Key Architectural Constraint
This is NOT a standard CRUD app. The backend manages a stateful session layer:
employee and customer tablets are paired, communicate in real time, and transition
through a strict workflow state machine. Session integrity is a first-class concern.
