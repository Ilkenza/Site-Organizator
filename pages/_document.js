import { Html, Head, Main, NextScript } from 'next/document';

// Compute Supabase localStorage key at build time
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const PROJECT_REF = SUPABASE_URL.replace(/^"|"$/g, '').split('//')[1]?.split('.')[0] || '';
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;

export default function Document() {
    return (
        <Html lang="en">
            <Head />
            <body>
                {/* Instant redirect: runs BEFORE React hydration so logged-in users
                    never see the landing page, even when offline */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var p=location.pathname;if(p==="/"||p==="/login"){var s=localStorage.getItem("${AUTH_KEY}");if(s){var t=JSON.parse(s);if(t&&t.access_token&&t.user){location.replace("/dashboard/sites");return}}}}catch(e){}})();`,
                    }}
                />
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
