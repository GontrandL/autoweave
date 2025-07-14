module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/health', // Admin UI
        'http://localhost:3001/builder', // Dev Studio
        'http://localhost:3002/', // User UI
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-setuid-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['error', { maxNumericValue: 3000 }],
        'interactive': ['error', { maxNumericValue: 3000 }],
        'uses-responsive-images': 'error',
        'uses-optimized-images': 'error',
        'uses-text-compression': 'error',
        'uses-rel-preconnect': 'error',
        'uses-rel-preload': 'error',
        'efficient-animated-content': 'error',
        'offscreen-images': 'error',
        'render-blocking-resources': 'error',
        'unused-css-rules': 'error',
        'unused-javascript': 'error',
        'modern-image-formats': 'error',
        'uses-webp-images': 'error',
        'uses-long-cache-ttl': 'error',
        'total-byte-weight': ['error', { maxNumericValue: 1600000 }],
        'dom-size': ['error', { maxNumericValue: 1500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};