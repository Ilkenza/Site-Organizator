import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }

    static getDerivedStateFromError(_error) {
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
                <div className="p-6 bg-btn-danger/20 border border-btn-danger/50 rounded-lg">
                    <h3 className="text-lg font-semibold text-app-text-primary mb-2">Something went wrong</h3>
                    <p className="text-sm text-app-text-secondary mb-2">A client-side error occurred while loading this panel. Check the console for details.</p>
                    <details className="text-xs text-app-text-secondary max-h-48 overflow-auto">
                        <summary className="cursor-pointer hover:text-app-text-primary transition-colors">Show error</summary>
                        <pre className="whitespace-pre-wrap mt-2">{String(this.state.error)}{this.state.info?.componentStack ? '\n' + this.state.info.componentStack : ''}</pre>
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}
