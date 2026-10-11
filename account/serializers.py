from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.translation import gettext as _
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from wallet.models import Wallet
from .models import CustomUser


class SignUpSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    password = serializers.CharField(write_only=True)
    conf_pass = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'phone_number',
            'password',
            'conf_pass',
        ]

    def validate_email(self, value):
        if value and CustomUser.objects.filter(email__iexact=value).exists():
            raise ValidationError(_('A user with this email already exists.'))
        return value

    def validate(self, data):
        if data['password'] != data['conf_pass']:
            raise ValidationError({'conf_pass': _('Passwords do not match.')})
        try:
            validate_password(data['password'])
        except DjangoValidationError as e:
            raise ValidationError({'password': list(e.messages)})
        return data

    def create(self, validated_data):
        validated_data.pop('conf_pass')
        with transaction.atomic():
            user = CustomUser.objects.create_user(**validated_data)
            Wallet.objects.create(user=user)
        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            'msg': _('User created successfully.'),
            'user': data,
        }


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs.get('username'),
            password=attrs.get('password'),
        )
        if user is None:
            raise ValidationError(_('Invalid username or password.'))
        attrs['user'] = user
        return attrs


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'phone_number',
        ]
        read_only_fields = ['id', 'username']

    def validate_email(self, value):
        qs = CustomUser.objects.filter(email__iexact=value).exclude(pk=self.instance.pk)
        if value and qs.exists():
            raise ValidationError(_('A user with this email already exists.'))
        return value


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    conf_pass = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise ValidationError(_('Old password is incorrect.'))
        return value

    def validate(self, data):
        if data['new_password'] != data['conf_pass']:
            raise ValidationError({'conf_pass': _('Passwords do not match.')})
        try:
            validate_password(data['new_password'], user=self.context['request'].user)
        except DjangoValidationError as e:
            raise ValidationError({'new_password': list(e.messages)})
        return data


class RefreshTokenSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()