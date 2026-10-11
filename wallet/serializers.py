from rest_framework import serializers

from .models import Wallet


class WalletSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Wallet
        fields = ['id', 'username', 'balance', 'created_at']
        read_only_fields = fields