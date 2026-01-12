const SUPABASE_CONFIG = {
    url: 'https://skacyhzljreaitrbgbte.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrYWN5aHpsanJlYWl0cmJnYnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTg2NjksImV4cCI6MjA4MzIzNDY2OX0.KcBnl6l_zg9lTcVgFs2yDq4-F-1TKsyiWGNOoxQ_bdc'
};

// Pricing options - central configuration
const PRICING_OPTIONS = [
    { value: '', label: 'Select pricing model...' }, // Empty option at top
    { value: 'fully_free', label: 'Fully Free' },
    { value: 'paid', label: 'Paid' },
    { value: 'free_trial', label: 'Free Trial' },
    { value: 'freemium', label: 'Freemium' }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SUPABASE_CONFIG;
}