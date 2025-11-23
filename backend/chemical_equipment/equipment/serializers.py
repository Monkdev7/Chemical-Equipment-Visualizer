from rest_framework import serializers
from .models import Dataset, Equipment


class EquipmentSerializer(serializers.ModelSerializer):
    """Serializer for Equipment model"""
    
    class Meta:
        model = Equipment
        fields = ['id', 'equipment_name', 'equipment_type', 'flowrate', 'pressure', 'temperature']


class DatasetSerializer(serializers.ModelSerializer):
    """Serializer for Dataset model with equipment records"""
    
    equipment_records = EquipmentSerializer(many=True, read_only=True)
    summary = serializers.SerializerMethodField()
    
    class Meta:
        model = Dataset
        fields = ['id', 'filename', 'uploaded_at', 'total_records', 'summary', 'equipment_records']
        
    def get_summary(self, obj):
        """Get summary data as dictionary"""
        return obj.get_summary_data()


class DatasetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dataset list"""
    
    summary = serializers.SerializerMethodField()
    
    class Meta:
        model = Dataset
        fields = ['id', 'filename', 'uploaded_at', 'total_records', 'summary']
        
    def get_summary(self, obj):
        """Get summary data as dictionary"""
        return obj.get_summary_data()