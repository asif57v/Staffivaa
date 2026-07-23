import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
  }
  
  render() {
    if (this.state.error) {
      return (
        <div style={{padding: '20px', color: 'red', background: 'black', height: '100vh', width: '100vw', zIndex: 9999, position: 'fixed', top: 0, left: 0}}>
          <h1 style={{color:'red'}}>Error</h1>
          <pre style={{whiteSpace: 'pre-wrap'}}>{this.state.error.toString()}</pre>
          <pre style={{whiteSpace: 'pre-wrap', fontSize: '10px'}}>{this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
