from django.utils.translation import gettext as _
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    SignUpSerializer,
    LoginSerializer,
    ProfileSerializer,
    PasswordChangeSerializer,
    RefreshTokenSerializer,
)


class SignUpView(APIView):
    authentication_classes = []

    @swagger_auto_schema(request_body=SignUpSerializer)
    def post(self, request):
        serializer = SignUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    authentication_classes = []

    @swagger_auto_schema(request_body=LoginSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh_token': str(refresh),
            'access_token': str(refresh.access_token),
        })


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'data': ProfileSerializer(request.user).data})

    @swagger_auto_schema(request_body=ProfileSerializer)
    def patch(self, request):
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'msg': _('Profile updated successfully.'),
            'data': serializer.data,
        })


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(request_body=PasswordChangeSerializer)
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'msg': _('Password changed successfully.')})


class TokenRefreshView(APIView):
    authentication_classes = []

    @swagger_auto_schema(request_body=RefreshTokenSerializer)
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            refresh = RefreshToken(serializer.validated_data['refresh_token'])
        except TokenError:
            raise ValidationError({'refresh_token': _('Token is invalid or expired.')})
        return Response({'access_token': str(refresh.access_token)})


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(request_body=RefreshTokenSerializer)
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data['refresh_token'])
        except TokenError:
            raise ValidationError({'refresh_token': _('Token is invalid or expired.')})

        if str(token.get('user_id')) != str(request.user.id):
            raise ValidationError({'refresh_token': _('This token does not belong to you.')})

        token.blacklist()
        return Response({'msg': _('You have logged out.')})