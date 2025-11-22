import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import axios from 'axios';
import './App.css';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_URL = 'http://localhost:8000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetchHistory();
    }
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/login/' : '/register/';
      const payload = isLogin ? { username, password } : { username, password, email };
      
      const response = await axios.post(`${API_URL}${endpoint}`, payload);
      
      setToken(response.data.token);
      localStorage.setItem('token', response.data.token);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    setData(null);
    setSummary(null);
    setHistory([]);
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/history/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setHistory(response.data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/upload/`, formData, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setData(response.data.data);
      setSummary(response.data.summary);
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (datasetId) => {
    try {
      const response = await axios.get(`${API_URL}/generate-pdf/${datasetId}/`, {
        headers: { Authorization: `Token ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${datasetId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download PDF');
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Chemical Equipment Visualizer</h1>
          <h2>{isLogin ? 'Login' : 'Register'}</h2>
          
          <form onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            
            {!isLogin && (
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            {error && <div className="error">{error}</div>}
            
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
            </button>
          </form>
          
          <p onClick={() => setIsLogin(!isLogin)} style={{cursor: 'pointer', marginTop: '1rem'}}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </p>
        </div>
      </div>
    );
  }

  const pieData = summary ? {
    labels: Object.keys(summary.equipment_types),
    datasets: [{
      data: Object.values(summary.equipment_types),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
    }]
  } : null;

  const barData = summary ? {
    labels: ['Flowrate', 'Pressure', 'Temperature'],
    datasets: [{
      label: 'Average Values',
      data: [summary.avg_flowrate, summary.avg_pressure, summary.avg_temperature],
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
    }]
  } : null;

  return (
    <div className="app">
      <header>
        <h1>Chemical Equipment Parameter Visualizer</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      <div className="container">
        <div className="upload-section">
          <h2>Upload CSV File</h2>
          <input type="file" accept=".csv" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={loading || !file}>
            {loading ? 'Uploading...' : 'Upload & Analyze'}
          </button>
          {error && <div className="error">{error}</div>}
        </div>

        {summary && (
          <div className="summary-section">
            <h2>Summary Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Equipment</h3>
                <p>{summary.total_count}</p>
              </div>
              <div className="stat-card">
                <h3>Avg Flowrate</h3>
                <p>{summary.avg_flowrate}</p>
              </div>
              <div className="stat-card">
                <h3>Avg Pressure</h3>
                <p>{summary.avg_pressure}</p>
              </div>
              <div className="stat-card">
                <h3>Avg Temperature</h3>
                <p>{summary.avg_temperature}</p>
              </div>
            </div>
          </div>
        )}

        {summary && (
          <div className="charts-section">
            <div className="chart">
              <h3>Equipment Type Distribution</h3>
              <Pie data={pieData} />
            </div>
            <div className="chart">
              <h3>Average Parameters</h3>
              <Bar data={barData} />
            </div>
          </div>
        )}

        {data && (
          <div className="table-section">
            <h2>Equipment Data</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Equipment Name</th>
                    <th>Type</th>
                    <th>Flowrate</th>
                    <th>Pressure</th>
                    <th>Temperature</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row['Equipment Name']}</td>
                      <td>{row['Type']}</td>
                      <td>{row['Flowrate']}</td>
                      <td>{row['Pressure']}</td>
                      <td>{row['Temperature']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="history-section">
            <h2>Upload History (Last 5)</h2>
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div>
                    <h4>{item.filename}</h4>
                    <p>{new Date(item.uploaded_at).toLocaleString()}</p>
                    <p>Count: {item.total_count} | Avg Flowrate: {item.avg_flowrate.toFixed(2)}</p>
                  </div>
                  <button onClick={() => downloadPDF(item.id)}>Download PDF</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;