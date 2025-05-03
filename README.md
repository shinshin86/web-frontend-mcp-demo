# Web Frontend MCP Demo

A demonstration project showing integration of the Model Context Protocol (MCP) with a modern web application.

## Project Structure

This project consists of two main parts:
- **Frontend**: A React 19 application built with Vite
- **Backend**: A Node.js server using Hono framework

Both parts utilize the `@modelcontextprotocol/sdk` package for MCP integration.

## Technologies

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Hono
- TypeScript
- Zod for validation

## Getting Started

### Prerequisites
- Node.js (latest LTS version recommended)
- npm

### Installation

1. Clone the repository
2. Install dependencies in the root project:
   ```
   npm install
   ```
3. Install dependencies in each subdirectory:
   ```
   cd frontend && npm install
   cd backend && npm install
   ```

## Development

Run both frontend and backend concurrently:
```
npm run dev
```

This will start:
- Frontend development server (Vite)
- Backend development server (using tsx)

## Building for Production

### Frontend
```
cd frontend && npm run build
```

### Backend
```
cd backend && npm run build
```

## License
MIT
