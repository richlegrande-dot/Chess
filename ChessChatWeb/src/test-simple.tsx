import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';

// Minimal test component to verify React is working
const TestApp: React.FC = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1>🎯 React Test</h1>
      <p>Counter: {count}</p>
      <button 
        onClick={() => setCount(c => c + 1)}
        style={{
          background: '#fff',
          color: '#000',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Click me
      </button>
      <div style={{ marginTop: '2rem', fontSize: '0.9rem', opacity: 0.8 }}>
        If you can see this and the counter works, React is working fine.
      </div>
    </div>
  );
};

console.log('🧪 TEST_APP_START - Loading minimal React test');

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<TestApp />);
  console.log('✅ TEST_APP_MOUNTED - React test working!');
} else {
  console.error('❌ ROOT_ELEMENT_MISSING');
}