import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import Notes from './pages/Notes';

function App() {
  const RequireAuth = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" />;
    return children;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/notes" element={<RequireAuth><Notes /></RequireAuth>} />
        <Route path="*" element={<RequireAuth><Dashboard /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App;
