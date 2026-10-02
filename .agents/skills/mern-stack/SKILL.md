---
name: mern-stack
description: "Production guidelines for fullstack MERN (MongoDB, Express, React, Node.js) development, covering Mongoose schemas, connection pooling, JWT auth cookies, REST API controllers, and React client integration."
category: development
tags: [mern, mongodb, mongoose, express, nodejs, react, fullstack, auth]
license: "MIT"
---

# Production MERN Stack Architecture

## Overview

Comprehensive engineering patterns for MERN applications (MongoDB, Express.js, React, Node.js). Focuses on schema design with Mongoose, connection pooling, indexing, secure stateless JWT authentication, and typed REST API integration.

## Core Stack Packages

```bash
# Backend dependencies
npm install express mongoose dotenv cors helmet
npm install -D typescript @types/express @types/node tsx @types/cors

# Input validation and security
npm install zod jose bcryptjs
npm install -D @types/bcryptjs
```

## Architecture Layout

```
server/
├── config/
│   └── database.ts         # Mongoose singleton connection
├── controllers/            # Request handlers (parsing, status codes)
├── middleware/             # Auth guards, validation, error handler
├── models/                 # Mongoose schemas and TypeScript interfaces
├── routes/                 # Express router declarations
├── schemas/                # Zod runtime schemas
├── server.ts               # App entrypoint
client/                     # React + Vite frontend application
```

## Production Mongoose Connection Singleton

Prevent connection pool leaks across hot reloads in development:

```typescript
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/app_prod';

declare global {
  var mongooseConnection: Promise<typeof mongoose> | undefined;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (global.mongooseConnection) {
    return global.mongooseConnection;
  }

  const opts: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  global.mongooseConnection = mongoose.connect(MONGODB_URI, opts);

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  return global.mongooseConnection;
}
```

## Mongoose Schema Modeling Standards

Always type Mongoose schemas and enforce indexes:

```typescript
import { Schema, model, Document, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Prevent password hash from leaking in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for frequent composite queries
userSchema.index({ email: 1, isActive: 1 });

export type UserDocument = InferSchemaType<typeof userSchema> & Document;
export const User = model<UserDocument>('User', userSchema);
```

## Secure Authentication Protocol

1. **Password Hashing**: Always hash with `bcryptjs` (salt rounds $\ge 12$) or `argon2`.
2. **Token Transmission**: Send JWT access tokens in `httpOnly; Secure; SameSite=Strict` cookies. **Never** store auth tokens in browser `localStorage`.
3. **Password Exclusion**: Always use `select: false` on credential fields in Mongoose schemas.
4. **Input Sanitization**: Validate all incoming parameters with Zod before triggering Mongoose database operations to avoid NoSQL injection.
5. **Pagination**: For large collections, use cursor-based pagination (`_id` greater than last seen) rather than expensive `skip(N)`.
