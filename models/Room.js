import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  auth0Id: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  picture: { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now },
  role: { type: String, enum: ['creator', 'participant'], default: 'participant' },
  isActive: { type: Boolean, default: true },
  profiles: {
    leetcode: { type: String, default: '' },
    github: { type: String, default: '' }
  },
  stats: {
    leetcode: {
      total: { type: Number, default: 0 },
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    },
    github: {
      totalCommits: { type: Number, default: 0 },
      weeklyCommits: { type: Number, default: 0 },
      monthlyCommits: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    }
  },
  statsLastUpdated: { type: Date, default: Date.now },
  leaderboardScore: { type: Number, default: 0 }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  roomCode: { type: String, unique: true, required: true },
  creator: {
    auth0Id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  participants: [participantSchema],
  settings: {
    isPublic: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 10, min: 2, max: 100 },
    allowChat: { type: Boolean, default: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Mixed'], default: 'Mixed' },
    language: { type: String, enum: ['JavaScript', 'Python', 'Java', 'C++', 'Any'], default: 'Any' },
    timeLimit: { type: Number, default: 60, min: 15, max: 180 },
    leaderboard: {
      enabled: { type: Boolean, default: true },
      autoUpdate: { type: Boolean, default: true },
      weightLeetCode: { type: Number, default: 0.6, min: 0, max: 1 },
      weightGitHub: { type: Number, default: 0.4, min: 0, max: 1 }
    }
  },
  status: { type: String, enum: ['waiting', 'active', 'completed', 'cancelled'], default: 'waiting' },
  currentProblem: {
    title: String,
    difficulty: String,
    url: String,
    startTime: Date
  },
  isActive: { type: Boolean, default: true },
  lastActivity: { type: Date, default: Date.now }
}, {
  timestamps: true
});

roomSchema.index({ roomCode: 1 });
roomSchema.index({ 'creator.auth0Id': 1 });
roomSchema.index({ 'participants.auth0Id': 1 });

roomSchema.virtual('participantCount').get(function() {
  return this.participants.filter(p => p.isActive).length;
});

roomSchema.methods.isFull = function() {
  return this.participantCount >= this.settings.maxParticipants;
};

roomSchema.methods.isParticipant = function(auth0Id) {
  return this.participants.some(p => p.auth0Id === auth0Id && p.isActive);
};

roomSchema.methods.isCreator = function(auth0Id) {
  return this.creator.auth0Id === auth0Id;
};

export default mongoose.model('Room', roomSchema);