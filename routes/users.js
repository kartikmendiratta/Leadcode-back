import express from 'express';
import User from '../models/User.js';
import Room from '../models/Room.js';
import { githubAPI } from '../services/githubService.js';
import { leetcodeAPI } from '../services/leetcodeService.js';

const router = express.Router();

// Helper function to update participant stats in all joined rooms
async function updateParticipantStatsInRooms(auth0Id, profiles) {
  try {
    // Find all rooms where the user is a participant
    const rooms = await Room.find({
      'participants.auth0Id': auth0Id,
      isActive: true
    });

    for (const room of rooms) {
      const participant = room.participants.find(p => p.auth0Id === auth0Id);
      if (!participant || !participant.isActive) continue;

      // Initialize profiles and stats if not present
      if (!participant.profiles) {
        participant.profiles = {};
      }
      if (!participant.stats) {
        participant.stats = {
          leetcode: { easy: 0, medium: 0, hard: 0, total: 0 },
          github: { totalCommits: 0, weeklyCommits: 0, monthlyCommits: 0 }
        };
      }

      // Update profiles
      if (profiles.github !== undefined) {
        participant.profiles.github = profiles.github;
      }
      if (profiles.leetcode !== undefined) {
        participant.profiles.leetcode = profiles.leetcode;
      }

      // Update GitHub stats if profile is provided and not empty
      if (participant.profiles.github) {
        try {
          console.log(`DEBUG: Updating GitHub stats for ${participant.profiles.github}`);
          const isValidGitHub = await githubAPI.validateUsername(participant.profiles.github);
          console.log(`DEBUG: GitHub username valid: ${isValidGitHub}`);
          
          if (isValidGitHub) {
            // Use the same logic as the GitHub stats endpoint
            const gql = await githubAPI.getContributionStatsGraphQL(participant.profiles.github);
            console.log(`DEBUG: GraphQL result:`, gql);
            
            if (gql.supported) {
              console.log(`DEBUG: Using GraphQL data`);
              participant.stats.github = {
                totalCommits: gql.total,
                weeklyCommits: gql.thisWeek,
                monthlyCommits: gql.thisMonth
              };
            } else {
              console.log(`DEBUG: GraphQL not supported, falling back to estimation`);
              const estimate = await githubAPI.getUserCommitStats(participant.profiles.github);
              participant.stats.github = {
                totalCommits: estimate.total,
                weeklyCommits: estimate.thisWeek,
                monthlyCommits: estimate.thisMonth
              };
            }
            console.log(`DEBUG: Final GitHub stats for ${participant.profiles.github}:`, participant.stats.github);
          }
        } catch (error) {
          console.error(`DEBUG: GitHub API error for participant ${participant.profiles.github}:`, error);
        }
      }

      // Update LeetCode stats if profile is provided and not empty
      if (participant.profiles.leetcode) {
        try {
          const leetcodeStats = await leetcodeAPI.getUserStats(participant.profiles.leetcode);
          if (!leetcodeStats.error) {
            participant.stats.leetcode = {
              easy: leetcodeStats.easySolved || 0,
              medium: leetcodeStats.mediumSolved || 0,
              hard: leetcodeStats.hardSolved || 0,
              total: leetcodeStats.totalSolved || 0
            };
          }
        } catch (error) {
          console.error('LeetCode API error for participant:', error);
        }
      }

      // Update timestamp
      participant.statsLastUpdated = new Date();

      // Save the room
      await room.save();
    }

    console.log(`Updated participant stats in ${rooms.length} rooms for user ${auth0Id}`);
  } catch (error) {
    console.error('Error updating participant stats in rooms:', error);
    throw error;
  }
}

// POST /api/users - Create or update user
router.post('/', async (req, res) => {
  try {
    const { auth0Id, email, name, picture } = req.body;
    
    if (!auth0Id || !email || !name) {
      return res.status(400).json({ 
        success: false, 
        message: 'auth0Id, email, and name are required' 
      });
    }
    
    const user = await User.findOneAndUpdate(
      { auth0Id },
      { 
        email,
        name,
        picture: picture || '',
        $setOnInsert: {
          leetcodeUsername: '',
          githubUsername: '',
          preferences: {
            language: 'Any',
            difficulty: 'Mixed'
          },
          stats: {
            totalRoomsCreated: 0,
            totalRoomsJoined: 0,
            totalProblemsCompleted: 0
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/:auth0Id - Get user by Auth0 ID
router.get('/:auth0Id', async (req, res) => {
  try {
    const user = await User.findOne({ auth0Id: req.params.auth0Id });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/:auth0Id - Update user profile
router.put('/:auth0Id', async (req, res) => {
  try {
    const { leetcodeUsername, githubUsername, preferences } = req.body;
    
    const updateData = {};
    if (leetcodeUsername !== undefined) updateData.leetcodeUsername = leetcodeUsername;
    if (githubUsername !== undefined) updateData.githubUsername = githubUsername;
    if (preferences) updateData.preferences = preferences;
    
    const user = await User.findOneAndUpdate(
      { auth0Id: req.params.auth0Id },
      updateData,
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update participant stats in all joined rooms if usernames were updated
    if (leetcodeUsername !== undefined || githubUsername !== undefined) {
      try {
        await updateParticipantStatsInRooms(req.params.auth0Id, {
          leetcode: leetcodeUsername,
          github: githubUsername
        });
      } catch (error) {
        console.error('Error updating participant stats in rooms:', error);
        // Don't fail the request if room updates fail
      }
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/users/:auth0Id/stats - Get user statistics
router.get('/:auth0Id/stats', async (req, res) => {
  try {
    const user = await User.findOne({ auth0Id: req.params.auth0Id }).select('stats');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, stats: user.stats });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/users/:auth0Id/refresh-stats - Refresh and update user statistics
router.post('/:auth0Id/refresh-stats', async (req, res) => {
  try {
    const user = await User.findOne({ auth0Id: req.params.auth0Id });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Force update participant stats in all joined rooms with fresh data
    await updateParticipantStatsInRooms(req.params.auth0Id, {
      leetcode: user.leetcodeUsername,
      github: user.githubUsername
    });
    
    res.json({ success: true, message: 'Stats refreshed successfully' });
  } catch (error) {
    console.error('Error refreshing user stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;