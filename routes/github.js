import express from 'express';
import { githubAPI } from '../services/githubService.js';

const router = express.Router();

// GET /api/github/:username/stats - Accurate contribution stats (GraphQL) with fallback
router.get('/:username/stats', async (req, res) => {
  const { username } = req.params;
  console.log('🎯 GitHub stats requested for:', username);
  if (!username) return res.status(400).json({ success: false, message: 'Username required' });
  try {
    // Try GraphQL first
    console.log('🔄 Attempting GraphQL...');
    const gql = await githubAPI.getContributionStatsGraphQL(username);
    console.log('📊 GraphQL result supported:', gql.supported);
    
    if (gql.supported) {
      console.log('✅ Returning GraphQL data');
      return res.json({ success: true, method: gql.method, stats: {
        totalCommits: gql.total,
        weeklyCommits: gql.thisWeek,
        monthlyCommits: gql.thisMonth,
        publicRepos: gql.publicRepos
      }});
    }
    
    // Fallback to existing estimation method
    console.log('🔄 Falling back to estimation, reason:', gql.reason);
    const estimate = await githubAPI.getUserCommitStats(username);
    console.log('📊 Estimation complete');
    return res.json({ success: true, method: 'estimate', fallbackReason: gql.reason, stats: {
      totalCommits: estimate.total,
      weeklyCommits: estimate.thisWeek,
      monthlyCommits: estimate.thisMonth,
      publicRepos: estimate.publicRepos ?? estimate.publicRepos === 0 ? estimate.publicRepos : 0
    }});
  } catch (e) {
    console.error('❌ GitHub stats endpoint error:', e);
    return res.status(500).json({ success: false, message: 'Failed to fetch GitHub stats', error: e.message });
  }
});

export default router;