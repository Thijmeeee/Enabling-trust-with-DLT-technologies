# DPP Trust System - Style Guide

This document outlines the design philosophy, visual language, and UI components used throughout the DPP Trust System.

## 🎨 Design Philosophy
The application follows a **Minimalist** and **Data-Driven** design approach. Since the system handles complex blockchain data and immutable logs, the UI focuses on clarity, readability, and established trust patterns.

Key principles:
- **Cleanliness**: Use of white space to reduce cognitive load.
- **Visual Hierarchy**: Logical information architecture using cards and sections.
- **Trust Indicators**: Clear status badges and verification logs.

---

## 🅰️ Typography
The system uses professional, highly readable sans-serif fonts.

- **Primary Font**: System-default sans-serif stack (Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif).
- **Headings**: Semibold or Bold, usually `text-gray-900` or `text-white` (in dark mode).
- **Body Text**: Regular weight, optimized for readability (`text-gray-600` or `text-gray-300`).
- **Monospaced Data**: Used for DIDs, hashes, and Merkle roots to ensure character differentiation.
  - Font: `JetBrains Mono`, `Fira Code`, or system-default mono.

---

## 🌈 Color Palette
A professional blue-themed palette combined with a neutral gray scale.

### Primary Colors
- **Primary Blue**: `bg-blue-600` (#2563EB) — Used for primary actions, navigation, and role selection.
- **Success Green**: `text-green-600` / `bg-green-100` — Used for verified logs and successful anchors.
- **Warning/Error**: `text-red-600` / `bg-red-50` — Used for unverified data or failed audits.

### Backgrounds
- **Light Mode**: `bg-gray-50` (#F9FAFB) for page backgrounds, `bg-white` for cards.
- **Dark Mode**: `bg-gray-900` (#111827) for page backgrounds, `bg-gray-800` for cards.

---

## 🌙 Dark Mode
The application features a fully responsive **Dark Mode** support using Tailwind's `class` strategy.

- **Switching**: Controlled via a persistent theme context (`ThemeContext.tsx`).
- **Styling**: All components should use the `dark:` prefix for color adjustments.
- **Visuals**: Dark mode reduces eye strain and emphasizes the high-tech, blockchain-oriented nature of the project.

---

## 🧱 UI Components
Components follow a consistent structural pattern:

- **Cards**: `bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700`.
- **Buttons**:
  - *Primary*: Rounded-lg, blue background, white text.
  - *Secondary*: Bordered or subtle gray backgrounds.
- **Status Badges**: Small, rounded pills with distinct colors based on state (Active, Replaced, Recycled).
- **Icons**: Provided by `lucide-react`, used predictably (e.g., Target for Witnessing, Eye for Watching).

---

## 📱 Responsiveness
The UI is mobile-friendly but optimized for **Professional Dashboards**.
- Grids are used for dashboard layouts (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
- Cards stack vertically on smaller screens.
- Navigation elements (like Role Selector) are often pinned or persistent for easy switching.
