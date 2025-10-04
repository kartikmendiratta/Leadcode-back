// Direct test of GitHub API function
import { githubAPI } from './services/githubService.js';

async function testGitHubAPI() {
  console.log('Testing GitHub API function directly...');
  
  const username = 'yashsrivasta7a';
  console.log(`Testing with username: ${username}`);
  
  try {
    const result = await githubAPI.getContributionStatsGraphQL(username);
    console.log('Raw API result:', JSON.stringify(result, null, 2));
    
    console.log('Field mapping check:');
    console.log('- result.total:', result.total);
    console.log('- result.thisWeek:', result.thisWeek);
    console.log('- result.thisMonth:', result.thisMonth);
    console.log('- result.supported:', result.supported);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testGitHubAPI();