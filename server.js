import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import roomRoutes from './routes/rooms.js';
import userRoutes from './routes/users.js';
import githubRoutes from './routes/github.js';
import process from 'process';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug environment variables
console.log('🔧 Environment check:');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
console.log('- PORT:', process.env.PORT || 'Using default 5000');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'], // Allow both Vite default ports
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB connection
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    console.log('🔗 Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('🚨 Database connection error:', error.message);
    console.error('💡 Check your .env file and MongoDB connection string');
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Routes
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/github', githubRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'CodeTracker Backend API', 
    status: 'Server running successfully',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    endpoints: {
      rooms: '/api/rooms',
      users: '/api/users',
      github: '/api/github/:username/stats'
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found` 
  });
});

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('🔄 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('🚨 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🔒 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}`);
});