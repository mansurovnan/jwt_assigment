from django.contrib.auth.models import AbstractUser
from django.db import models

from base.models import BaseModel


class CustomUser(AbstractUser, BaseModel):
    phone_number = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.username