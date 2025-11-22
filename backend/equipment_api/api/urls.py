from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('upload/', views.upload_csv, name='upload'),
    path('history/', views.get_history, name='history'),
    path('generate-pdf/<int:dataset_id>/', views.generate_pdf, name='generate_pdf'),
]