from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Transaction
from .serializers import TransactionSerializer, TransferSerializer


def user_transactions(user):
    return (
        Transaction.objects
        .filter(Q(sender__user=user) | Q(receiver__user=user))
        .select_related('sender__user', 'receiver__user')
    )


class TransferView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(request_body=TransferSerializer)
    def post(self, request):
        serializer = TransferSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        tx = serializer.save()
        return Response(
            {
                'msg': _('Transfer completed successfully.'),
                'transaction': TransactionSerializer(tx, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class TransactionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = user_transactions(request.user)
        serializer = TransactionSerializer(qs, many=True, context={'request': request})
        return Response({'data': serializer.data})


class TransactionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        tx = get_object_or_404(user_transactions(request.user), pk=pk)
        return Response({'data': TransactionSerializer(tx, context={'request': request}).data})