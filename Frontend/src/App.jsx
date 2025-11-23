import React, { useState, useEffect } from 'react';
import { 
  Upload, Database, BarChart3, FileText, Download, AlertCircle, CheckCircle, Loader2, 
  TrendingUp, Activity, Settings, Menu, X, Trash2, Eye, ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from 'recharts';

const API_BASE_URL = 'https://chemical-equipment-parameter-visualizer-7ckc.onrender.com/api';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

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
        setUploadStatus({ type: 'success', message: 'Dataset uploaded and analyzed successfully!' });
        setSelectedDataset(data);
        fetchDatasets();
        setActiveSection('overview');
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
      a.download = `equipment_analysis_${datasetId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDeleteDataset = async (datasetId) => {
    if (!window.confirm('Delete this dataset permanently? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDatasets(datasets.filter(d => d.id !== datasetId));
        
        if (selectedDataset?.id === datasetId) {
          setSelectedDataset(null);
          setUploadStatus(null);
          setActiveSection('import');
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
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'import', label: 'Import Data', icon: Upload },
    { id: 'archive', label: 'Archive', icon: Database },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:static lg:translate-x-0`}>
        {/* Logo */}
        <div className="h-20 flex items-center px-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2.5 rounded-xl">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl text-slate-900">ChemFlow</span>
              <p className="text-xs text-slate-500">Analytics Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-6 space-y-2">
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
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-200">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                CE
              </div>
              <div className="text-sm">
                <p className="font-semibold text-slate-900">Chemical Eng.</p>
                <p className="text-slate-500 text-xs">Department</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {navItems.find(item => item.id === activeSection)?.label}
              </h1>
              <p className="text-sm text-slate-500">Chemical Equipment Analysis System</p>
            </div>
          </div>

          {selectedDataset && (
            <button
              onClick={() => downloadPDF(selectedDataset.id)}
              className="hidden md:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {activeSection === 'overview' && <OverviewSection selectedDataset={selectedDataset} setActiveSection={setActiveSection} />}
          {activeSection === 'analytics' && <AnalyticsSection selectedDataset={selectedDataset} setActiveSection={setActiveSection} />}
          {activeSection === 'import' && <ImportSection handleFileUpload={handleFileUpload} uploadStatus={uploadStatus} setUploadStatus={setUploadStatus} loading={loading} />}
          {activeSection === 'archive' && <ArchiveSection datasets={datasets} fetchDatasetDetails={fetchDatasetDetails} downloadPDF={downloadPDF} handleDeleteDataset={handleDeleteDataset} setActiveSection={setActiveSection} />}
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

// Overview Section
function OverviewSection({ selectedDataset, setActiveSection }) {
  if (!selectedDataset) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Upload className="h-10 w-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">No Active Dataset</h2>
          <p className="text-slate-600 mb-6">Import a CSV file to begin analyzing your chemical equipment data.</p>
          <button 
            onClick={() => setActiveSection('import')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Import Dataset
          </button>
        </div>
      </div>
    );
  }

  const summary = selectedDataset.summary || {};
  const typeDistData = Object.entries(summary.type_distribution || {}).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#818cf8', '#34d399', '#a78bfa', '#fb923c', '#fbbf24', '#38bdf8'];

  return (
    <div className="space-y-6">
      {/* Dataset Info Card */}
      <div className="bg-white rounded-2xl p-8 border border-slate-200">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedDataset.filename}</h2>
            <p className="text-slate-500">
              Imported on {new Date(selectedDataset.uploaded_at).toLocaleDateString()} at {new Date(selectedDataset.uploaded_at).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-medium">
            <CheckCircle className="h-4 w-4" />
            Active
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Records"
            value={summary.total_count || 0}
            icon={Database}
            color="blue"
          />
          <MetricCard
            label="Equipment Types"
            value={Object.keys(summary.type_distribution || {}).length}
            icon={Settings}
            color="purple"
          />
          <MetricCard
            label="Avg Flow Rate"
            value={summary.avg_flowrate?.toFixed(1) || 0}
            icon={Activity}
            color="emerald"
          />
          <MetricCard
            label="Avg Temperature"
            value={summary.avg_temperature?.toFixed(1) || 0}
            icon={TrendingUp}
            color="orange"
          />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            Type Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeDistData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {typeDistData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Parameter Overview
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: 'Flow Rate', value: summary.avg_flowrate || 0 },
                { name: 'Pressure', value: summary.avg_pressure || 0 },
                { name: 'Temperature', value: summary.avg_temperature || 0 }
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Equipment Table Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Equipment Records Preview
          </h3>
          <button 
            onClick={() => setActiveSection('analytics')}
            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1"
          >
            View All <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Flow</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Pressure</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Temp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedDataset.equipment_records?.slice(0, 10).map((equipment) => (
                <tr key={equipment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{equipment.equipment_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{equipment.equipment_type}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{equipment.flowrate.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{equipment.pressure.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{equipment.temperature.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Analytics Section
function AnalyticsSection({ selectedDataset, setActiveSection }) {
  const [selectedView, setSelectedView] = useState('distribution');

  if (!selectedDataset) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">No dataset available for analytics</p>
          <button 
            onClick={() => setActiveSection('import')}
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Import a dataset
          </button>
        </div>
      </div>
    );
  }

  const summary = selectedDataset.summary || {};

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200">
        <label className="block text-sm font-semibold text-slate-700 mb-3">Select Chart:</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'distribution', label: '📊 Type Distribution (Bar)' },
            { id: 'comparison', label: '📈 Parameter Comparison' },
            { id: 'pie', label: '🥧 Type Distribution (Pie)' },
            { id: 'ranges', label: '📉 Parameter Ranges' }
          ].map(view => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id)}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${
                selectedView === view.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Display */}
      <div className="bg-white rounded-2xl p-8 border border-slate-200">
        <AnalyticsChart 
          view={selectedView}
          summary={summary}
          records={selectedDataset.equipment_records}
        />
      </div>
    </div>
  );
}

// Import Section
function ImportSection({ handleFileUpload, uploadStatus, setUploadStatus, loading }) {
  return (
    <div className="flex items-center justify-center min-h-full">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-2xl p-10 border-2 border-dashed border-slate-300">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Upload className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Import CSV Dataset</h2>
            <p className="text-slate-600 mb-8">
              Upload your chemical equipment data for comprehensive analysis
            </p>
            
            <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left border border-slate-200">
              <p className="text-sm font-semibold text-slate-900 mb-3">Required Columns:</p>
              <ul className="text-sm text-slate-600 space-y-1.5">
                <li>• Equipment Name</li>
                <li>• Type</li>
                <li>• Flowrate</li>
                <li>• Pressure</li>
                <li>• Temperature</li>
              </ul>
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              <div className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 px-8 rounded-xl transition-colors inline-flex items-center gap-3">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Select CSV File
                  </>
                )}
              </div>
            </label>

            {uploadStatus && (
              <div className={`mt-6 p-4 rounded-xl ${
                uploadStatus.type === 'success' 
                  ? 'bg-emerald-50 border border-emerald-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  {uploadStatus.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`flex-1 text-sm font-medium ${
                    uploadStatus.type === 'success' ? 'text-emerald-900' : 'text-red-900'
                  }`}>
                    {uploadStatus.message}
                  </span>
                  <button
                    onClick={() => setUploadStatus(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
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

// Archive Section
function ArchiveSection({ datasets, fetchDatasetDetails, downloadPDF, handleDeleteDataset, setActiveSection }) {
  if (datasets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Database className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Archived Datasets</h3>
          <p className="text-slate-600">Your imported datasets will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {datasets.map((dataset) => (
        <div
          key={dataset.id}
          className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer"
          onClick={() => {
            fetchDatasetDetails(dataset.id);
            setActiveSection('overview');
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">{dataset.filename}</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                {new Date(dataset.uploaded_at).toLocaleString()}
              </p>
              <div className="flex gap-4">
                <div className="bg-slate-50 px-3 py-1.5 rounded-lg text-sm">
                  <span className="text-slate-600">Records: </span>
                  <span className="font-semibold text-slate-900">{dataset.total_records}</span>
                </div>
                {dataset.summary && (
                  <div className="bg-slate-50 px-3 py-1.5 rounded-lg text-sm">
                    <span className="text-slate-600">Types: </span>
                    <span className="font-semibold text-slate-900">
                      {Object.keys(dataset.summary.type_distribution || {}).length}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchDatasetDetails(dataset.id);
                  setActiveSection('overview');
                }}
                className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadPDF(dataset.id);
                }}
                className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDataset(dataset.id);
                }}
                className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper Components
const MetricCard = ({ label, value, icon: Icon, color }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className={`w-10 h-10 ${colors[color]} rounded-lg flex items-center justify-center mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-xs text-slate-600 font-medium">{label}</p>
    </div>
  );
};

function AnalyticsChart({ view, summary, records }) {
  const typeDistData = Object.entries(summary.type_distribution || {}).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#818cf8', '#34d399', '#a78bfa', '#fb923c', '#fbbf24', '#38bdf8'];

  switch (view) {
    case 'distribution':
      return (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-6">Equipment Type Distribution</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={typeDistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {typeDistData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'comparison':
      const comparisonData = [
        {
          name: 'Flowrate',
          Min: summary.min_flowrate || 0,
          Avg: summary.avg_flowrate || 0,
          Max: summary.max_flowrate || 0
        },
        {
          name: 'Pressure',
          Min: summary.min_pressure || 0,
          Avg: summary.avg_pressure || 0,
          Max: summary.max_pressure || 0
        },
        {
          name: 'Temperature',
          Min: summary.min_temperature || 0,
          Avg: summary.avg_temperature || 0,
          Max: summary.max_temperature || 0
        }
      ];

      return (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-6">Parameter Comparison (Min/Avg/Max)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Min" fill="#ef4444" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Avg" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Max" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );

    case 'pie':
      return (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-6">Type Distribution (Pie Chart)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={typeDistData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {typeDistData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );

    case 'ranges':
      return (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-6">Parameter Value Ranges</h3>
          <div className="space-y-8">
            <RangeVisualizer
              label="Flow Rate"
              min={summary.min_flowrate}
              max={summary.max_flowrate}
              avg={summary.avg_flowrate}
              color="emerald"
            />
            <RangeVisualizer
              label="Pressure"
              min={summary.min_pressure}
              max={summary.max_pressure}
              avg={summary.avg_pressure}
              color="blue"
            />
            <RangeVisualizer
              label="Temperature"
              min={summary.min_temperature}
              max={summary.max_temperature}
              avg={summary.avg_temperature}
              color="orange"
            />
          </div>
        </div>
      );

    default:
      return <div className="text-center text-slate-400">Select a view</div>;
  }
}

const RangeVisualizer = ({ label, min, max, avg, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
  };

  const percentage = ((avg - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold text-slate-900">{label}</span>
        <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
          Min: {min?.toFixed(2)} | Max: {max?.toFixed(2)}
        </span>
      </div>
      <div className="relative w-full bg-slate-100 rounded-full h-4">
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 ${colorClasses[color]} rounded-full shadow-md`}
          style={{ left: `${percentage}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="text-center mt-2 text-sm text-slate-600 font-medium">
        Average: {avg?.toFixed(2)}
      </div>
    </div>
  );
};

export default App;