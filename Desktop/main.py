"""
Chemical Equipment Parameter Visualizer - Desktop Application
Main application file with PyQt5 GUI
"""

import sys
import os
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLabel, QFileDialog, 
                             QTableWidget, QTableWidgetItem, QTabWidget, 
                             QMessageBox, QProgressBar, QComboBox, QGroupBox,
                             QGridLayout, QHeaderView, QTextEdit, QSplitter)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QFont, QIcon
import matplotlib
matplotlib.use('Qt5Agg')
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import matplotlib.pyplot as plt
import pandas as pd
import requests
import json
from datetime import datetime

# API Configuration
API_BASE_URL = 'http://localhost:8000/api'


class UploadThread(QThread):
    """Background thread for file upload"""
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)
    progress = pyqtSignal(int)
    
    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path
    
    def run(self):
        try:
            self.progress.emit(30)
            
            with open(self.file_path, 'rb') as f:
                files = {'file': f}
                response = requests.post(
                    f'{API_BASE_URL}/datasets/upload/',
                    files=files,
                    timeout=30
                )
            
            self.progress.emit(70)
            
            if response.status_code == 201:
                data = response.json()
                self.progress.emit(100)
                self.finished.emit(data)
            else:
                error_data = response.json()
                self.error.emit(error_data.get('error', 'Upload failed'))
                
        except requests.exceptions.ConnectionError:
            self.error.emit('Cannot connect to server. Please ensure Django backend is running.')
        except Exception as e:
            self.error.emit(f'Error: {str(e)}')


