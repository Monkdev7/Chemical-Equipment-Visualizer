import React, { useState, useEffect } from 'react';
import { 
  Upload, Database, BarChart3, FileText, Download, AlertCircle, CheckCircle, Loader2, 
  TrendingUp, Activity, Settings, Menu, X, LogOut, User
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/datasets/`);
      const data = await response.json();
      setDatasets(data);
      if (data.length > 0 && !selectedDataset) {
        fetchDatasetDetails(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching datasets:', error);
    }
  };

  const fetchDatasetDetails = async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/datasets/${id}/`);
      const data = await response.json();
      setSelectedDataset(data);
    } catch (error) {
      console.error('Error fetching dataset details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    setUploadStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/datasets/upload/`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadStatus({ type: 'success', message: 'File uploaded successfully!' });
        setSelectedDataset(data);
        fetchDatasets();
        setActiveSection('dashboard');
      } else {
        const error = await response.json();
        setUploadStatus({ type: 'error', message: error.error || 'Upload failed' });
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: 'Network error during upload' });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (datasetId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/generate_pdf/`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `equipment_report_${datasetId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDeleteDataset = async (datasetId) => {
    if (!window.confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from datasets list
        setDatasets(datasets.filter(d => d.id !== datasetId));
        
        // If deleted dataset was selected, clear it and show upload message
        if (selectedDataset?.id === datasetId) {
          setSelectedDataset(null);
          setUploadStatus(null); // Clear any upload messages
          setActiveSection('upload');
        }
      } else {
        alert('Failed to delete dataset');
      }
    } catch (error) {
      console.error('Error deleting dataset:', error);
      alert('Error deleting dataset');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'history', label: 'History', icon: Database },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:static lg:translate-x-0`}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-400 to-cyan-400 p-2 rounded-lg">
              <Activity className="h-6 w-6 text-slate-900" />
            </div>
            <span className="font-bold text-lg">EquipViz</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <nav className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {navItems.find(item => item.id === activeSection)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-lg">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                EZ
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">Chemical</p>
                <p className="text-gray-600">Equipment </p>
              </div>
            </div>
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          {activeSection === 'dashboard' && <DashboardSection selectedDataset={selectedDataset} downloadPDF={downloadPDF} loading={loading} setActiveSection={setActiveSection} />}
          {activeSection === 'upload' && <UploadSection handleFileUpload={handleFileUpload} uploadStatus={uploadStatus} setUploadStatus={setUploadStatus} loading={loading} />}
          {activeSection === 'history' && <HistorySection datasets={datasets} fetchDatasetDetails={fetchDatasetDetails} downloadPDF={downloadPDF} handleDeleteDataset={handleDeleteDataset} />}
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

// Dashboard Section
function DashboardSection({ selectedDataset, downloadPDF, loading, setActiveSection }) {
  const [selectedChart, setSelectedChart] = useState('typeDistribution');

  if (!selectedDataset) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="bg-white rounded-xl shadow-lg p-12 text-center max-w-md">
          <Upload className="h-20 w-20 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Dataset Selected</h2>
          <p className="text-gray-600 mb-6">Get started by uploading a CSV file with your chemical equipment data.</p>
          <button 
            onClick={() => setActiveSection('upload')}
            className="inline-block bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold py-3 px-8 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105 transform"
          >
            Go to Upload Section
          </button>
        </div>
      </div>
    );
  }

  const summary = selectedDataset.summary || {};
  const typeDistribution = summary.type_distribution || {};

  const chartOptions = [
    { id: 'typeDistribution', label: '📊 Type Distribution (Bar)', icon: BarChart3 },
    { id: 'parameterComparison', label: '📈 Parameter Comparison', icon: TrendingUp },
    { id: 'typeDistributionPie', label: '🥧 Type Distribution (Pie)', icon: Database },
    { id: 'parameterRanges', label: '📉 Parameter Ranges', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 rounded-xl p-8 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold mb-2">{selectedDataset.filename}</h2>
            <p className="text-blue-100">
              Uploaded: {new Date(selectedDataset.uploaded_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => downloadPDF(selectedDataset.id)}
            className="bg-white text-blue-600 hover:bg-blue-50 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Download className="h-5 w-5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={Database}
          label="Total Records"
          value={summary.total_count || 0}
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Flowrate"
          value={summary.avg_flowrate?.toFixed(2) || 0}
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          icon={Activity}
          label="Avg Pressure"
          value={summary.avg_pressure?.toFixed(2) || 0}
          gradient="from-purple-500 to-purple-600"
        />
        <StatCard
          icon={Settings}
          label="Avg Temperature"
          value={summary.avg_temperature?.toFixed(2) || 0}
          gradient="from-red-500 to-rose-600"
        />
      </div>

      {/* Chart Selector Dropdown & Display */}
      <div className="bg-white rounded-xl shadow-lg p-11">
        {/* Dropdown */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-lg font-bold text-gray-900">Select Chart:</label>
          <select
            value={selectedChart}
            onChange={(e) => setSelectedChart(e.target.value)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 focus:outline-none focus:border-blue-600 bg-white hover:border-blue-400 transition-colors"
          >
            {chartOptions.map((chart) => (
              <option key={chart.id} value={chart.id}>
                {chart.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chart Display Component */}
        <ChartDisplay 
          selectedChart={selectedChart} 
          typeDistribution={typeDistribution}
          summary={summary}
          equipmentRecords={selectedDataset.equipment_records}
        />
      </div>

      {/* Equipment Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-green-600" />
            Equipment Records
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Equipment Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Flowrate</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Pressure</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Temperature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {selectedDataset.equipment_records?.slice(0, 20).map((equipment, idx) => (
                <tr key={equipment.id} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{equipment.equipment_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{equipment.equipment_type}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{equipment.flowrate.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{equipment.pressure.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{equipment.temperature.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Upload Section
function UploadSection({ handleFileUpload, uploadStatus, setUploadStatus, loading }) {
  return (
    <div className="flex items-center justify-center min-h-full">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl p-12 border-2 border-dashed border-blue-300">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-full">
                <Upload className="h-12 w-12 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Upload CSV File</h2>
            <p className="text-gray-600 text-lg mb-8">
              Upload a CSV file containing chemical equipment data for analysis
            </p>
            
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl mb-8 text-left border border-blue-200">
              <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Required Columns:
              </p>
              <ul className="text-sm text-gray-700 space-y-2 ml-7">
                <li>• Equipment Name</li>
                <li>• Type</li>
                <li>• Flowrate</li>
                <li>• Pressure</li>
                <li>• Temperature</li>
              </ul>
            </div>

            <label className="inline-block cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-4 px-10 rounded-xl transition-all duration-200 inline-flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-6 w-6" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    Choose File
                  </>
                )}
              </div>
            </label>

            {uploadStatus && (
              <div className={`mt-8 p-4 rounded-lg border-2 ${
                uploadStatus.type === 'success' 
                  ? 'bg-green-50 border-green-300' 
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3">
                    {uploadStatus.type === 'success' ? (
                      <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600 shrink-0" />
                    )}
                    <span className={uploadStatus.type === 'success' ? 'text-green-800 font-medium' : 'text-red-800 font-medium'}>
                      {uploadStatus.message}
                    </span>
                  </div>
                  <button
                    onClick={() => setUploadStatus(null)}
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-200 p-1 rounded-lg transition-all duration-200 transform hover:scale-110"
                    title="Dismiss"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// History Section
function HistorySection({ datasets, fetchDatasetDetails, downloadPDF, handleDeleteDataset }) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Upload History</h2>
        <p className="text-gray-600 mt-2">Last 5 uploaded datasets</p>
      </div>

      {datasets.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-xl shadow-lg p-12 h-96">
          <Database className="h-20 w-20 text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg font-medium">No datasets uploaded yet</p>
          <p className="text-gray-500 mt-2">Upload a CSV file to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {datasets.map((dataset) => (
            <div
              key={dataset.id}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 cursor-pointer border-l-4 border-blue-600 hover:border-cyan-600"
              onClick={() => fetchDatasetDetails(dataset.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-6 w-6 text-blue-600" />
                    <h3 className="font-bold text-lg text-gray-900">{dataset.filename}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    {new Date(dataset.uploaded_at).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div className="bg-blue-50 px-4 py-2 rounded-lg">
                      <p className="text-gray-600"><span className="font-semibold text-gray-900">Records:</span> {dataset.total_records}</p>
                    </div>
                    {dataset.summary && (
                      <>
                        <div className="bg-green-50 px-4 py-2 rounded-lg">
                          <p className="text-gray-600"><span className="font-semibold text-gray-900">Avg Flow:</span> {dataset.summary.avg_flowrate?.toFixed(2)}</p>
                        </div>
                        <div className="bg-purple-50 px-4 py-2 rounded-lg">
                          <p className="text-gray-600"><span className="font-semibold text-gray-900">Types:</span> {Object.keys(dataset.summary.type_distribution || {}).length}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPDF(dataset.id);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-3 rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-110"
                    title="Download PDF"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDataset(dataset.id);
                    }}
                    className="bg-gradient-to-r from-red-600 to-red-700 text-white p-3 rounded-lg hover:shadow-lg transition-all duration-200 transform hover:scale-110"
                    title="Delete dataset"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper Components
const StatCard = ({ icon: Icon, label, value, gradient }) => (
  <div className={`bg-gradient-to-br ${gradient} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105`}>
    <div className="flex items-center justify-between mb-4">
      <Icon className="h-8 w-8 opacity-80" />
    </div>
    <p className="text-4xl font-bold mb-2">{value}</p>
    <p className="text-sm opacity-90 font-medium">{label}</p>
  </div>
);

const ParameterRange = ({ label, min, max, avg, color }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    red: 'from-red-500 to-rose-600',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-3">
        <span className="font-bold text-gray-900">{label}</span>
        <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded text-xs font-medium">
          Min: {min?.toFixed(2)} | Max: {max?.toFixed(2)}
        </span>
      </div>
      <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`bg-gradient-to-r ${colorClasses[color]} h-3 rounded-full opacity-30 w-full`}
        />
        <div
          className={`absolute top-0 bg-gradient-to-r ${colorClasses[color]} h-3 w-3 rounded-full shadow-lg`}
          style={{
            left: `${((avg - min) / (max - min)) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      <div className="text-xs text-center text-gray-600 mt-2 font-semibold">
        Average: {avg?.toFixed(2)}
      </div>
    </div>
  );
};

// Chart Display Component - Shows different charts based on selection
function ChartDisplay({ selectedChart, typeDistribution, summary, equipmentRecords }) {
  const chartHeight = 400;

  switch (selectedChart) {
    case 'typeDistribution':
      return (
        <div style={{ position: 'relative', height: `${chartHeight}px` }}>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Equipment Type Distribution
          </h3>
          {Object.keys(typeDistribution).length > 0 ? (
            <Bar
              data={{
                labels: Object.keys(typeDistribution),
                datasets: [
                  {
                    label: 'Count',
                    data: Object.values(typeDistribution),
                    backgroundColor: [
                      'rgba(59, 130, 246, 0.8)',
                      'rgba(16, 185, 129, 0.8)',
                      'rgba(139, 92, 246, 0.8)',
                      'rgba(239, 68, 68, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(14, 165, 233, 0.8)',
                    ],
                    borderColor: [
                      'rgb(59, 130, 246)',
                      'rgb(16, 185, 129)',
                      'rgb(139, 92, 246)',
                      'rgb(239, 68, 68)',
                      'rgb(245, 158, 11)',
                      'rgb(14, 165, 233)',
                    ],
                    borderWidth: 2,
                    borderRadius: 8,
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                  x: { 
                    grid: { display: false },
                    ticks: {
                      padding: 10,
                      font: { size: 16 }
                    }
                  }
                }
              }}
            />
          ) : (
            <div className="text-center text-gray-500 py-20">No data available</div>
          )}
        </div>
      );

    case 'parameterComparison':
      return (
        <div style={{ position: 'relative', height: `${chartHeight}px` }}>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-6 w-6 text-purple-600" />
            Parameter Comparison (Min / Avg / Max)
          </h3>
          <Bar
            data={{
              labels: ['Flowrate', 'Pressure', 'Temperature'],
              datasets: [
                {
                  label: 'Min',
                  data: [summary.min_flowrate || 0, summary.min_pressure || 0, summary.min_temperature || 0],
                  backgroundColor: 'rgba(239, 68, 68, 0.8)',
                  borderColor: 'rgb(239, 68, 68)',
                  borderWidth: 2,
                  borderRadius: 8,
                },
                {
                  label: 'Avg',
                  data: [summary.avg_flowrate || 0, summary.avg_pressure || 0, summary.avg_temperature || 0],
                  backgroundColor: 'rgba(59, 130, 246, 0.8)',
                  borderColor: 'rgb(59, 130, 246)',
                  borderWidth: 2,
                  borderRadius: 8,
                },
                {
                  label: 'Max',
                  data: [summary.max_flowrate || 0, summary.max_pressure || 0, summary.max_temperature || 0],
                  backgroundColor: 'rgba(16, 185, 129, 0.8)',
                  borderColor: 'rgb(16, 185, 129)',
                  borderWidth: 2,
                  borderRadius: 8,
                }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: true, position: 'top' }
              },
              scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                x: { 
                  grid: { display: false },
                  ticks: {
                    maxRotation: 0,
                    minRotation: 0,
                    padding: 10,
                    font: { size: 16 }
                  }
                }
              }
            }}
          />
        </div>
      );

    case 'typeDistributionPie':
      return (
        <div style={{ position: 'relative', height: `${chartHeight}px` }}>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="h-6 w-6 text-green-600" />
            Type Distribution (Pie Chart)
          </h3>
          {Object.keys(typeDistribution).length > 0 ? (
            <Pie
              data={{
                labels: Object.keys(typeDistribution),
                datasets: [
                  {
                    data: Object.values(typeDistribution),
                    backgroundColor: [
                      'rgba(59, 130, 246, 0.8)',
                      'rgba(16, 185, 129, 0.8)',
                      'rgba(139, 92, 246, 0.8)',
                      'rgba(239, 68, 68, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(14, 165, 233, 0.8)',
                    ],
                    borderColor: [
                      'rgb(59, 130, 246)',
                      'rgb(16, 185, 129)',
                      'rgb(139, 92, 246)',
                      'rgb(239, 68, 68)',
                      'rgb(245, 158, 11)',
                      'rgb(14, 165, 233)',
                    ],
                    borderWidth: 2,
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { padding: 15, usePointStyle: true, font: { size: 15 } } }
                },

              }}
            />
          ) : (
            <div className="text-center text-gray-500 py-20">No data available</div>
          )}
        </div>
      );

    case 'parameterRanges':
      return (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-red-600" />
            Parameter Ranges
          </h3>
          <div className="space-y-8">
            <ParameterRange
              label="Flowrate"
              min={summary.min_flowrate}
              max={summary.max_flowrate}
              avg={summary.avg_flowrate}
              color="blue"
            />
            <ParameterRange
              label="Pressure"
              min={summary.min_pressure}
              max={summary.max_pressure}
              avg={summary.avg_pressure}
              color="purple"
            />
            <ParameterRange
              label="Temperature"
              min={summary.min_temperature}
              max={summary.max_temperature}
              avg={summary.avg_temperature}
              color="red"
            />
          </div>
        </div>
      );

    default:
      return <div className="text-center text-gray-500">Select a chart to display</div>;
  }
}

export default App;
