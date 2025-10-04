// LeetCode API Integration Service

// Using multiple API endpoints for better reliability
const LEETCODE_API_ENDPOINTS = [
  'https://leetcode-stats-api.herokuapp.com',
  'https://alfa-leetcode-api.onrender.com',
  'https://leetcode-api-faisalshohag.vercel.app'
];

export const leetcodeAPI = {
  // Get user's LeetCode statistics with fallback APIs
  getUserStats: async (username) => {
    const errors = [];
    
    // Try multiple API endpoints
    for (const apiBase of LEETCODE_API_ENDPOINTS) {
      try {
        console.log(`Trying LeetCode API: ${apiBase}/${username}`);
        const response = await fetch(`${apiBase}/${username}`, {
          timeout: 10000 // 10 second timeout
        });
        
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log('LeetCode API response:', data);
        
        // Handle different response formats from different APIs
        if (data.status === 'error' || data.message === 'failed' || data.errors) {
          throw new Error(data.message || data.errors || 'User not found');
        }

        // Normalize different API response formats
        return {
          totalSolved: data.totalSolved || data.solvedProblem || data.total_solved || 0,
          totalQuestions: data.totalQuestions || data.total_problems || 0,
          easySolved: data.easySolved || data.easy || data.easy_solved || 0,
          totalEasy: data.totalEasy || data.total_easy || 0,
          mediumSolved: data.mediumSolved || data.medium || data.medium_solved || 0,
          totalMedium: data.totalMedium || data.total_medium || 0,
          hardSolved: data.hardSolved || data.hard || data.hard_solved || 0,
          totalHard: data.totalHard || data.total_hard || 0,
          acceptanceRate: data.acceptanceRate || data.acceptance_rate || 0,
          ranking: data.ranking || data.rank || null,
          contributionPoints: data.contributionPoints || data.contribution_points || 0,
          reputation: data.reputation || 0
        };
      } catch (error) {
        console.error(`LeetCode API ${apiBase} failed:`, error.message);
        errors.push(`${apiBase}: ${error.message}`);
        continue; // Try next API
      }
    }
    
    // If all APIs failed, return error
    console.error('All LeetCode APIs failed:', errors);
    return {
      error: true,
      message: `All LeetCode APIs failed. Errors: ${errors.join('; ')}`,
      totalSolved: 0,
      easySolved: 0,
      mediumSolved: 0,
      hardSolved: 0
    };
  },

  // Get user's recent submissions (limited by API availability)
  getRecentSubmissions: async (username) => {
    try {
      // Note: This endpoint might not be available in all APIs
      // We'll return basic stats for now
      const stats = await leetcodeAPI.getUserStats(username);
      
      return {
        recentSubmissions: [], // Would need different API endpoint
        totalSubmissions: stats.totalSolved,
        acceptanceRate: stats.acceptanceRate
      };
    } catch (error) {
      console.error('Error fetching recent submissions:', error);
      return {
        recentSubmissions: [],
        totalSubmissions: 0,
        acceptanceRate: 0
      };
    }
  },

  // Validate if username exists using any of the available APIs
  validateUsername: async (username) => {
    try {
      const stats = await leetcodeAPI.getUserStats(username);
      return !stats.error;
    } catch (error) {
      console.error('Error validating LeetCode username:', error);
      return false;
    }
  },

  // Calculate LeetCode score based on problems solved
  calculateLeetCodeScore: (stats) => {
    const { easySolved, mediumSolved, hardSolved } = stats;
    
    // Weighted scoring system
    const easyWeight = 1;
    const mediumWeight = 3;
    const hardWeight = 5;
    
    return (easySolved * easyWeight) + 
           (mediumSolved * mediumWeight) + 
           (hardSolved * hardWeight);
  },

  // Get difficulty-specific stats
  getDifficultyBreakdown: async (username) => {
    try {
      const stats = await leetcodeAPI.getUserStats(username);
      
      return {
        easy: {
          solved: stats.easySolved,
          total: stats.totalEasy,
          percentage: stats.totalEasy > 0 ? (stats.easySolved / stats.totalEasy * 100).toFixed(1) : 0
        },
        medium: {
          solved: stats.mediumSolved,
          total: stats.totalMedium,
          percentage: stats.totalMedium > 0 ? (stats.mediumSolved / stats.totalMedium * 100).toFixed(1) : 0
        },
        hard: {
          solved: stats.hardSolved,
          total: stats.totalHard,
          percentage: stats.totalHard > 0 ? (stats.hardSolved / stats.totalHard * 100).toFixed(1) : 0
        }
      };
    } catch (error) {
      console.error('Error getting difficulty breakdown:', error);
      return {
        easy: { solved: 0, total: 0, percentage: 0 },
        medium: { solved: 0, total: 0, percentage: 0 },
        hard: { solved: 0, total: 0, percentage: 0 }
      };
    }
  }
};

// Calculate LeetCode score based on difficulty
export const calculateLeetCodeScore = (leetcodeStats) => {
  if (!leetcodeStats) return 0;
  
  const easy = leetcodeStats.easy || 0;
  const medium = leetcodeStats.medium || 0;
  const hard = leetcodeStats.hard || 0;
  
  return (easy * 1) + (medium * 2) + (hard * 3);
};