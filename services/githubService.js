// GitHub API Integration Service
import process from 'process';

const GITHUB_API_BASE = 'https://api.github.com';

export const githubAPI = {
  // Fetch contribution stats using public GitHub API (works for any user)
  getContributionStatsGraphQL: async (username) => {
    console.log(`🔍 Public API: Starting for ${username}`);
    
    try {
      // Use GitHub Search API to get total commit count for any user
      const searchUrl = `https://api.github.com/search/commits?q=author:${username}`;
      const searchHeaders = {
        'Accept': 'application/vnd.github.cloak-preview+json',
        'User-Agent': 'Mozilla/5.0'
      };
      
      // Add token if available for higher rate limits
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        searchHeaders.Authorization = `Bearer ${token}`;
      }
      
      const searchRes = await fetch(searchUrl, { headers: searchHeaders });
      
      if (!searchRes.ok) {
        throw new Error(`Search API failed: ${searchRes.status}`);
      }
      
      const searchData = await searchRes.json();
      const totalCommits = searchData.total_count || 0;
      
      // Get user profile for repository count
      const profileRes = await fetch(`https://api.github.com/users/${username}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!profileRes.ok) {
        throw new Error(`Profile API failed: ${profileRes.status}`);
      }
      
      const profile = await profileRes.json();
      
      // Get recent commits from events API for weekly/monthly stats
      const eventsRes = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      let weekCommits = 0;
      let monthCommits = 0;
      
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const pushEvents = events.filter(event => event.type === 'PushEvent');
        
        for (const event of pushEvents) {
          const eventDate = new Date(event.created_at);
          const commitCount = event.payload?.commits?.length || 1;
          
          if (eventDate >= weekAgo) {
            weekCommits += commitCount;
          }
          if (eventDate >= monthAgo) {
            monthCommits += commitCount;
          }
        }
      }
      
      console.log(`✅ Public API success for ${username}: ${totalCommits} total, ${weekCommits} week, ${monthCommits} month`);
      
      return {
        supported: true,
        total: totalCommits,
        thisWeek: weekCommits,
        thisMonth: monthCommits,
        publicRepos: profile.public_repos || 0,
        method: 'accurate'
      };
      
    } catch (e) {
      console.log(`❌ Public API failed for ${username}: ${e.message}`);
      return { supported: false, reason: e.message };
    }
  },
  // Get user's public profile information
  getUserProfile: async (username) => {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/users/${username}`);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching GitHub user profile:', error);
      throw error;
    }
  },

  // Get user's commit activity using a more accurate approach
  getUserCommitStats: async (username) => {
    try {
      // Get user profile first
      const profile = await githubAPI.getUserProfile(username);
      
      // Get user's repositories count (we'll use the profile data instead of fetching full repo list)
      // const reposResponse = await fetch(`${GITHUB_API_BASE}/users/${username}/repos?per_page=100&sort=updated`);
      // We'll rely on profile.public_repos count to avoid unnecessary API calls

      // Get recent activity from events API (more efficient than counting all commits)
      const eventsResponse = await fetch(`${GITHUB_API_BASE}/users/${username}/events/public?per_page=100`);
      let recentCommits = 0;
      let weekCommits = 0;
      let monthCommits = 0;

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // Count push events (commits) from recent activity
        const pushEvents = events.filter(event => event.type === 'PushEvent');
        
        pushEvents.forEach(event => {
          const eventDate = new Date(event.created_at);
          const commitCount = event.payload?.commits?.length || 1;
          
          recentCommits += commitCount;
          
          if (eventDate >= oneWeekAgo) {
            weekCommits += commitCount;
          }
          if (eventDate >= oneMonthAgo) {
            monthCommits += commitCount;
          }
        });
      }

      // Calculate estimated total commits based on multiple factors
      const accountAge = profile.created_at ? 
        Math.max(1, (new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24 * 365)) : 1;
      
      // More sophisticated estimation based on:
      // - Number of repositories
      // - Account age
      // - Recent activity level
      // - Repository activity (starred, forked repos indicate activity)
      const baseEstimate = profile.public_repos * 8; // Average commits per repo
      const activityMultiplier = recentCommits > 0 ? Math.min(3, recentCommits / 10) : 0.5;
      const ageMultiplier = Math.min(2, accountAge / 2); // More active older accounts
      
      const estimatedTotal = Math.max(
        recentCommits * 10, // At least 10x recent activity
        Math.floor(baseEstimate * activityMultiplier * ageMultiplier)
      );

      return {
        total: estimatedTotal,
        thisWeek: weekCommits,
        thisMonth: monthCommits,
        publicRepos: profile.public_repos,
        // Additional useful stats
        accountAge: Math.floor(accountAge * 12), // Age in months
        recentActivity: recentCommits
      };
    } catch (error) {
      console.error('Error fetching GitHub commit stats:', error);
      return {
        total: 0,
        thisWeek: 0,
        thisMonth: 0,
        publicRepos: 0,
        accountAge: 0,
        recentActivity: 0
      };
    }
  },

  // Alternative method using GitHub Search API for more accurate commit counting
  getUserCommitStatsAccurate: async (username) => {
    try {
      const profile = await githubAPI.getUserProfile(username);
      
      // Use GitHub Search API to count commits by author
      // This is more accurate but has stricter rate limits
      const searchResponse = await fetch(
        `${GITHUB_API_BASE}/search/commits?q=author:${username}&per_page=1`,
        {
          headers: {
            'Accept': 'application/vnd.github.cloak-preview'
          }
        }
      );

      let totalCommits = 0;
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        totalCommits = searchData.total_count || 0;
      }

      // If search API fails, fall back to estimation method
      if (totalCommits === 0) {
        const fallbackStats = await githubAPI.getUserCommitStats(username);
        return fallbackStats;
      }

      // Get recent activity for weekly/monthly stats
      const eventsResponse = await fetch(`${GITHUB_API_BASE}/users/${username}/events/public?per_page=100`);
      let weekCommits = 0;
      let monthCommits = 0;

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const pushEvents = events.filter(event => event.type === 'PushEvent');
        
        pushEvents.forEach(event => {
          const eventDate = new Date(event.created_at);
          const commitCount = event.payload?.commits?.length || 1;
          
          if (eventDate >= oneWeekAgo) {
            weekCommits += commitCount;
          }
          if (eventDate >= oneMonthAgo) {
            monthCommits += commitCount;
          }
        });
      }

      return {
        total: totalCommits,
        thisWeek: weekCommits,
        thisMonth: monthCommits,
        publicRepos: profile.public_repos,
        method: 'search_api' // Indicate this used the more accurate method
      };
    } catch (error) {
      console.error('Error with accurate GitHub stats, falling back:', error);
      // Fall back to estimation method
      return await githubAPI.getUserCommitStats(username);
    }
  },

  // Get user's contribution activity (requires GitHub token for private data)
  getUserContributions: async (username, token = null) => {
    try {
      const headers = token ? { 'Authorization': `token ${token}` } : {};
      
      // This would require GitHub GraphQL API for contribution graph data
      // For now, we'll use the REST API limitations
      const eventsResponse = await fetch(
        `${GITHUB_API_BASE}/users/${username}/events/public?per_page=100`,
        { headers }
      );

      if (!eventsResponse.ok) {
        return { recentActivity: 0 };
      }

      const events = await eventsResponse.json();
      const recentCommitEvents = events.filter(event => 
        event.type === 'PushEvent' && 
        new Date(event.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      return {
        recentActivity: recentCommitEvents.length,
        totalEvents: events.length
      };
    } catch (error) {
      console.error('Error fetching GitHub contributions:', error);
      return { recentActivity: 0, totalEvents: 0 };
    }
  },

  // Validate if username exists
  validateUsername: async (username) => {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/users/${username}`);
      return response.ok;
    } catch (error) {
      console.error('Error validating GitHub username:', error);
      return false;
    }
  }
};