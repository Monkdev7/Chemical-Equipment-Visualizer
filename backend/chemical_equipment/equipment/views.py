from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.http import HttpResponse
from django.db.models import Avg, Count
import pandas as pd
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

from .models import Dataset, Equipment
from .serializers import DatasetSerializer, DatasetListSerializer


class DatasetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing datasets with CSV upload and analysis
    """
    queryset = Dataset.objects.all()
    permission_classes = [AllowAny]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DatasetListSerializer
        return DatasetSerializer
    
    def list(self, request):
        """Get last 5 datasets"""
        datasets = Dataset.objects.all()[:5]
        serializer = self.get_serializer(datasets, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def upload(self, request):
        """
        Upload and process CSV file
        Expected columns: Equipment Name, Type, Flowrate, Pressure, Temperature
        """
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        csv_file = request.FILES['file']
        
        # Validate file extension
        if not csv_file.name.endswith('.csv'):
            return Response(
                {'error': 'File must be CSV format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Read CSV using pandas
            df = pd.read_csv(csv_file)
            
            # Validate required columns
            required_columns = ['Equipment Name', 'Type', 'Flowrate', 'Pressure', 'Temperature']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return Response(
                    {'error': f'Missing required columns: {", ".join(missing_columns)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Clean data - remove rows with missing values
            df_clean = df.dropna(subset=required_columns)
            
            if len(df_clean) == 0:
                return Response(
                    {'error': 'No valid data found in CSV'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create dataset
            dataset = Dataset.objects.create(
                user=request.user if request.user.is_authenticated else None,
                filename=csv_file.name,
                total_records=len(df_clean)
            )
            
            # Calculate summary statistics
            summary = {
                'total_count': len(df_clean),
                'avg_flowrate': float(df_clean['Flowrate'].mean()),
                'avg_pressure': float(df_clean['Pressure'].mean()),
                'avg_temperature': float(df_clean['Temperature'].mean()),
                'type_distribution': df_clean['Type'].value_counts().to_dict(),
                'min_flowrate': float(df_clean['Flowrate'].min()),
                'max_flowrate': float(df_clean['Flowrate'].max()),
                'min_pressure': float(df_clean['Pressure'].min()),
                'max_pressure': float(df_clean['Pressure'].max()),
                'min_temperature': float(df_clean['Temperature'].min()),
                'max_temperature': float(df_clean['Temperature'].max()),
            }
            
            dataset.set_summary_data(summary)
            dataset.save()
            
            # Create equipment records
            equipment_list = []
            for _, row in df_clean.iterrows():
                equipment_list.append(Equipment(
                    dataset=dataset,
                    equipment_name=row['Equipment Name'],
                    equipment_type=row['Type'],
                    flowrate=float(row['Flowrate']),
                    pressure=float(row['Pressure']),
                    temperature=float(row['Temperature'])
                ))
            
            Equipment.objects.bulk_create(equipment_list)
            
            # Maintain only last 5 datasets
            old_datasets = Dataset.objects.all()[5:]
            for old_dataset in old_datasets:
                old_dataset.delete()
            
            # Return created dataset with details
            serializer = DatasetSerializer(dataset)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Error processing CSV: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def generate_pdf(self, request, pk=None):
        """
        Generate PDF report for a dataset
        """
        dataset = self.get_object()
        
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title = Paragraph(f"<b>Chemical Equipment Analysis Report</b>", styles['Title'])
        elements.append(title)
        elements.append(Spacer(1, 0.3*inch))
        
        # Dataset Info
        info_text = f"""
        <b>Dataset:</b> {dataset.filename}<br/>
        <b>Upload Date:</b> {dataset.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')}<br/>
        <b>Total Records:</b> {dataset.total_records}
        """
        info = Paragraph(info_text, styles['Normal'])
        elements.append(info)
        elements.append(Spacer(1, 0.3*inch))
        
        # Summary Statistics
        summary = dataset.get_summary_data()
        summary_text = f"""
        <b>Summary Statistics:</b><br/>
        Average Flowrate: {summary.get('avg_flowrate', 0):.2f}<br/>
        Average Pressure: {summary.get('avg_pressure', 0):.2f}<br/>
        Average Temperature: {summary.get('avg_temperature', 0):.2f}
        """
        summary_para = Paragraph(summary_text, styles['Normal'])
        elements.append(summary_para)
        elements.append(Spacer(1, 0.3*inch))
        
        # Equipment Type Distribution
        elements.append(Paragraph("<b>Equipment Type Distribution:</b>", styles['Heading2']))
        type_dist = summary.get('type_distribution', {})
        type_data = [['Equipment Type', 'Count']]
        for eq_type, count in type_dist.items():
            type_data.append([eq_type, str(count)])
        
        type_table = Table(type_data)
        type_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(type_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Equipment Records Table (first 20 records)
        elements.append(Paragraph("<b>Equipment Records (First 20):</b>", styles['Heading2']))
        equipment = dataset.equipment_records.all()[:20]
        
        eq_data = [['Name', 'Type', 'Flowrate', 'Pressure', 'Temp']]
        for eq in equipment:
            eq_data.append([
                eq.equipment_name[:20],
                eq.equipment_type,
                f"{eq.flowrate:.2f}",
                f"{eq.pressure:.2f}",
                f"{eq.temperature:.2f}"
            ])
        
        eq_table = Table(eq_data, colWidths=[2*inch, 1.2*inch, 1*inch, 1*inch, 1*inch])
        eq_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(eq_table)
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        # Return PDF response
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="equipment_report_{dataset.id}.pdf"'
        return response