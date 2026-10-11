from django.urls import path

from .views import (
    SignUpView,
    LoginView,
    ProfileView,
    PasswordChangeView,
    TokenRefreshView,
    LogoutView,
)

urlpatterns = [
    path('signup/', SignUpView.as_view()),
    path('login/', LoginView.as_view()),
    path('me/', ProfileView.as_view()),
    path('password-change/', PasswordChangeView.as_view()),
    path('token-refresh/', TokenRefreshView.as_view()),
    path('logout/', LogoutView.as_view()),
]