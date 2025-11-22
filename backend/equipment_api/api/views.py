import pandas as pd
import io
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from .models import Dataset
from .serializers import DatasetSerializer, UserSerializer

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email', '')
    
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    user = User.objects.create_user(username=username, password=password, email=email)
    token, _ = Token.objects.get_or_create(user=user)
    
    return Response({
        'token': token.key,
        'user': UserSerializer(user).data
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(username=username, password=password)
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })
    
    return Response({'error': 'Invalid credentials'}, 
                   status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
def upload_csv(request):
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    file = request.FILES['file']
    
    try:
        # Read CSV
        df = pd.read_csv(file)
        
        # Validate columns
        required_cols = ['Equipment Name', 'Type', 'Flowrate', 'Pressure', 'Temperature']
        if not all(col in df.columns for col in required_cols):
            return Response({'error': 'Invalid CSV format. Required columns: ' + ', '.join(required_cols)}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate statistics
        total_count = len(df)
        avg_flowrate = df['Flowrate'].mean()
        avg_pressure = df['Pressure'].mean()
        avg_temperature = df['Temperature'].mean()
        equipment_types = df['Type'].value_counts().to_dict()
        
        # Save to database and manage last 5
        file.seek(0)  # Reset file pointer
        dataset = Dataset.objects.create(
            user=request.user,
            filename=file.name,
            file=file,
            total_count=total_count,
            avg_flowrate=avg_flowrate,
            avg_pressure=avg_pressure,
            avg_temperature=avg_temperature,
            equipment_types=equipment_types
        )
        
        # Keep only last 5 datasets per user
        user_datasets = Dataset.objects.filter(user=request.user)
        if user_datasets.count() > 5:
            old_datasets = user_datasets[5:]
            for old_ds in old_datasets:
                old_ds.file.delete()
                old_ds.delete()
        
        # Return data for visualization
        return Response({
            'dataset_id': dataset.id,
            'summary': {
                'total_count': total_count,
                'avg_flowrate': round(avg_flowrate, 2),
                'avg_pressure': round(avg_pressure, 2),
                'avg_temperature': round(avg_temperature, 2),
                'equipment_types': equipment_types
            },
            'data': df.to_dict('records')
        })
        
    except Exception as e:
        return Response({'error': str(e)}, 
                       status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_history(request):
    datasets = Dataset.objects.filter(user=request.user)[:5]
    serializer = DatasetSerializer(datasets, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def generate_pdf(request, dataset_id):
    try:
        dataset = Dataset.objects.get(id=dataset_id, user=request.user)
        
        # Create PDF
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="report_{dataset.filename}.pdf"'
        
        p = canvas.Canvas(response, pagesize=letter)
        width, height = letter
        
        # Title
        p.setFont("Helvetica-Bold", 20)
        p.drawString(1*inch, height - 1*inch, "Equipment Analysis Report")
        
        # Dataset info
        p.setFont("Helvetica", 12)
        y = height - 1.5*inch
        p.drawString(1*inch, y, f"Dataset: {dataset.filename}")
        y -= 0.3*inch
        p.drawString(1*inch, y, f"Upload Date: {dataset.uploaded_at.strftime('%Y-%m-%d %H:%M')}")
        
        # Summary statistics
        y -= 0.5*inch
        p.setFont("Helvetica-Bold", 14)
        p.drawString(1*inch, y, "Summary Statistics")
        y -= 0.3*inch
        
        p.setFont("Helvetica", 11)
        stats = [
            f"Total Equipment Count: {dataset.total_count}",
            f"Average Flowrate: {dataset.avg_flowrate:.2f}",
            f"Average Pressure: {dataset.avg_pressure:.2f}",
            f"Average Temperature: {dataset.avg_temperature:.2f}"
        ]
        
        for stat in stats:
            p.drawString(1.2*inch, y, stat)
            y -= 0.25*inch
        
        # Equipment types
        y -= 0.3*inch
        p.setFont("Helvetica-Bold", 14)
        p.drawString(1*inch, y, "Equipment Type Distribution")
        y -= 0.3*inch
        
        p.setFont("Helvetica", 11)
        for eq_type, count in dataset.equipment_types.items():
            p.drawString(1.2*inch, y, f"{eq_type}: {count}")
            y -= 0.25*inch
        
        p.showPage()
        p.save()
        
        return response
        
    except Dataset.DoesNotExist:
        return Response({'error': 'Dataset not found'}, 
                       status=status.HTTP_404_NOT_FOUND)