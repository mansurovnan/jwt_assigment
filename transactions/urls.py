from django.urls import path

from .views import TransferView, TransactionListView, TransactionDetailView

urlpatterns = [
    path('', TransactionListView.as_view()),
    path('transfer/', TransferView.as_view()),
    path('<uuid:pk>/', TransactionDetailView.as_view()),
]