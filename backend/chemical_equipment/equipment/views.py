from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.http import HttpResponse
from django.db.models import Avg, Count
import pandas as pd
import io

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
        Generate enhanced PDF report with charts for a dataset
        """
        import matplotlib
        matplotlib.use('Agg')  # Use non-GUI backend
        import matplotlib.pyplot as plt
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
        from reportlab.lib.units import inch
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from reportlab.pdfgen import canvas
        import tempfile
        import os
        
        dataset = self.get_object()
        summary = dataset.get_summary_data()
        
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=1*inch,
            bottomMargin=0.75*inch,
            title=f'ChemFlow Report - {dataset.filename}',
            author='ChemFlow Analytics Platform',
            subject='Chemical Equipment Analysis Report'
            )
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#10b981'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#334155'),
            spaceAfter=12,
            spaceBefore=20,
            fontName='Helvetica-Bold'
        )
        
        # Header with colored background
        header_data = [[Paragraph('<font size=24 color="#ffffff"><b>ChemFlow Analytics Report</b></font>', styles['Normal'])]]
        header_table = Table(header_data, colWidths=[6.5*inch])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#10b981')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.4*inch))
        
        # Dataset Information Card
        info_data = [
            ['Dataset Information', ''],
            ['Filename:', dataset.filename],
            ['Upload Date:', dataset.uploaded_at.strftime('%B %d, %Y at %H:%M:%S')],
            ['Total Records:', str(dataset.total_records)],
        ]
        info_table = Table(info_data, colWidths=[2*inch, 4.5*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#475569')),
            ('BACKGROUND', (1, 1), (1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # Summary Statistics Cards
        elements.append(Paragraph('Summary Statistics', heading_style))
        
        stats_data = [
            ['Parameter', 'Minimum', 'Average', 'Maximum'],
            [
                'Flowrate',
                f"{summary.get('min_flowrate', 0):.2f}",
                f"{summary.get('avg_flowrate', 0):.2f}",
                f"{summary.get('max_flowrate', 0):.2f}"
            ],
            [
                'Pressure',
                f"{summary.get('min_pressure', 0):.2f}",
                f"{summary.get('avg_pressure', 0):.2f}",
                f"{summary.get('max_pressure', 0):.2f}"
            ],
            [
                'Temperature',
                f"{summary.get('min_temperature', 0):.2f}",
                f"{summary.get('avg_temperature', 0):.2f}",
                f"{summary.get('max_temperature', 0):.2f}"
            ],
        ]
        
        stats_table = Table(stats_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(stats_table)
        elements.append(Spacer(1, 0.4*inch))
        
        # Generate Charts
        type_dist = summary.get('type_distribution', {})
        
        if type_dist:
            # Create temporary directory for charts
            temp_dir = tempfile.mkdtemp()
            
            # 1. Bar Chart for Type Distribution
            fig, ax = plt.subplots(figsize=(8, 4))
            types = list(type_dist.keys())
            counts = list(type_dist.values())
            colors_list = ['#818cf8', '#34d399', '#a78bfa', '#fb923c', '#fbbf24', '#38bdf8']
            
            bars = ax.bar(types, counts, color=colors_list[:len(types)], edgecolor='white', linewidth=2)
            ax.set_xlabel('Equipment Type', fontsize=12, fontweight='bold')
            ax.set_ylabel('Count', fontsize=12, fontweight='bold')
            ax.set_title('Equipment Type Distribution', fontsize=14, fontweight='bold', pad=20)
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.grid(axis='y', alpha=0.3, linestyle='--')
            
            # Add value labels on bars
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{int(height)}',
                       ha='center', va='bottom', fontweight='bold')
            
            plt.tight_layout()
            bar_chart_path = os.path.join(temp_dir, 'bar_chart.png')
            plt.savefig(bar_chart_path, dpi=150, bbox_inches='tight', facecolor='white')
            plt.close()
            
            elements.append(Paragraph('Equipment Type Distribution', heading_style))
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Image(bar_chart_path, width=6*inch, height=3*inch))
            elements.append(Spacer(1, 0.3*inch))
            
            # 2. Pie Chart
            fig, ax = plt.subplots(figsize=(7, 5))
            pie_result = ax.pie(
                counts, 
                labels=types, 
                autopct='%1.1f%%',
                colors=colors_list[:len(types)],
                startangle=90,
                explode=[0.05] * len(types),
                shadow=True
            )
            wedges, texts, autotexts = pie_result if len(pie_result) == 3 else (pie_result[0], pie_result[1], [])
            
            for text in texts:
                text.set_fontsize(11)
                text.set_fontweight('bold')
            for autotext in autotexts:
                autotext.set_color('white')
                autotext.set_fontsize(10)
                autotext.set_fontweight('bold')
                
            ax.set_title('Type Distribution Breakdown', fontsize=14, fontweight='bold', pad=20)
            plt.tight_layout()
            pie_chart_path = os.path.join(temp_dir, 'pie_chart.png')
            plt.savefig(pie_chart_path, dpi=150, bbox_inches='tight', facecolor='white')
            plt.close()
            
            elements.append(PageBreak())
            elements.append(Paragraph('Type Distribution Breakdown', heading_style))
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Image(pie_chart_path, width=5*inch, height=3.5*inch))
            elements.append(Spacer(1, 0.3*inch))
            
            # 3. Parameter Comparison Chart
            fig, ax = plt.subplots(figsize=(8, 4))
            parameters = ['Flowrate', 'Pressure', 'Temperature']
            min_vals = [summary.get('min_flowrate', 0), summary.get('min_pressure', 0), summary.get('min_temperature', 0)]
            avg_vals = [summary.get('avg_flowrate', 0), summary.get('avg_pressure', 0), summary.get('avg_temperature', 0)]
            max_vals = [summary.get('max_flowrate', 0), summary.get('max_pressure', 0), summary.get('max_temperature', 0)]
            
            x = range(len(parameters))
            width = 0.25
            
            ax.bar([i - width for i in x], min_vals, width, label='Minimum', color='#ef4444')
            ax.bar(x, avg_vals, width, label='Average', color='#10b981')
            ax.bar([i + width for i in x], max_vals, width, label='Maximum', color='#3b82f6')
            
            ax.set_xlabel('Parameters', fontsize=12, fontweight='bold')
            ax.set_ylabel('Values', fontsize=12, fontweight='bold')
            ax.set_title('Parameter Comparison (Min/Avg/Max)', fontsize=14, fontweight='bold', pad=20)
            ax.set_xticks(x)
            ax.set_xticklabels(parameters)
            ax.legend(loc='upper left', framealpha=0.9)
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.grid(axis='y', alpha=0.3, linestyle='--')
            
            plt.tight_layout()
            comparison_chart_path = os.path.join(temp_dir, 'comparison_chart.png')
            plt.savefig(comparison_chart_path, dpi=150, bbox_inches='tight', facecolor='white')
            plt.close()
            
            elements.append(Paragraph('Parameter Comparison Analysis', heading_style))
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Image(comparison_chart_path, width=6*inch, height=3*inch))
            elements.append(Spacer(1, 0.3*inch))
        
        # Equipment Records Table
        elements.append(PageBreak())
        elements.append(Paragraph('Equipment Records Details', heading_style))
        elements.append(Spacer(1, 0.2*inch))
        
        equipment = dataset.equipment_records.all()[:20]
        
        eq_data = [['Name', 'Type', 'Flowrate', 'Pressure', 'Temperature']]
        for eq in equipment:
            eq_data.append([
                eq.equipment_name[:25],
                eq.equipment_type,
                f"{eq.flowrate:.2f}",
                f"{eq.pressure:.2f}",
                f"{eq.temperature:.2f}"
            ])
        
        eq_table = Table(eq_data, colWidths=[2*inch, 1.3*inch, 1.1*inch, 1.1*inch, 1*inch])
        eq_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(eq_table)
        
        # Footer
        elements.append(Spacer(1, 0.5*inch))
        footer_text = f'<para align=center><font size=8 color="#64748b">Generated by ChemFlow Analytics Platform | {dataset.uploaded_at.strftime("%B %d, %Y")}</font></para>'
        elements.append(Paragraph(footer_text, styles['Normal']))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        # Clean up temporary files
        if type_dist:
            try:
                os.remove(bar_chart_path)
                os.remove(pie_chart_path)
                os.remove(comparison_chart_path)
                os.rmdir(temp_dir)
            except:
                pass
        
        # Return PDF response
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="chemflow_report_{dataset.id}.pdf"'
        return response