class MatplotlibWidget(QWidget):
    """Widget to embed matplotlib figures"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.figure = Figure(figsize=(8, 6), dpi=100)
        self.canvas = FigureCanvas(self.figure)
        
        layout = QVBoxLayout()
        layout.addWidget(self.canvas)
        self.setLayout(layout)
    
    def plot_bar_chart(self, data_dict, title, xlabel, ylabel):
        """Create a bar chart"""
        self.figure.clear()
        ax = self.figure.add_subplot(111)
        
        keys = list(data_dict.keys())
        values = list(data_dict.values())
        
        bars = ax.bar(keys, values, color='#3B82F6', alpha=0.8, edgecolor='black')
        ax.set_xlabel(xlabel, fontsize=12, fontweight='bold')
        ax.set_ylabel(ylabel, fontsize=12, fontweight='bold')
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        ax.grid(axis='y', alpha=0.3)
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}',
                   ha='center', va='bottom', fontsize=10)
        
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
        self.figure.tight_layout()
        self.canvas.draw()
    
    def plot_multi_bar_chart(self, summary, title):
        """Create grouped bar chart for parameter comparison"""
        self.figure.clear()
        ax = self.figure.add_subplot(111)
        
        parameters = ['Flowrate', 'Pressure', 'Temperature']
        min_values = [
            summary.get('min_flowrate', 0),
            summary.get('min_pressure', 0),
            summary.get('min_temperature', 0)
        ]
        avg_values = [
            summary.get('avg_flowrate', 0),
            summary.get('avg_pressure', 0),
            summary.get('avg_temperature', 0)
        ]
        max_values = [
            summary.get('max_flowrate', 0),
            summary.get('max_pressure', 0),
            summary.get('max_temperature', 0)
        ]
        
        x = range(len(parameters))
        width = 0.25
        
        ax.bar([i - width for i in x], min_values, width, label='Min', 
               color='#EF4444', alpha=0.8)
        ax.bar(x, avg_values, width, label='Average', 
               color='#3B82F6', alpha=0.8)
        ax.bar([i + width for i in x], max_values, width, label='Max', 
               color='#10B981', alpha=0.8)
        
        ax.set_xlabel('Parameters', fontsize=12, fontweight='bold')
        ax.set_ylabel('Values', fontsize=12, fontweight='bold')
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels(parameters)
        ax.legend()
        ax.grid(axis='y', alpha=0.3)
        
        self.figure.tight_layout()
        self.canvas.draw()
    
    def plot_pie_chart(self, data_dict, title):
        """Create a pie chart"""
        self.figure.clear()
        ax = self.figure.add_subplot(111)
        
        keys = list(data_dict.keys())
        values = list(data_dict.values())
        
        colors = plt.cm.Set3(range(len(keys)))
        wedges, texts, autotexts = ax.pie(
            values, 
            labels=keys, 
            autopct='%1.1f%%',
            colors=colors,
            startangle=90,
            textprops={'fontsize': 10}
        )
        
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        
        # Make percentage text bold
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')
        
        self.figure.tight_layout()
        self.canvas.draw()


class ChemicalEquipmentApp(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        self.current_dataset = None
        self.datasets_list = []
        self.init_ui()
        self.load_datasets()
    
    def init_ui(self):
        """Initialize the user interface"""
        self.setWindowTitle('Chemical Equipment Parameter Visualizer - Desktop')
        self.setGeometry(100, 100, 1400, 900)
        
        # Create central widget and main layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        
        # Header
        header = self.create_header()
        main_layout.addWidget(header)
        
        # Create tab widget
        self.tabs = QTabWidget()
        self.tabs.setFont(QFont('Arial', 10))
        
        # Tab 1: Upload
        self.upload_tab = self.create_upload_tab()
        self.tabs.addTab(self.upload_tab, '📤 Upload CSV')
        
        # Tab 2: Dashboard
        self.dashboard_tab = self.create_dashboard_tab()
        self.tabs.addTab(self.dashboard_tab, '📊 Dashboard')
        
        # Tab 3: Visualizations
        self.viz_tab = self.create_visualization_tab()
        self.tabs.addTab(self.viz_tab, '📈 Visualizations')
        
        # Tab 4: Data Table
        self.table_tab = self.create_table_tab()
        self.tabs.addTab(self.table_tab, '📋 Data Table')
        
        # Tab 5: History
        self.history_tab = self.create_history_tab()
        self.tabs.addTab(self.history_tab, '🕐 History')
        
        main_layout.addWidget(self.tabs)
        
        # Status bar
        self.statusBar().showMessage('Ready')
    
    def create_header(self):
        """Create application header"""
        header = QWidget()
        header.setStyleSheet('background-color: #1E40AF; padding: 15px; border-radius: 5px;')
        layout = QVBoxLayout(header)
        
        title = QLabel('Chemical Equipment Parameter Visualizer')
        title.setFont(QFont('Arial', 20, QFont.Bold))
        title.setStyleSheet('color: white;')
        
        subtitle = QLabel('Desktop Application - PyQt5 + Matplotlib')
        subtitle.setFont(QFont('Arial', 11))
        subtitle.setStyleSheet('color: #BFDBFE;')
        
        layout.addWidget(title)
        layout.addWidget(subtitle)
        
        return header
    
    def create_upload_tab(self):
        """Create upload tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setAlignment(Qt.AlignCenter)
        
        # Upload group box
        upload_group = QGroupBox('Upload CSV File')
        upload_group.setFont(QFont('Arial', 12, QFont.Bold))
        upload_layout = QVBoxLayout(upload_group)
        
        # Info label
        info_label = QLabel(
            'Select a CSV file with the following columns:\n'
            '• Equipment Name\n'
            '• Type\n'
            '• Flowrate\n'
            '• Pressure\n'
            '• Temperature'
        )
        info_label.setFont(QFont('Arial', 10))
        info_label.setStyleSheet('padding: 10px; background-color: #DBEAFE; border-radius: 5px;')
        upload_layout.addWidget(info_label)
        
        # Select file button
        self.select_file_btn = QPushButton('📁 Select CSV File')
        self.select_file_btn.setFont(QFont('Arial', 12, QFont.Bold))
        self.select_file_btn.setStyleSheet('''
            QPushButton {
                background-color: #3B82F6;
                color: white;
                padding: 15px;
                border-radius: 5px;
                min-width: 200px;
            }
            QPushButton:hover {
                background-color: #2563EB;
            }
        ''')
        self.select_file_btn.clicked.connect(self.select_file)
        upload_layout.addWidget(self.select_file_btn, alignment=Qt.AlignCenter)
        
        # Selected file label
        self.selected_file_label = QLabel('No file selected')
        self.selected_file_label.setFont(QFont('Arial', 10))
        self.selected_file_label.setAlignment(Qt.AlignCenter)
        upload_layout.addWidget(self.selected_file_label)
        
        # Upload button
        self.upload_btn = QPushButton('⬆️ Upload and Process')
        self.upload_btn.setFont(QFont('Arial', 12, QFont.Bold))
        self.upload_btn.setStyleSheet('''
            QPushButton {
                background-color: #10B981;
                color: white;
                padding: 15px;
                border-radius: 5px;
                min-width: 200px;
            }
            QPushButton:hover {
                background-color: #059669;
            }
            QPushButton:disabled {
                background-color: #9CA3AF;
            }
        ''')
        self.upload_btn.setEnabled(False)
        self.upload_btn.clicked.connect(self.upload_file)
        upload_layout.addWidget(self.upload_btn, alignment=Qt.AlignCenter)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setStyleSheet('''
            QProgressBar {
                border: 2px solid #3B82F6;
                border-radius: 5px;
                text-align: center;
            }
            QProgressBar::chunk {
                background-color: #3B82F6;
            }
        ''')
        upload_layout.addWidget(self.progress_bar)
        
        # Status message label
        self.upload_status_label = QLabel()
        self.upload_status_label.setVisible(False)
        self.upload_status_label.setFont(QFont('Arial', 10))
        self.upload_status_label.setAlignment(Qt.AlignCenter)
        self.upload_status_label.setStyleSheet('''
            padding: 12px;
            border-radius: 5px;
            margin-top: 10px;
        ''')
        upload_layout.addWidget(self.upload_status_label)
        
        layout.addWidget(upload_group)
        layout.addStretch()
        
        return tab
    
    def create_dashboard_tab(self):
        """Create dashboard tab with summary statistics"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Dataset info
        self.dataset_info_label = QLabel('No dataset loaded')
        self.dataset_info_label.setFont(QFont('Arial', 11, QFont.Bold))
        self.dataset_info_label.setStyleSheet('''
            padding: 10px;
            background-color: #DBEAFE;
            border-radius: 5px;
            color: #1E40AF;
        ''')
        layout.addWidget(self.dataset_info_label)
        
        # Summary statistics grid
        summary_group = QGroupBox('Summary Statistics')
        summary_group.setFont(QFont('Arial', 11, QFont.Bold))
        summary_layout = QGridLayout(summary_group)
        
        # Create stat cards
        self.stat_cards = {}
        stat_items = [
            ('total_count', 'Total Records', '#3B82F6'),
            ('avg_flowrate', 'Avg Flowrate', '#10B981'),
            ('avg_pressure', 'Avg Pressure', '#8B5CF6'),
            ('avg_temperature', 'Avg Temperature', '#EF4444'),
        ]
        
        for i, (key, label, color) in enumerate(stat_items):
            card = self.create_stat_card(label, '0', color)
            self.stat_cards[key] = card
            row = i // 2
            col = i % 2
            summary_layout.addWidget(card, row, col)
        
        layout.addWidget(summary_group)
        
        # Parameter ranges
        ranges_group = QGroupBox('Parameter Ranges')
        ranges_group.setFont(QFont('Arial', 11, QFont.Bold))
        ranges_layout = QVBoxLayout(ranges_group)
        
        self.ranges_text = QTextEdit()
        self.ranges_text.setReadOnly(True)
        self.ranges_text.setFont(QFont('Courier', 10))
        self.ranges_text.setMaximumHeight(200)
        ranges_layout.addWidget(self.ranges_text)
        
        layout.addWidget(ranges_group)
        
        # Download PDF button
        self.download_pdf_btn = QPushButton('📥 Download PDF Report')
        self.download_pdf_btn.setFont(QFont('Arial', 11, QFont.Bold))
        self.download_pdf_btn.setStyleSheet('''
            QPushButton {
                background-color: #DC2626;
                color: white;
                padding: 12px;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #B91C1C;
            }
            QPushButton:disabled {
                background-color: #9CA3AF;
            }
        ''')
        self.download_pdf_btn.setEnabled(False)
        self.download_pdf_btn.clicked.connect(self.download_pdf)
        layout.addWidget(self.download_pdf_btn)
        
        layout.addStretch()
        
        return tab
    
    def create_visualization_tab(self):
        """Create visualization tab with matplotlib charts"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Chart type selector
        selector_layout = QHBoxLayout()
        selector_layout.addWidget(QLabel('Select Chart:'))
        
        self.chart_selector = QComboBox()
        self.chart_selector.addItems([
            'Equipment Type Distribution (Bar)',
            'Equipment Type Distribution (Pie)',
            'Parameter Comparison'
        ])
        self.chart_selector.currentIndexChanged.connect(self.update_chart)
        selector_layout.addWidget(self.chart_selector)
        selector_layout.addStretch()
        
        layout.addLayout(selector_layout)
        
        # Matplotlib widget
        self.chart_widget = MatplotlibWidget()
        layout.addWidget(self.chart_widget)
        
        return tab
    
    def create_table_tab(self):
        """Create data table tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Table info
        self.table_info_label = QLabel('Equipment Records')
        self.table_info_label.setFont(QFont('Arial', 11, QFont.Bold))
        layout.addWidget(self.table_info_label)
        
        # Table widget
        self.data_table = QTableWidget()
        self.data_table.setColumnCount(5)
        self.data_table.setHorizontalHeaderLabels([
            'Equipment Name', 'Type', 'Flowrate', 'Pressure', 'Temperature'
        ])
        self.data_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.data_table.setAlternatingRowColors(True)
        self.data_table.setStyleSheet('''
            QTableWidget {
                gridline-color: #D1D5DB;
                background-color: white;
            }
            QHeaderView::section {
                background-color: #3B82F6;
                color: white;
                padding: 8px;
                font-weight: bold;
            }
        ''')
        
        layout.addWidget(self.data_table)
        
        return tab
    
    def create_history_tab(self):
        """Create history tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Refresh button
        refresh_btn = QPushButton('🔄 Refresh History')
        refresh_btn.setFont(QFont('Arial', 10, QFont.Bold))
        refresh_btn.clicked.connect(self.load_datasets)
        refresh_btn.setStyleSheet('''
            QPushButton {
                background-color: #3B82F6;
                color: white;
                padding: 8px;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #2563EB;
            }
        ''')
        layout.addWidget(refresh_btn)
        
        # History list
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(4)
        self.history_table.setHorizontalHeaderLabels([
            'Filename', 'Upload Date', 'Records', 'Action'
        ])
        self.history_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.history_table.setAlternatingRowColors(True)
        self.history_table.setStyleSheet('''
            QTableWidget {
                gridline-color: #D1D5DB;
                background-color: white;
            }
            QHeaderView::section {
                background-color: #8B5CF6;
                color: white;
                padding: 8px;
                font-weight: bold;
            }
        ''')
        
        layout.addWidget(self.history_table)
        
        return tab
    
    def create_stat_card(self, title, value, color):
        """Create a statistics card widget"""
        card = QGroupBox()
        card.setStyleSheet(f'''
            QGroupBox {{
                background-color: {color};
                border-radius: 5px;
                padding: 15px;
                color: white;
            }}
        ''')
        
        layout = QVBoxLayout(card)
        
        title_label = QLabel(title)
        title_label.setFont(QFont('Arial', 10))
        title_label.setStyleSheet('color: rgba(255, 255, 255, 0.9);')
        
        value_label = QLabel(value)
        value_label.setFont(QFont('Arial', 24, QFont.Bold))
        value_label.setStyleSheet('color: white;')
        value_label.setObjectName('value_label')
        
        layout.addWidget(title_label)
        layout.addWidget(value_label)
        
        return card
    
    def select_file(self):
        """Open file dialog to select CSV"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            'Select CSV File',
            '',
            'CSV Files (*.csv);;All Files (*)'
        )
        
        if file_path:
            self.selected_file_path = file_path
            self.selected_file_label.setText(f'Selected: {os.path.basename(file_path)}')
            self.upload_btn.setEnabled(True)
            self.statusBar().showMessage(f'File selected: {os.path.basename(file_path)}')
    
    def upload_file(self):
        """Upload CSV file to backend"""
        if not hasattr(self, 'selected_file_path'):
            return
        
        self.upload_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.statusBar().showMessage('Uploading file...')
        
        # Create and start upload thread
        self.upload_thread = UploadThread(self.selected_file_path)
        self.upload_thread.finished.connect(self.on_upload_success)
        self.upload_thread.error.connect(self.on_upload_error)
        self.upload_thread.progress.connect(self.progress_bar.setValue)
        self.upload_thread.start()
    
    def on_upload_success(self, data):
        """Handle successful upload"""
        self.progress_bar.setVisible(False)
        self.upload_btn.setEnabled(True)
        
        # Show success message in label
        self.upload_status_label.setText('✓ File uploaded successfully!')
        self.upload_status_label.setStyleSheet('''
            padding: 12px;
            border-radius: 5px;
            margin-top: 10px;
            background-color: #DCFCE7;
            border: 2px solid #22C55E;
            color: #166534;
            font-weight: bold;
        ''')
        self.upload_status_label.setVisible(True)
        
        self.current_dataset = data
        self.load_datasets()
        self.update_dashboard()
        self.update_table()
        self.update_chart()
        self.tabs.setCurrentIndex(1)  # Switch to dashboard
        
        self.statusBar().showMessage('Upload completed successfully')
    
    def on_upload_error(self, error_msg):
        """Handle upload error"""
        self.progress_bar.setVisible(False)
        self.upload_btn.setEnabled(True)
        
        # Show error message in label
        self.upload_status_label.setText(f'✗ Error: {error_msg}')
        self.upload_status_label.setStyleSheet('''
            padding: 12px;
            border-radius: 5px;
            margin-top: 10px;
            background-color: #FEE2E2;
            border: 2px solid #EF4444;
            color: #991B1B;
            font-weight: bold;
        ''')
        self.upload_status_label.setVisible(True)
        
        self.statusBar().showMessage('Upload failed')
    
    def load_datasets(self):
        """Load list of datasets from API"""
        try:
            response = requests.get(f'{API_BASE_URL}/datasets/', timeout=5)
            if response.status_code == 200:
                self.datasets_list = response.json()
                self.update_history_table()
                
                if self.datasets_list and not self.current_dataset:
                    self.load_dataset_details(self.datasets_list[0]['id'])
        except requests.exceptions.ConnectionError:
            self.statusBar().showMessage('Cannot connect to server')
        except Exception as e:
            print(f'Error loading datasets: {e}')
    
    def load_dataset_details(self, dataset_id):
        """Load detailed dataset information"""
        try:
            response = requests.get(f'{API_BASE_URL}/datasets/{dataset_id}/', timeout=5)
            if response.status_code == 200:
                self.current_dataset = response.json()
                self.update_dashboard()
                self.update_table()
                self.update_chart()
        except Exception as e:
            print(f'Error loading dataset details: {e}')
    
    def update_dashboard(self):
        """Update dashboard with current dataset"""
        if not self.current_dataset:
            return
        
        # Update dataset info
        filename = self.current_dataset.get('filename', 'Unknown')
        upload_date = self.current_dataset.get('uploaded_at', '')
        if upload_date:
            upload_date = datetime.fromisoformat(upload_date.replace('Z', '+00:00'))
            upload_date = upload_date.strftime('%Y-%m-%d %H:%M:%S')
        
        self.dataset_info_label.setText(
            f'📊 Dataset: {filename} | Uploaded: {upload_date}'
        )
        
        # Update stat cards
        summary = self.current_dataset.get('summary', {})
        
        stats = {
            'total_count': str(summary.get('total_count', 0)),
            'avg_flowrate': f"{summary.get('avg_flowrate', 0):.2f}",
            'avg_pressure': f"{summary.get('avg_pressure', 0):.2f}",
            'avg_temperature': f"{summary.get('avg_temperature', 0):.2f}",
        }
        
        for key, value in stats.items():
            card = self.stat_cards[key]
            value_label = card.findChild(QLabel, 'value_label')
            if value_label:
                value_label.setText(value)
        
        # Update parameter ranges
        ranges_text = "Parameter Ranges:\n\n"
        ranges_text += f"Flowrate:\n"
        ranges_text += f"  Min: {summary.get('min_flowrate', 0):.2f}\n"
        ranges_text += f"  Avg: {summary.get('avg_flowrate', 0):.2f}\n"
        ranges_text += f"  Max: {summary.get('max_flowrate', 0):.2f}\n\n"
        
        ranges_text += f"Pressure:\n"
        ranges_text += f"  Min: {summary.get('min_pressure', 0):.2f}\n"
        ranges_text += f"  Avg: {summary.get('avg_pressure', 0):.2f}\n"
        ranges_text += f"  Max: {summary.get('max_pressure', 0):.2f}\n\n"
        
        ranges_text += f"Temperature:\n"
        ranges_text += f"  Min: {summary.get('min_temperature', 0):.2f}\n"
        ranges_text += f"  Avg: {summary.get('avg_temperature', 0):.2f}\n"
        ranges_text += f"  Max: {summary.get('max_temperature', 0):.2f}\n"
        
        self.ranges_text.setText(ranges_text)
        
        self.download_pdf_btn.setEnabled(True)
    
    def update_table(self):
        """Update data table with equipment records"""
        if not self.current_dataset:
            return
        
        equipment_records = self.current_dataset.get('equipment_records', [])
        self.data_table.setRowCount(len(equipment_records))
        
        for row, equipment in enumerate(equipment_records):
            self.data_table.setItem(row, 0, QTableWidgetItem(equipment.get('equipment_name', '')))
            self.data_table.setItem(row, 1, QTableWidgetItem(equipment.get('equipment_type', '')))
            self.data_table.setItem(row, 2, QTableWidgetItem(f"{equipment.get('flowrate', 0):.2f}"))
            self.data_table.setItem(row, 3, QTableWidgetItem(f"{equipment.get('pressure', 0):.2f}"))
            self.data_table.setItem(row, 4, QTableWidgetItem(f"{equipment.get('temperature', 0):.2f}"))
        
        self.table_info_label.setText(f'Equipment Records ({len(equipment_records)} total)')
    
    def update_chart(self):
        """Update visualization chart"""
        if not self.current_dataset:
            return
        
        summary = self.current_dataset.get('summary', {})
        chart_type = self.chart_selector.currentText()
        
        if 'Bar' in chart_type:
            type_dist = summary.get('type_distribution', {})
            self.chart_widget.plot_bar_chart(
                type_dist,
                'Equipment Type Distribution',
                'Equipment Type',
                'Count'
            )
        elif 'Pie' in chart_type:
            type_dist = summary.get('type_distribution', {})
            self.chart_widget.plot_pie_chart(
                type_dist,
                'Equipment Type Distribution'
            )
        elif 'Parameter' in chart_type:
            self.chart_widget.plot_multi_bar_chart(
                summary,
                'Parameter Comparison (Min, Avg, Max)'
            )
    
    def update_history_table(self):
        """Update history table with datasets"""
        self.history_table.setRowCount(len(self.datasets_list))
        
        for row, dataset in enumerate(self.datasets_list):
            filename = dataset.get('filename', 'Unknown')
            upload_date = dataset.get('uploaded_at', '')
            if upload_date:
                upload_date = datetime.fromisoformat(upload_date.replace('Z', '+00:00'))
                upload_date = upload_date.strftime('%Y-%m-%d %H:%M')
            
            records = str(dataset.get('total_records', 0))
            
            self.history_table.setItem(row, 0, QTableWidgetItem(filename))
            self.history_table.setItem(row, 1, QTableWidgetItem(upload_date))
            self.history_table.setItem(row, 2, QTableWidgetItem(records))
            
            # Action buttons container
            button_layout = QHBoxLayout()
            button_layout.setContentsMargins(5, 0, 5, 0)
            
            # Load button
            load_btn = QPushButton('Load')
            load_btn.setStyleSheet('''
                QPushButton {
                    background-color: #10B981;
                    color: white;
                    padding: 5px;
                    border-radius: 3px;
                }
                QPushButton:hover {
                    background-color: #059669;
                }
            ''')
            dataset_id = dataset.get('id')
            load_btn.clicked.connect(lambda checked, did=dataset_id: self.load_dataset_details(did))
            button_layout.addWidget(load_btn)
            
            # Delete button
            delete_btn = QPushButton('Delete')
            delete_btn.setStyleSheet('''
                QPushButton {
                    background-color: #EF4444;
                    color: white;
                    padding: 5px;
                    border-radius: 3px;
                }
                QPushButton:hover {
                    background-color: #DC2626;
                }
            ''')
            delete_btn.clicked.connect(lambda checked, did=dataset_id: self.delete_dataset(did))
            button_layout.addWidget(delete_btn)
            
            # Container widget for buttons
            button_container = QWidget()
            button_container.setLayout(button_layout)
            self.history_table.setCellWidget(row, 3, button_container)
    
    def delete_dataset(self, dataset_id):
        """Delete a dataset"""
        reply = QMessageBox.question(
            self,
            'Confirm Delete',
            'Are you sure you want to delete this dataset? This action cannot be undone.',
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.No:
            return
        
        try:
            response = requests.delete(f'{API_BASE_URL}/datasets/{dataset_id}/', timeout=5)
            
            if response.status_code == 204 or response.status_code == 200:
                # Clear upload status message and reload
                self.upload_status_label.setVisible(False)
                
                # If deleted dataset was current, clear current dataset
                if self.current_dataset and self.current_dataset.get('id') == dataset_id:
                    self.current_dataset = None
                
                self.load_datasets()
                self.statusBar().showMessage('Dataset deleted successfully')
            else:
                QMessageBox.warning(self, 'Error', 'Failed to delete dataset')
                
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Failed to delete dataset:\n{str(e)}')
    
    def download_pdf(self):
        """Download PDF report"""
        if not self.current_dataset:
            return
        
        dataset_id = self.current_dataset.get('id')
        
        # Open save dialog
        filename, _ = QFileDialog.getSaveFileName(
            self,
            'Save PDF Report',
            f'equipment_report_{dataset_id}.pdf',
            'PDF Files (*.pdf)'
        )
        
        if filename:
            try:
                response = requests.get(
                    f'{API_BASE_URL}/datasets/{dataset_id}/generate_pdf/',
                    timeout=30
                )
                
                if response.status_code == 200:
                    with open(filename, 'wb') as f:
                        f.write(response.content)
                    
                    QMessageBox.information(
                        self,
                        'Success',
                        f'PDF report saved successfully!\n\n{filename}'
                    )
                    self.statusBar().showMessage('PDF downloaded successfully')
                else:
                    raise Exception('Failed to generate PDF')
                    
            except Exception as e:
                QMessageBox.critical(
                    self,
                    'Error',
                    f'Failed to download PDF:\n\n{str(e)}'
                )


def main():
    """Main application entry point"""
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    # Set application font
    font = QFont('Arial', 10)
    app.setFont(font)
    
    window = ChemicalEquipmentApp()
    window.show()
    
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()