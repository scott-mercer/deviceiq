# DeviceIQ Frontend

DeviceIQ is a platform that helps mobile teams prioritize and orchestrate testing across real-world devices based on actual user behavior. This frontend allows you to upload device usage data, generate a test matrix, assign test flows, and view analytics.

## Features

- Upload device usage data (CSV)
- Generate a prioritized device matrix
- Visualize coverage and analytics (charts)
- Assign test flows to device/OS combinations
- Download test plans as CSV

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-org/deviceiq-frontend.git
   cd deviceiq-frontend
   ```

2. Install dependencies:
   ```sh
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```sh
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser to:
   ```
   http://localhost:3000
   ```

## Usage

1. Upload a CSV file with columns: `device_model`, `os_version`, `usage_percent`.
2. Generate the device matrix and assign test flows.
3. View analytics on the Analytics tab.
4. Download your test plan if needed.

## Configuration

- The frontend expects the backend API at `http://localhost:8000` by default.
- Update API URLs in the code if your backend runs elsewhere.

## Project Structure

- `app/page.tsx` — Main dashboard and analytics logic
- `components/ui/` — UI components

## License

MIT