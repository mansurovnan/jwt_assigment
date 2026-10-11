from django.db import models
from django.utils.translation import gettext_lazy as _

from base.models import BaseModel
from wallet.models import Wallet


class Transaction(BaseModel):
    class Status(models.TextChoices):
        COMPLETED = 'completed', _('Completed')
        FAILED = 'failed', _('Failed')

    sender = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name='sent_transactions',
    )
    receiver = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name='received_transactions',
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.COMPLETED,
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.sender.user.username} → {self.receiver.user.username}: {self.amount}'