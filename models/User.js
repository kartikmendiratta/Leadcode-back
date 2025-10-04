import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  auth0Id: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  picture: { type: String, default: '' },
  leetcodeUsername: { type: String, default: '' },
  githubUsername: { type: String, default: '' },
  preferences: {
    language: { type: String, enum: ['JavaScript', 'Python', 'Java', 'C++', 'Any'], default: 'Any' },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Mixed'], default: 'Mixed' }
  },
  stats: {
    totalRoomsCreated: { type: Number, default: 0 },
    totalRoomsJoined: { type: Number, default: 0 },
    totalProblemsCompleted: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

userSchema.index({ auth0Id: 1 });
userSchema.index({ email: 1 });

export default mongoose.model('User', userSchema);