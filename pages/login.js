// Updated pages/login.js

async function verifyMFA() {
    try {
        // Add your MFA verification logic here
        await mfaVerification(); // Assume mfaVerification is your function to handle MFA
        // Redirect after successful verification
        redirectToDashboard(); // Replace with your actual redirect function
    } catch (error) {
        console.error('MFA verification failed:', error);
        // Handle error without alerting user
    }
}

function redirectToDashboard() {
    window.location.href = '/dashboard'; // Example redirect after MFA
}