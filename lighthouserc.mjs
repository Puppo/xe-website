import representativePaths from './scripts/lighthouse-urls.json' with { type: 'json' };

const config = {
  staticDistDir: './dist',
  paths: representativePaths,
  settings: {
    skipAudits: ['llms-txt', 'ard-schema'],
  },
  thresholds: {
    categories: {
      performance: 0.9,
      accessibility: 0.95,
      'best-practices': 0.95,
      seo: 0.95,
    },
    warnCategories: {
      'agentic-browsing': 0.8,
    },
    audits: {
      'agent-accessibility-tree': 'error',
      'webmcp-registered-tools': 'error',
      'webmcp-schema-validity': 'error',
      'webmcp-form-coverage': 'warn',
      'csp-xss': 'warn',
    },
  },
};

export default config;
