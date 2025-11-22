// ============= frontend-web/src/App.js =============
import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import axios from 'axios';
import './App.css';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const API_URL = 'http://localhost:8000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dragActive, setDragActive] = useState(false);

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
      setUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      setPassword('');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setData(null);
    setSummary(null);
    setHistory([]);
    setActiveTab('dashboard');
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

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
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
      setActiveTab('analytics');
      fetchHistory();
      setFile(null);
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

  // Chart configurations
  const pieData = summary ? {
    labels: Object.keys(summary.equipment_types),
    datasets: [{
      data: Object.values(summary.equipment_types),
      backgroundColor: [
        'rgba(99, 102, 241, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(34, 197, 94, 0.8)',
      ],
      borderColor: [
        'rgb(99, 102, 241)',
        'rgb(139, 92, 246)',
        'rgb(236, 72, 153)',
        'rgb(251, 146, 60)',
        'rgb(34, 197, 94)',
      ],
      borderWidth: 2,
    }]
  } : null;

  const barData = summary ? {
    labels: ['Flowrate', 'Pressure', 'Temperature'],
    datasets: [{
      label: 'Average Values',
      data: [summary.avg_flowrate, summary.avg_pressure, summary.avg_temperature],
      backgroundColor: [
        'rgba(99, 102, 241, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(236, 72, 153, 0.8)',
      ],
      borderColor: [
        'rgb(99, 102, 241)',
        'rgb(139, 92, 246)',
        'rgb(236, 72, 153)',
      ],
      borderWidth: 2,
      borderRadius: 8,
    }]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          font: { size: 12 }
        }
      }
    }
  };

  // Login/Register Screen
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-background"></div>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="logo-container">
                <div className="logo">⚗️</div>
                <h1>Chemical Equipment</h1>
                <p>Parameter Visualizer</p>
              </div>
            </div>
            
            <div className="auth-tabs">
              <button 
                className={isLogin ? 'active' : ''} 
                onClick={() => setIsLogin(true)}
              >
                Login
              </button>
              <button 
                className={!isLogin ? 'active' : ''} 
                onClick={() => setIsLogin(false)}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              
              {!isLogin && (
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="Enter email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              )}
              
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main Application
  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">⚗️</div>
          <div className="sidebar-title">
            <h2>Equipment</h2>
            <span>Visualizer</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="icon">📊</span>
            Dashboard
          </button>
          <button 
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            <span className="icon">📤</span>
            Upload Data
          </button>
          <button 
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
            disabled={!summary}
          >
            <span className="icon">📈</span>
            Analytics
          </button>
          <button 
            className={activeTab === 'data' ? 'active' : ''}
            onClick={() => setActiveTab('data')}
            disabled={!data}
          >
            <span className="icon">📋</span>
            Data Table
          </button>
          <button 
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
          >
            <span className="icon">🕐</span>
            History
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{username[0]?.toUpperCase()}</div>
            <div className="user-details">
              <div className="user-name">{username}</div>
              <div className="user-role">Administrator</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div className="header-actions">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search..." />
            </div>
            <button className="notification-btn">
              🔔
              <span className="badge">3</span>
            </button>
          </div>
        </header>

        <div className="content-area">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="dashboard">
              <div className="stats-grid">
                <div className="stat-card blue">
                  <div className="stat-icon">📦</div>
                  <div className="stat-content">
                    <h3>Total Datasets</h3>
                    <p className="stat-value">{history.length}</p>
                    <span className="stat-change">↑ Active</span>
                  </div>
                </div>

                <div className="stat-card purple">
                  <div className="stat-icon">⚙️</div>
                  <div className="stat-content">
                    <h3>Equipment Count</h3>
                    <p className="stat-value">{summary?.total_count || 0}</p>
                    <span className="stat-change">Current dataset</span>
                  </div>
                </div>

                <div className="stat-card pink">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <h3>Avg Flowrate</h3>
                    <p className="stat-value">{summary?.avg_flowrate?.toFixed(1) || 0}</p>
                    <span className="stat-change">Units/hr</span>
                  </div>
                </div>

                <div className="stat-card orange">
                  <div className="stat-icon">🌡️</div>
                  <div className="stat-content">
                    <h3>Avg Temperature</h3>
                    <p className="stat-value">{summary?.avg_temperature?.toFixed(1) || 0}°</p>
                    <span className="stat-change">Celsius</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Quick Upload</h3>
                  <p className="card-subtitle">Upload a new CSV file to analyze</p>
                  <button 
                    className="action-btn primary"
                    onClick={() => setActiveTab('upload')}
                  >
                    Upload New File
                  </button>
                </div>

                <div className="dashboard-card">
                  <h3>Recent Activity</h3>
                  <div className="activity-list">
                    {history.slice(0, 3).map((item) => (
                      <div key={item.id} className="activity-item">
                        <div className="activity-icon">📄</div>
                        <div className="activity-details">
                          <p className="activity-title">{item.filename}</p>
                          <span className="activity-time">
                            {new Date(item.uploaded_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="upload-section">
              <div className="upload-card">
                <h2>Upload CSV File</h2>
                <p className="upload-description">
                  Upload your equipment data CSV file for analysis and visualization
                </p>

                <div 
                  className={`dropzone ${dragActive ? 'active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    id="file-input"
                    style={{ display: 'none' }}
                  />
                  
                  <div className="dropzone-content">
                    <div className="dropzone-icon">📁</div>
                    {file ? (
                      <div className="file-selected">
                        <p className="file-name">{file.name}</p>
                        <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <>
                        <h3>Drag & Drop your CSV file here</h3>
                        <p>or</p>
                        <label htmlFor="file-input" className="browse-btn">
                          Browse Files
                        </label>
                        <p className="file-requirements">
                          Required columns: Equipment Name, Type, Flowrate, Pressure, Temperature
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="upload-actions">
                  {file && (
                    <button 
                      className="clear-btn"
                      onClick={() => setFile(null)}
                    >
                      Clear
                    </button>
                  )}
                  <button 
                    className="upload-btn"
                    onClick={handleUpload}
                    disabled={loading || !file}
                  >
                    {loading ? (
                      <>
                        <span className="loading-spinner"></span>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <span>📤</span>
                        Upload & Analyze
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && summary && (
            <div className="analytics-section">
              <div className="summary-cards">
                <div className="summary-card">
                  <h4>Total Equipment</h4>
                  <p className="summary-value">{summary.total_count}</p>
                </div>
                <div className="summary-card">
                  <h4>Avg Flowrate</h4>
                  <p className="summary-value">{summary.avg_flowrate.toFixed(2)}</p>
                </div>
                <div className="summary-card">
                  <h4>Avg Pressure</h4>
                  <p className="summary-value">{summary.avg_pressure.toFixed(2)}</p>
                </div>
                <div className="summary-card">
                  <h4>Avg Temperature</h4>
                  <p className="summary-value">{summary.avg_temperature.toFixed(2)}°</p>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-card">
                  <h3>Equipment Type Distribution</h3>
                  <div className="chart-container">
                    <Pie data={pieData} options={chartOptions} />
                  </div>
                </div>

                <div className="chart-card">
                  <h3>Average Parameters</h3>
                  <div className="chart-container">
                    <Bar data={barData} options={chartOptions} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Table Tab */}
          {activeTab === 'data' && data && (
            <div className="table-section">
              <div className="table-card">
                <div className="table-header">
                  <h3>Equipment Data</h3>
                  <span className="record-count">{data.length} records</span>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
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
                          <td>
                            <span className="type-badge">{row['Type']}</span>
                          </td>
                          <td>{row['Flowrate']}</td>
                          <td>{row['Pressure']}</td>
                          <td>{row['Temperature']}°</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="history-section">
              <div className="history-header">
                <h2>Upload History</h2>
                <button className="refresh-btn" onClick={fetchHistory}>
                  🔄 Refresh
                </button>
              </div>

              <div className="history-grid">
                {history.map((item) => (
                  <div key={item.id} className="history-card">
                    <div className="history-card-header">
                      <div className="file-icon">📄</div>
                      <div className="history-info">
                        <h4>{item.filename}</h4>
                        <p className="history-date">
                          {new Date(item.uploaded_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="history-stats">
                      <div className="history-stat">
                        <span className="stat-label">Equipment</span>
                        <span className="stat-number">{item.total_count}</span>
                      </div>
                      <div className="history-stat">
                        <span className="stat-label">Flowrate</span>
                        <span className="stat-number">{item.avg_flowrate.toFixed(1)}</span>
                      </div>
                      <div className="history-stat">
                        <span className="stat-label">Pressure</span>
                        <span className="stat-number">{item.avg_pressure.toFixed(1)}</span>
                      </div>
                    </div>

                    <button 
                      className="download-pdf-btn"
                      onClick={() => downloadPDF(item.id)}
                    >
                      📥 Download Report
                    </button>
                  </div>
                ))}

                {history.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h3>No upload history</h3>
                    <p>Upload your first CSV file to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;