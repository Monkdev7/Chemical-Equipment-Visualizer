from django.db import models
from django.contrib.auth.models import User
import json


class Dataset(models.Model):
    """Store uploaded CSV datasets with metadata"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    total_records = models.IntegerField(default=0)
    summary_data = models.TextField(blank=True)  # JSON string
    
    class Meta:
        ordering = ['-uploaded_at']
        
    def __str__(self):
        return f"{self.filename} - {self.uploaded_at.strftime('%Y-%m-%d %H:%M')}"
    
    def get_summary_data(self):
        """Return summary data as dictionary"""
        try:
            if self.summary_data and self.summary_data.strip():
                return json.loads(self.summary_data)
        except (json.JSONDecodeError, ValueError):
            pass
        return {}
    
    def set_summary_data(self, data):
        """Store summary data as JSON string"""
        self.summary_data = json.dumps(data)
        

class Equipment(models.Model):
    """Store individual equipment records"""
    
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='equipment_records')
    equipment_name = models.CharField(max_length=255)
    equipment_type = models.CharField(max_length=100)
    flowrate = models.FloatField()
    pressure = models.FloatField()
    temperature = models.FloatField()
    
    class Meta:
        ordering = ['equipment_name']
        
    def __str__(self):
        return f"{self.equipment_name} ({self.equipment_type})"