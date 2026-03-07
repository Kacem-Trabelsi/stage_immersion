import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext'; // ✅ Add this import
import Login from './feature-module/auth/login/login';

function App() {
  return (
    <AuthProvider> {/* ✅ Wrap everything with AuthProvider */}
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Your other routes */}
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
