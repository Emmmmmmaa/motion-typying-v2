# Overview

This is an interactive poetry web application that allows users to explore word variations within a poetic sentence structure. The left rotatable panel cycles through a fixed list of words ("we", "are", "both", "he", "I", "she", "they", "someone", "it"), while the right panel navigates through different text tokens in the sentence. Built with React and Express, it features a modern UI with shadcn/ui components and dual control via mouse or Arduino rotary encoders.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**Routing**: Wouter for client-side routing - a lightweight alternative to React Router that provides simple path-based navigation.

**UI Component Library**: shadcn/ui (New York style variant) - a collection of re-usable components built with Radix UI primitives and styled with Tailwind CSS. This provides accessible, customizable components without the overhead of a full component library dependency.

**Styling**: Tailwind CSS with custom CSS variables for theming, allowing dynamic color schemes and consistent design tokens across the application.

**State Management**: TanStack Query (React Query) for server state management, handling API requests, caching, and background refetching. No global client state management library is used, keeping state management simple and co-located with components.

**Form Handling**: React Hook Form with Zod resolvers for type-safe form validation.

**Project Structure**:
- `client/src/pages/` - Page components
- `client/src/components/ui/` - Reusable UI components from shadcn/ui
- `client/src/hooks/` - Custom React hooks
- `client/src/lib/` - Utility functions and shared configurations

## Backend Architecture

**Framework**: Express.js running on Node.js with TypeScript, using ES modules (not CommonJS).

**API Design**: RESTful API with a single endpoint (`/api/word-variations`) that returns a fixed word list for the left panel rotation: ["we", "are", "both", "he", "I", "she", "they", "someone", "it"].

**Development Mode**: In development, Vite middleware is integrated directly into Express, allowing hot module replacement and a seamless development experience with a single server process.

**Production Build**: The frontend is built into static assets and served by Express. The backend is bundled using esbuild into a single executable file.

**Word List**: Uses a fixed, predefined list of words for left panel word selection - no external API calls or AI generation required.

**Project Structure**:
- `server/index.ts` - Express server setup and middleware configuration
- `server/routes.ts` - API route definitions and handlers
- `server/storage.ts` - Data access layer (currently in-memory implementation)
- `server/vite.ts` - Vite development server integration

## Data Storage

**ORM**: Drizzle ORM for type-safe database queries with full TypeScript support.

**Database**: PostgreSQL (via Neon serverless driver for connection pooling and edge compatibility).

**Schema Design**: Currently implements a basic user authentication schema with username and password fields. The schema is defined in `shared/schema.ts` and uses Drizzle Zod for validation schemas.

**Migration Strategy**: Drizzle Kit handles schema migrations with files stored in the `./migrations` directory.

**Current Implementation**: The application uses an in-memory storage adapter (`MemStorage`) for development, with the interface (`IStorage`) designed to easily swap to a database-backed implementation.

**Rationale**: The in-memory approach allows rapid prototyping without database setup, while the interface abstraction ensures easy migration to persistent storage when needed.

## Authentication & Authorization

**Session Management**: Configured to use `connect-pg-simple` for PostgreSQL-backed session storage (though not currently active with in-memory storage).

**User Schema**: Basic username/password structure defined in the database schema, ready for authentication implementation.

**Current State**: Authentication infrastructure is prepared but not fully implemented in the application routes.

## Arduino Hardware Integration

**Hardware**: Dual KY040 rotary encoders connected to Arduino UNO3 via USB-C

**Communication Architecture**:
- **Backend**: Serial port handler (`server/arduino.ts`) with automatic port detection
  - Reads encoder data at 115200 baud from Arduino
  - Implements periodic reconnection (every 10 seconds if disconnected)
  - Proper async resource cleanup with awaited port.close()
  - Broadcasts encoder position updates via WebSocket
  
- **WebSocket Server**: Real-time bidirectional communication at `/ws/encoder`
  - Streams encoder position updates to connected clients
  - Connection status monitoring
  - Automatic reconnection with state synchronization

- **Frontend Integration** (`client/src/pages/Frame.tsx`):
  - **Independent Input Tracking**: Mouse and encoder contributions stored separately
    - Left panel: `rotation = mouseRotation + encoderRotation`
    - Right panel: `rightRotation = rightMouseRotation + rightEncoderRotation`
  - **True Simultaneous Control**: Both inputs processed independently without cross-contamination
    - Encoder handlers update ONLY encoder rotation states
    - Mouse handlers update ONLY mouse rotation states
    - React effects combine both for final display and selection
  - **Accumulated Rotation Processing**: Right panel processes ALL 60° increments (not just one per render)
  - **WebSocket Reconnection**: Encoder rotation states reset to absolute hardware position on reconnect
  - **Connection Status**: Visual indicator shows real-time connection state

**Hardware Configuration**:
- Encoder 1: Controls left panel (word selection)
  - 1 detent = 3.6° rotation (100 detents = full 360° rotation)
  - Updates word selection based on angular segments
  
- Encoder 2: Controls right panel (text token selection)
  - 1 detent = 3.6° rotation
  - 60° threshold for switching between text tokens
  - Bidirectional navigation through sentence elements

**Arduino Sketch**: `arduino/KY040_Dual_Encoder.ino`
- Interrupt-based encoder reading for responsive control
- Outputs JSON-formatted position data: `{"encoder1": count1, "encoder2": count2}`
- Optimized serial communication at 115200 baud

**Documentation**: Complete setup guide in `ARDUINO_SETUP.md`

# External Dependencies

## Word List

**Fixed Word List**: The application uses a predefined list of words for the left panel rotation
- **Words**: ["we", "are", "both", "he", "I", "she", "they", "someone", "it"]
- **No AI Integration**: Removed OpenAI dependency - the app now uses a simple fixed list instead of AI-generated variations
- **Benefits**: Faster performance, no API costs, predictable word selection, works offline

## Database Service

**Provider**: Neon (PostgreSQL serverless)
- **Purpose**: Persistent data storage for user accounts and application data
- **Connection**: Via `@neondatabase/serverless` package for WebSocket-based connections
- **Configuration**: Database URL provided via `DATABASE_URL` environment variable
- **Current Status**: Schema defined and ready, but application currently uses in-memory storage

## UI Component Dependencies

**Radix UI**: Headless accessible component primitives for building the UI
- Provides ~30 different component types (dialogs, dropdowns, tooltips, etc.)
- Ensures WCAG accessibility compliance
- Handles complex interaction patterns and keyboard navigation

**Styling Dependencies**:
- `tailwindcss` - Utility-first CSS framework
- `class-variance-authority` - Type-safe variant handling for components
- `tailwind-merge` & `clsx` - Utility for merging Tailwind classes

## Development Tools

**Replit Integration**:
- `@replit/vite-plugin-runtime-error-modal` - Enhanced error overlay for development
- `@replit/vite-plugin-cartographer` - Code navigation enhancements
- `@replit/vite-plugin-dev-banner` - Development environment indicators

**Build Tools**:
- Vite for frontend bundling and dev server
- esbuild for backend bundling
- tsx for TypeScript execution in development

## Additional Libraries

- `wouter` - Lightweight routing (1.5KB alternative to React Router)
- `embla-carousel-react` - Carousel/slider functionality
- `date-fns` - Date manipulation utilities
- `nanoid` - Unique ID generation
- `cmdk` - Command palette component