from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.translation import gettext as _
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from wallet.models import Wallet
from .models import Transaction

User = get_user_model()


class TransactionSerializer(serializers.ModelSerializer):
    sender = serializers.CharField(source='sender.user.username', read_only=True)
    receiver = serializers.CharField(source='receiver.user.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    direction = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id',
            'sender',
            'receiver',
            'amount',
            'status',
            'status_display',
            'direction',
            'created_at',
        ]

    def get_direction(self, obj):
        request = self.context.get('request')
        if request and obj.sender.user_id == request.user.id:
            return 'sent'
        return 'received'


class TransferSerializer(serializers.Serializer):
    receiver_id = serializers.UUIDField(required=False)
    receiver_username = serializers.CharField(required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)

    def validate_amount(self, value):
        if value <= 0:
            raise ValidationError(_('Amount must be greater than zero.'))
        return value

    def validate(self, attrs):
        request = self.context['request']
        receiver_id = attrs.get('receiver_id')
        receiver_username = (attrs.get('receiver_username') or '').strip()

        if not receiver_id and not receiver_username:
            raise ValidationError({'receiver_id': _('Provide receiver_id or receiver_username.')})

        users = User.objects.filter(is_active=True)
        if receiver_id:
            receiver = users.filter(id=receiver_id).first()
            error_field = 'receiver_id'
        else:
            receiver = users.filter(username=receiver_username).first()
            error_field = 'receiver_username'

        if receiver is None:
            raise ValidationError({error_field: _('Receiver not found.')})

        if receiver.id == request.user.id:
            raise ValidationError({error_field: _('You cannot transfer money to yourself.')})

        attrs['receiver'] = receiver
        return attrs


    def create(self, validated_data):
        sender_user = self.context['request'].user
        receiver_user = validated_data['receiver']
        amount = validated_data['amount']

        Wallet.objects.get_or_create(user=sender_user)
        Wallet.objects.get_or_create(user=receiver_user)

        with transaction.atomic():
            wallets = (
                Wallet.objects
                .select_for_update()
                .filter(user__in=[sender_user, receiver_user])
                .order_by('id')
            )
            wallets_by_user = {w.user_id: w for w in wallets}
            sender_wallet = wallets_by_user[sender_user.id]
            receiver_wallet = wallets_by_user[receiver_user.id]

            if sender_wallet.balance < amount:
                raise ValidationError({'amount': _('Insufficient balance.')})

            sender_wallet.balance -= amount
            receiver_wallet.balance += amount
            sender_wallet.save(update_fields=['balance', 'updated_at'])
            receiver_wallet.save(update_fields=['balance', 'updated_at'])

            return Transaction.objects.create(
                sender=sender_wallet,
                receiver=receiver_wallet,
                amount=amount,
                status=Transaction.Status.COMPLETED,
            )