from rest_framework import serializers
from .models import Dataset
from django.contrib.auth.models import User

class DatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ['id', 'filename', 'uploaded_at', 'total_count', 
                  'avg_flowrate', 'avg_pressure', 'avg_temperature', 
                  'equipment_types']
        read_only_fields = ['uploaded_at']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']