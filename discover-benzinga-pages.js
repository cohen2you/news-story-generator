// Script to discover Benzinga topic pages and landing pages
// Run this in your browser console on benzinga.com to find available pages

console.log('=== Benzinga Page Discovery Tool ===');

// Function to extract topic pages from the navigation
function discoverTopicPages() {
  const topicPages = [];
  
  // Look for topic links in the navigation
  const topicLinks = document.querySelectorAll('a[href*="/topic/"]');
  topicLinks.forEach(link => {
    const href = link.getAttribute('href');
    const text = link.textContent.trim();
    if (href && text) {
      topicPages.push({
        url: href.startsWith('http') ? href : `https://www.benzinga.com${href}`,
        title: text,
        category: 'topic'
      });
    }
  });
  
  return topicPages;
}

// Function to extract market pages
function discoverMarketPages() {
  const marketPages = [];
  
  // Look for market-related links
  const marketLinks = document.querySelectorAll('a[href*="/markets"], a[href*="/earnings"], a[href*="/ratings"]');
  marketLinks.forEach(link => {
    const href = link.getAttribute('href');
    const text = link.textContent.trim();
    if (href && text) {
      marketPages.push({
        url: href.startsWith('http') ? href : `https://www.benzinga.com${href}`,
        title: text,
        category: 'market'
      });
    }
  });
  
  return marketPages;
}

// Function to extract company quote pages
function discoverCompanyPages() {
  const companyPages = [];
  
  // Look for company quote links
  const companyLinks = document.querySelectorAll('a[href*="/quote/"], a[href*="/stock/"]');
  companyLinks.forEach(link => {
    const href = link.getAttribute('href');
    const text = link.textContent.trim();
    if (href && text && !href.includes('#')) {
      companyPages.push({
        url: href.startsWith('http') ? href : `https://www.benzinga.com${href}`,
        title: text,
        category: 'company'
      });
    }
  });
  
  return companyPages;
}

// Run discovery
const topicPages = discoverTopicPages();
const marketPages = discoverMarketPages();
const companyPages = discoverCompanyPages();

console.log('=== DISCOVERED PAGES ===');
console.log('\nTopic Pages:');
topicPages.forEach(page => {
  console.log(`- ${page.title}: ${page.url}`);
});

console.log('\nMarket Pages:');
marketPages.forEach(page => {
  console.log(`- ${page.title}: ${page.url}`);
});

console.log('\nCompany Pages (first 10):');
companyPages.slice(0, 10).forEach(page => {
  console.log(`- ${page.title}: ${page.url}`);
});

// Generate mapping object for the API
console.log('\n=== MAPPING OBJECT FOR API ===');
console.log('const landingPageMap = {');

// Add topic pages
topicPages.forEach(page => {
  const key = page.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  console.log(`  '${key}': {`);
  console.log(`    url: '${page.url}',`);
  console.log(`    headline: '${page.title}',`);
  console.log(`    title: '${page.title}'`);
  console.log(`  },`);
});

console.log('};');

// Save to localStorage for easy access
localStorage.setItem('benzingaPages', JSON.stringify({
  topicPages,
  marketPages,
  companyPages: companyPages.slice(0, 50) // Limit to first 50
}));

console.log('\n=== DISCOVERY COMPLETE ===');
console.log('Pages saved to localStorage. Access with: JSON.parse(localStorage.getItem("benzingaPages"))'); 