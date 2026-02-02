/**
 * @fileoverview Health check page for monitoring
 * Returns JSON status response directly from getServerSideProps
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200
};

// Configuration
const HEALTH_CONFIG = {
  CONTENT_TYPE: 'application/json',
  STATUS_MESSAGE: 'OK'
};

/**
 * Build health check response object
 * @returns {Object} Health status with timestamp
 */
const buildHealthResponse = () => {
  return {
    status: HEALTH_CONFIG.STATUS_MESSAGE,
    timestamp: new Date().toISOString()
  };
};

/**
 * Server-side props - returns health check JSON directly
 * @param {Object} context - Next.js context
 * @param {Object} context.res - Response object
 * @returns {Object} Empty props (JSON returned directly)
 */
export async function getServerSideProps({ res }) {
  const healthResponse = buildHealthResponse();

  res.setHeader('Content-Type', HEALTH_CONFIG.CONTENT_TYPE);
  res.statusCode = HTTP_STATUS.OK;
  res.end(JSON.stringify(healthResponse));

  return { props: {} };
}

/**
 * Health page component (not rendered - JSON served from getServerSideProps)
 * @returns {null}
 */
export default function HealthPage() {
  return null;
}
