import representativePaths from './scripts/lighthouse-urls.json' with { type: 'json' };

const config = {
  staticDistDir: './dist',
  paths: representativePaths,
  settings: {
    skipAudits: ['llms-txt', 'ard-schema'],
  },
  thresholds: {
    categories: {
      performance: 0.98,
      accessibility: 1,
      'best-practices': 1,
      seo: 1,
    },
    warnCategories: {
      'agentic-browsing': 0.98,
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
