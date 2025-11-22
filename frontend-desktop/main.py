import sys
import requests
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QFileDialog, QTableWidget, 
                             QTableWidgetItem, QLabel, QLineEdit, QMessageBox, 
                             QTabWidget, QGroupBox, QGridLayout, QScrollArea)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

API_URL = 'http://localhost:8000/api'

class LoginWindow(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()
    
    def init_ui(self):
        self.setWindowTitle('Login - Equipment Visualizer')
        self.setGeometry(100, 100, 400, 300)
        
        layout = QVBoxLayout()
        
        # Title
        title = QLabel('Chemical Equipment Visualizer')
        title.setFont(QFont('Arial', 18, QFont.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # Username
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText('Username')
        layout.addWidget(QLabel('Username:'))
        layout.addWidget(self.username_input)
        
        # Password
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText('Password')
        self.password_input.setEchoMode(QLineEdit.Password)
        layout.addWidget(QLabel('Password:'))
        layout.addWidget(self.password_input)
        
        # Buttons
        btn_layout = QHBoxLayout()
        
        self.login_btn = QPushButton('Login')
        self.login_btn.clicked.connect(self.login)
        btn_layout.addWidget(self.login_btn)
        
        self.register_btn = QPushButton('Register')
        self.register_btn.clicked.connect(self.register)
        btn_layout.addWidget(self.register_btn)
        
        layout.addLayout(btn_layout)
        
        self.setLayout(layout)
    
    def login(self):
        username = self.username_input.text()
        password = self.password_input.text()
        
        try:
            response = requests.post(f'{API_URL}/login/', json={
                'username': username,
                'password': password
            })
            
            if response.status_code == 200:
                token = response.json()['token']
                parent = self.parentWidget()
                if parent:
                    parent.set_token(token)
                self.close()
            else:
                QMessageBox.warning(self, 'Error', 'Invalid credentials')
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Login failed: {str(e)}')
    def register(self):
        username = self.username_input.text()
        password = self.password_input.text()
        
        try:
            response = requests.post(f'{API_URL}/register/', json={
                'username': username,
                'password': password,
                'email': f'{username}@example.com'
            })
            
            if response.status_code == 201:
                QMessageBox.information(self, 'Success', 'Registration successful! Please login.')
            else:
                QMessageBox.warning(self, 'Error', 'Registration failed')
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Registration failed: {str(e)}')

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.token = None
        self.current_data = None
        self.current_summary = None
        self.init_ui()
    
    def init_ui(self):
        self.setWindowTitle('Chemical Equipment Parameter Visualizer')
        self.setGeometry(100, 100, 1200, 800)
        
        # Show login window
        self.login_window = LoginWindow(self)
        self.login_window.show()
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout()
        
        # Header
        header_layout = QHBoxLayout()
        title = QLabel('Chemical Equipment Parameter Visualizer')
        title.setFont(QFont('Arial', 20, QFont.Bold))
        header_layout.addWidget(title)
        
        self.logout_btn = QPushButton('Logout')
        self.logout_btn.clicked.connect(self.logout)
        header_layout.addWidget(self.logout_btn)
        
        main_layout.addLayout(header_layout)
        
        # Upload section
        upload_group = QGroupBox('Upload CSV File')
        upload_layout = QHBoxLayout()
        
        self.file_label = QLabel('No file selected')
        upload_layout.addWidget(self.file_label)
        
        self.browse_btn = QPushButton('Browse')
        self.browse_btn.clicked.connect(self.browse_file)
        upload_layout.addWidget(self.browse_btn)
        
        self.upload_btn = QPushButton('Upload & Analyze')
        self.upload_btn.clicked.connect(self.upload_file)
        self.upload_btn.setEnabled(False)
        upload_layout.addWidget(self.upload_btn)
        
        upload_group.setLayout(upload_layout)
        main_layout.addWidget(upload_group)
        
        # Tabs
        self.tabs = QTabWidget()
        
        # Summary tab
        self.summary_tab = QWidget()
        summary_layout = QVBoxLayout()
        
        self.stats_group = QGroupBox('Summary Statistics')
        stats_layout = QGridLayout()
        
        self.total_label = QLabel('Total Equipment: -')
        self.flowrate_label = QLabel('Avg Flowrate: -')
        self.pressure_label = QLabel('Avg Pressure: -')
        self.temp_label = QLabel('Avg Temperature: -')
        
        stats_layout.addWidget(self.total_label, 0, 0)
        stats_layout.addWidget(self.flowrate_label, 0, 1)
        stats_layout.addWidget(self.pressure_label, 1, 0)
        stats_layout.addWidget(self.temp_label, 1, 1)
        
        self.stats_group.setLayout(stats_layout)
        summary_layout.addWidget(self.stats_group)
        
        self.summary_tab.setLayout(summary_layout)
        self.tabs.addTab(self.summary_tab, 'Summary')
        
        # Charts tab
        self.charts_tab = QWidget()
        charts_layout = QVBoxLayout()
        
        self.figure = Figure(figsize=(10, 8))
        self.canvas = FigureCanvas(self.figure)
        charts_layout.addWidget(self.canvas)
        
        self.charts_tab.setLayout(charts_layout)
        self.tabs.addTab(self.charts_tab, 'Charts')
        
        # Data table tab
        self.table_tab = QWidget()
        table_layout = QVBoxLayout()
        
        self.data_table = QTableWidget()
        table_layout.addWidget(self.data_table)
        
        self.table_tab.setLayout(table_layout)
        self.tabs.addTab(self.table_tab, 'Data Table')
        
        # History tab
        self.history_tab = QWidget()
        history_layout = QVBoxLayout()
        
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(6)
        self.history_table.setHorizontalHeaderLabels([
            'Filename', 'Date', 'Count', 'Avg Flow', 'Avg Press', 'Actions'
        ])
        history_layout.addWidget(self.history_table)
        
        refresh_btn = QPushButton('Refresh History')
        refresh_btn.clicked.connect(self.load_history)
        history_layout.addWidget(refresh_btn)
        
        self.history_tab.setLayout(history_layout)
        self.tabs.addTab(self.history_tab, 'History')
        
        main_layout.addWidget(self.tabs)
        
        central_widget.setLayout(main_layout)
    
    def set_token(self, token):
        self.token = token
        self.load_history()
    
    def logout(self):
        self.token = None
        self.current_data = None
        self.current_summary = None
        self.login_window = LoginWindow(self)
        self.login_window.show()
    
    def browse_file(self):
        filename, _ = QFileDialog.getOpenFileName(self, 'Select CSV File', '', 'CSV Files (*.csv)')
        if filename:
            self.selected_file = filename
            self.file_label.setText(filename.split('/')[-1])
            self.upload_btn.setEnabled(True)
    
    def upload_file(self):
        if not hasattr(self, 'selected_file') or not self.token:
            return
        
        try:
            with open(self.selected_file, 'rb') as f:
                files = {'file': f}
                headers = {'Authorization': f'Token {self.token}'}
                
                response = requests.post(f'{API_URL}/upload/', 
                                       files=files, 
                                       headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    self.current_data = pd.DataFrame(data['data'])
                    self.current_summary = data['summary']
                    
                    self.update_summary()
                    self.update_charts()
                    self.update_table()
                    self.load_history()
                    
                    QMessageBox.information(self, 'Success', 'File uploaded and analyzed successfully!')
                else:
                    QMessageBox.warning(self, 'Error', 'Upload failed')
        
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Upload failed: {str(e)}')
    
    def update_summary(self):
        if self.current_summary:
            self.total_label.setText(f"Total Equipment: {self.current_summary['total_count']}")
            self.flowrate_label.setText(f"Avg Flowrate: {self.current_summary['avg_flowrate']:.2f}")
            self.pressure_label.setText(f"Avg Pressure: {self.current_summary['avg_pressure']:.2f}")
            self.temp_label.setText(f"Avg Temperature: {self.current_summary['avg_temperature']:.2f}")
    
    def update_charts(self):
        if not self.current_summary:
            return
        
        self.figure.clear()
        
        # Pie chart
        ax1 = self.figure.add_subplot(2, 1, 1)
        equipment_types = self.current_summary['equipment_types']
        ax1.pie(equipment_types.values(), labels=equipment_types.keys(), autopct='%1.1f%%')
        ax1.set_title('Equipment Type Distribution')
        
        # Bar chart
        ax2 = self.figure.add_subplot(2, 1, 2)
        parameters = ['Flowrate', 'Pressure', 'Temperature']
        values = [
            self.current_summary['avg_flowrate'],
            self.current_summary['avg_pressure'],
            self.current_summary['avg_temperature']
        ]
        ax2.bar(parameters, values, color=['#FF6384', '#36A2EB', '#FFCE56'])
        ax2.set_title('Average Parameters')
        ax2.set_ylabel('Value')
        
        self.figure.tight_layout()
        self.canvas.draw()
    
    def update_table(self):
        if self.current_data is None:
            return
        
        self.data_table.setRowCount(len(self.current_data))
        self.data_table.setColumnCount(len(self.current_data.columns))
        self.data_table.setHorizontalHeaderLabels(self.current_data.columns.tolist())
        
        for row_idx, (i, row) in enumerate(self.current_data.iterrows()):
            for j, value in enumerate(row):
                self.data_table.setItem(row_idx, j, QTableWidgetItem(str(value)))
    
    def load_history(self):
        if not self.token:
            return
        
        try:
            headers = {'Authorization': f'Token {self.token}'}
            response = requests.get(f'{API_URL}/history/', headers=headers)
            
            if response.status_code == 200:
                history = response.json()
                self.history_table.setRowCount(len(history))
                
                for i, item in enumerate(history):
                    self.history_table.setItem(i, 0, QTableWidgetItem(item['filename']))
                    self.history_table.setItem(i, 1, QTableWidgetItem(item['uploaded_at'][:10]))
                    self.history_table.setItem(i, 2, QTableWidgetItem(str(item['total_count'])))
                    self.history_table.setItem(i, 3, QTableWidgetItem(f"{item['avg_flowrate']:.2f}"))
                    self.history_table.setItem(i, 4, QTableWidgetItem(f"{item['avg_pressure']:.2f}"))
                    
                    # PDF download button
                    pdf_btn = QPushButton('Download PDF')
                    pdf_btn.clicked.connect(lambda checked, dataset_id=item['id']: self.download_pdf(dataset_id))
                    self.history_table.setCellWidget(i, 5, pdf_btn)
        
        except Exception as e:
            print(f'Failed to load history: {e}')
    
    def download_pdf(self, dataset_id):
        if not self.token:
            return
        
        try:
            headers = {'Authorization': f'Token {self.token}'}
            response = requests.get(f'{API_URL}/generate-pdf/{dataset_id}/', 
                                  headers=headers)
            
            if response.status_code == 200:
                filename, _ = QFileDialog.getSaveFileName(self, 'Save PDF', 
                                                         f'report_{dataset_id}.pdf',
                                                         'PDF Files (*.pdf)')
                if filename:
                    with open(filename, 'wb') as f:
                        f.write(response.content)
                    QMessageBox.information(self, 'Success', 'PDF downloaded successfully!')
        
        except Exception as e:
            QMessageBox.critical(self, 'Error', f'Download failed: {str(e)}')

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())

if __name__ == '__main__':
    main()

