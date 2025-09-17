# Copilot Instructions for ModpackStore

## Project Overview
ModpackStore is a Minecraft modpack management platform with two main components:
- **Backend**: Node.js API server using TypeORM for database operations
- **Frontend**: Tauri + React + TypeScript desktop application

## 🚨 IMPORTANT - Legacy Code Warning

**AVOID AT ALL COSTS**: Do not use or reference files in `backend/src/db/` directory:
- `backend/src/db/schema.ts` - Legacy Drizzle schema (DO NOT USE)
- `backend/src/db/client.ts` - Legacy Drizzle client (DO NOT USE)
- Any other files in `backend/src/db/` except for TypeORM-related files

**ALWAYS USE**: TypeORM entities located in `backend/src/entities/`:
- `backend/src/entities/User.ts` - Current user entity
- `backend/src/entities/Modpack.ts` - Current modpack entity
- `backend/src/entities/ModpackVersion.ts` - Current modpack version entity
- And all other entities in this directory

## Database Architecture

### Current (TypeORM) - ✅ USE THIS
```typescript
// Correct way to work with database
import { User } from '../entities/User';
import { Modpack } from '../entities/Modpack';
import { AppDataSource } from './data-source';

// Using TypeORM repository pattern
const userRepository = AppDataSource.getRepository(User);
const user = await userRepository.findOne({ where: { id: userId } });
```

### Legacy (Drizzle) - ❌ NEVER USE
```typescript
// WRONG - Do not use this approach
import { client } from './db/client';
import { UsersTable } from './db/schema';
```

## Code Conventions

### Backend (Node.js + TypeORM)
- Use TypeORM entities with decorators for database models
- Use repository pattern for database operations
- Follow RESTful API conventions with Hono framework
- Use Zod for input validation
- All API endpoints should be properly typed
- Use proper error handling with try-catch blocks

### Frontend (Tauri + React + TypeScript)
- Use React hooks for state management
- Prefer function components over class components
- Use TypeScript strictly - avoid `any` types
- Use Tauri APIs for system interactions via `@tauri-apps/api`
- Use `invoke()` for calling Rust backend commands
- Handle Tauri events properly with `listen()` and `emit()`
- Follow the existing component structure in `src/components/`
- Use the established styling approach with Tailwind CSS
- Utilize Radix UI components for consistent UI elements
- Use Sonner for toast notifications
- Use React Router DOM for navigation

## File Structure Preferences

### Backend Structure
```
backend/src/
├── entities/          # TypeORM entities (USE THESE)
├── services/          # Business logic services
├── controllers/       # API route handlers
├── middlewares/       # Hono middleware
├── routes/            # API route definitions
├── types/             # TypeScript type definitions
├── validators/        # Zod validation schemas
├── models/            # Business logic models (TypeORM-based)
├── config/            # Configuration files
├── lib/               # Library integrations
└── utils/             # Helper utilities
```

### Frontend Structure
```
application/src/
├── components/        # React components
├── hooks/             # Custom React hooks
├── services/          # API and external service integrations
├── types/             # TypeScript interfaces
├── utils/             # Helper functions
├── views/             # Main application pages/views
├── stores/            # State management
├── providers/         # React context providers
├── assets/            # Static assets
└── icons/             # Icon components
```

## Entity Relationships
The main entities and their relationships:
- `User` - Platform users with authentication
- `Publisher` - Organizations that publish modpacks
- `Modpack` - Individual modpack entries
- `ModpackVersion` - Specific versions of modpacks
- `ModpackFile` - Files associated with modpack versions
- `Category` - Modpack categorization
- `Ticket` - Support tickets system

## Technology Stack

### Backend Dependencies
- **Framework**: Hono for HTTP server
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport strategies
- **Validation**: Zod schemas
- **File Processing**: Sharp for images, JSZip for archives

### Frontend Dependencies
- **Framework**: React 19 with TypeScript
- **Desktop**: Tauri v2
- **Styling**: Tailwind CSS with Radix UI components
- **State**: React hooks and context
- **Routing**: React Router DOM

## Common Patterns

### API Endpoint Pattern
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { User } from '../entities/User';

const app = new Hono();

app.post('/users', zValidator('json', userSchema), async (c) => {
  const userData = c.req.valid('json');
  const user = await User.save(User.create(userData));
  return c.json({ user });
});
```

### Component Pattern
```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ComponentProps {
  // Define props with TypeScript
}

export const Component: React.FC<ComponentProps> = ({ }) => {
  // Component implementation
  return <div>...</div>;
};
```

## Best Practices
1. Always use TypeScript with strict type checking
2. Prefer composition over inheritance
3. Use proper error boundaries in React
4. Implement proper loading states and error handling
5. Use semantic HTML and accessible components
6. Follow the established code formatting (check existing files)
7. Write descriptive commit messages
8. Use environment variables for configuration

## Testing
- Backend: Use existing test patterns if available
- Frontend: Consider component testing for complex components
- Always test database operations thoroughly

## Security Considerations
- Never expose sensitive data in client-side code
- Use proper authentication middleware
- Validate all inputs on both client and server
- Use environment variables for secrets
- Implement proper CORS policies

Remember: When in doubt, follow the patterns established in the existing codebase and always prefer TypeORM entities over the legacy Drizzle code.