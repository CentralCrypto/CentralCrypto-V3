
import * as React from 'react';
import { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface WidgetErrorBoundaryProps {
  children?: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class WidgetErrorBoundary extends React.Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  // Explicitly define props to avoid TS error "Property 'props' does not exist"
  props: Readonly<WidgetErrorBoundaryProps>;

  public state: WidgetErrorBoundaryState = {
    hasError: false,
    error: undefined,
  };

  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Widget Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center bg-red-900/20 text-red-400 p-4">
          <AlertTriangle className="mb-2" />
          <h4 className="font-bold mb-1">Widget Error</h4>
          <p className="text-xs text-red-500">
            {this.state.error?.message || 'Could not load widget data.'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
