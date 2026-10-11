from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

from rest_framework import permissions
from drf_yasg import openapi
from drf_yasg.views import get_schema_view

#tranzaksiya bo'ladi
schema_view = get_schema_view(
    openapi.Info(
        title="Payment Transaction API",
        default_version='v1',
        description="Click va Payme'dan ilhomlangan o'quv loyihasi (simulyatsiya)",
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # Django admin
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('admin/', admin.site.urls),
    path('api/accounts/', include('account.urls')),
    path('api/wallet/', include('wallet.urls')),
    path('api/transactions/', include('transactions.urls')),

    # Swagger / ReDoc
    re_path(
        r'^swagger(?P<format>\.json|\.yaml)$',schema_view.without_ui(cache_timeout=0),name='schema-json',
    ),
    path(
        'swagger/',schema_view.with_ui('swagger', cache_timeout=0),name='schema-swagger-ui',
    ),
    path(
        'redoc/',schema_view.with_ui('redoc', cache_timeout=0),name='schema-redoc',
    ),
]
