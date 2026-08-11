import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider,GoogleLogin } from "@react-oauth/google";
import "./styles/theme.css";
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);

reportWebVitals();