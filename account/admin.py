from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Extra', {'fields': ('phone_number',)}),
    )
    list_display = ('username', 'email', 'phone_number', 'is_staff')