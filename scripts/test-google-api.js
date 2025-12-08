#!/usr/bin/env node

// Direct test of Google Custom Search API
import axios from 'axios';

async function testGoogleAPI() {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.error('Missing API credentials');
    process.exit(1);
  }

  console.log('Testing Google Custom Search API...');
  console.log('API Key:', apiKey.substring(0, 10) + '...');
  console.log('Search Engine ID:', searchEngineId);

  try {
    // Basic test
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: 'test',
        num: 1,
      },
      timeout: 10000,
    });

    console.log('✅ API Connection successful!');
    console.log('Results found:', response.data.searchInformation?.totalResults || 0);
    console.log('Items returned:', response.data.items?.length || 0);

    if (response.data.items && response.data.items.length > 0) {
      console.log('Sample result:', response.data.items[0].title);
    }
  } catch (error) {
    console.error('❌ API Test failed:');
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      console.error('Error code:', apiError.code);
      console.error('Error message:', apiError.message);
      console.error('Error status:', apiError.status);

      if (apiError.code === 400) {
        console.error('\nPossible causes:');
        console.error('1. Custom Search Engine not fully activated (wait 5-10 minutes)');
        console.error('2. Search Engine ID is incorrect');
        console.error('3. API key restrictions in Google Cloud Console');
        console.error('4. Custom Search Engine not configured for "Search entire web"');
      }
    } else {
      console.error('Network error:', error.message);
    }
  }
}

testGoogleAPI();
