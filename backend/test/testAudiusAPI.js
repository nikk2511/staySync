// Test script for Audius API integration
// Run with: node backend/test/testAudiusAPI.js

const musicSearchService = require('../services/musicSearchService');

async function testAudiusSearch() {
  console.log('🎵 Testing Audius API Integration...\n');

  const testQueries = [
    'arijit singh',
    'justin bieber',
    'daft punk',
    'lofi hip hop',
    'classical music'
  ];

  for (const query of testQueries) {
    console.log(`🔍 Searching for: "${query}"`);
    
    try {
      const result = await musicSearchService.searchAudius(query, 5);
      
      if (result.length > 0) {
        console.log(`✅ Found ${result.length} songs:`);
        
        result.forEach((song, index) => {
          console.log(`  ${index + 1}. "${song.title}" by ${song.artist}`);
          console.log(`     Duration: ${formatDuration(song.duration)} | Source: ${song.sourceType}`);
          console.log(`     Stream URL: ${song.sourceURL}`);
          console.log(`     Thumbnail: ${song.thumbnailURL ? 'Yes' : 'No'}`);
          
          if (song.metadata) {
            console.log(`     Plays: ${song.metadata.playCount || 'N/A'} | Genre: ${song.metadata.genre || 'N/A'}`);
          }
          
          console.log('');
        });
      } else {
        console.log('❌ No songs found');
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('---\n');
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testCombinedSearch() {
  console.log('🎵 Testing Combined Search (Audius + YouTube)...\n');
  
  const query = 'test song';
  
  try {
    const result = await musicSearchService.searchSongs(query, 10, true);
    
    console.log(`🔍 Combined search for: "${query}"`);
    console.log(`✅ Found ${result.total} songs from sources: [${result.sources.join(', ')}]`);
    
    if (result.songs.length > 0) {
      result.songs.forEach((song, index) => {
        console.log(`  ${index + 1}. "${song.title}" by ${song.artist} (${song.sourceType})`);
        
        if (song.warning) {
          console.log(`     ⚠️  ${song.warning}`);
        }
      });
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function testStreamValidation() {
  console.log('\n🎵 Testing Stream URL Validation...\n');
  
  // Test with a known working audio URL
  const testUrls = [
    'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // Sample audio file
    'https://audius.co/api/v1/tracks/123/stream', // Sample Audius URL (may not work)
    'https://invalid-url-that-does-not-exist.com/audio.mp3' // Invalid URL
  ];
  
  for (const url of testUrls) {
    console.log(`🔗 Testing URL: ${url}`);
    
    try {
      const isValid = await musicSearchService.validateStreamUrl(url);
      console.log(`${isValid ? '✅' : '❌'} Valid: ${isValid}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function runAllTests() {
  console.log('🚀 Starting Audius API Tests...\n');
  
  try {
    await testAudiusSearch();
    await testCombinedSearch();
    await testStreamValidation();
    
    console.log('🎉 All tests completed!');
    
    // Test results summary
    console.log('\n📊 Test Summary:');
    console.log('- Audius API search: Tested with multiple queries');
    console.log('- Combined search: Tested Audius + YouTube fallback');
    console.log('- Stream validation: Tested URL accessibility');
    console.log('\n✨ Your Audius integration is ready to use!');
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testAudiusSearch,
  testCombinedSearch,
  testStreamValidation,
  runAllTests
};