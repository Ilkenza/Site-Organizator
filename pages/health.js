export async function getServerSideProps({ res }) {
  // Serve JSON directly from the /health page for compatibility
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }));
  return { props: {} };
}

export default function HealthPage() {
  // Page intentionally returns JSON from getServerSideProps
  return null;
}
