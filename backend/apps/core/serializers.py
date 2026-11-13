from rest_framework import serializers

from .models import RefrigerantType


class RefrigerantTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RefrigerantType
        fields = ["id", "code", "name", "gwp", "is_a2l", "is_ammonia", "is_high_pressure"]
