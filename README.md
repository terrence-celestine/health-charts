# Samsung Health Dashboard

A high-performance, private, local-first dashboard to parse, store, analyze, and visualize Samsung Health export data. Built with React, TypeScript, Tailwind CSS, and Vite.

## 🚀 Key Features

- **100% Data Privacy**: Your health data is highly sensitive. This app operates entirely on a **local-first architecture**. Your files are parsed, processed, and stored directly in your browser's IndexedDB database. No servers, no APIs, and no cloud syncing. Your data never leaves your computer.
- **Multithreaded Background Processing**: Heavy ZIP extraction (`JSZip`), CSV parsing (`PapaParse`), and database writes are offloaded to a background **Web Worker**. This keeps the browser's main thread 100% free, ensuring a completely smooth, lag-free UI experience.
- **High-Frequency Data Downsampling**: Implements the **Largest Triangle Three Buckets (LTTB)** algorithm to downsample high-frequency heart rate readings (e.g., 100,000+ records) into a visual-preserving subset (e.g., 600 points) for smooth, interactive rendering in Recharts without losing critical peaks and valleys.
- **Automated Correlation & Insights Engine**: Calculates **Pearson Correlation Coefficients** between overlapping daily metrics (like Steps, Sleep Duration, Sleep Efficiency, and Average Heart Rate) to automatically detect patterns and display personalized, automated health insights.

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 (CSS-first configuration)
- **Local Database**: Dexie.js (IndexedDB wrapper)
- **ZIP Extraction**: JSZip
- **CSV Parser**: PapaParse
- **Data Visualization**: Recharts
- **Icons**: Lucide React

---

## 📂 Project Architecture

```text
health-charts/
├── src/
│   ├── components/      # Reusable UI components (HealthCharts, CorrelationEngine, MetricCard)
│   ├── db/              # IndexedDB schemas and Dexie.js database configuration
│   ├── hooks/           # Custom React hooks for reactive IndexedDB querying
│   ├── utils/           # Pure utility functions (LTTB downsampling, Pearson correlation)
│   ├── worker/          # Web Worker background processing thread
│   ├── App.tsx          # Application root
│   ├── index.css        # Global styles & Tailwind v4 directives
│   └── main.tsx         # React entry point
```

---

## 🏃‍♂️ Getting Started

### 1. Clone & Install Dependencies
First, install the project dependencies:
```bash
npm install
```

### 2. Run the Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open your browser and navigate to the local URL shown in your terminal (usually **`http://localhost:5173`**).

### 3. Export Your Samsung Health Data
1. Open the **Samsung Health** app on your phone.
2. Go to **Settings** > **Download personal data**.
3. Tap **Download** to generate a `.zip` file of your health history.
4. Transfer the `.zip` file to your computer.

### 4. Import and Visualize
1. Drag and drop your Samsung Health `.zip` file directly into the dashboard dropzone.
2. Watch the background Web Worker extract and parse your data.
3. Once complete, explore your daily step trends, sleep duration, heart rate logs, and correlation insights!

