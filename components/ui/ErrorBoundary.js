import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught an error:', error, info);
        this.setState({ error, info });
        // Optionally send to remote logging here
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 bg-red-900/40 border border-red-800 rounded-lg">
                    <h3 className="text-lg font-semibold text-red-300 mb-2">Something went wrong</h3>
                    <p className="text-sm text-red-200 mb-2">A client-side error occurred while loading this panel. Check the console for details.</p>
                    <details className="text-xs text-red-100 max-h-48 overflow-auto">
                        <summary className="cursor-pointer">Show error</summary>
                        <pre className="whitespace-pre-wrap">{String(this.state.error)}\n{this.state.info?.componentStack}</pre>
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}
