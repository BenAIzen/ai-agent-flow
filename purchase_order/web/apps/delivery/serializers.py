from rest_framework import serializers

from .models import DeliveryLine, DeliveryOrder


class DeliveryLineSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source="item.code", read_only=True)
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = DeliveryLine
        fields = ("id", "item", "item_code", "item_name",
                  "spec", "unit", "qty", "unit_price",
                  "supply_amount", "vat_amount", "total", "note")
        read_only_fields = ("id", "supply_amount", "vat_amount", "total")


class DeliveryOrderSerializer(serializers.ModelSerializer):
    lines = DeliveryLineSerializer(many=True, required=False)
    partner_code = serializers.CharField(source="partner.code", read_only=True)
    partner_name = serializers.CharField(source="partner.name", read_only=True)

    class Meta:
        model = DeliveryOrder
        fields = (
            "id", "order_no", "order_date",
            "partner", "partner_code", "partner_name",
            "vat_type", "tax_type", "status", "note",
            "subtotal", "vat_total", "total",
            "lines",
        )
        read_only_fields = ("id", "order_no", "subtotal", "vat_total", "total")

    def create(self, validated_data):
        from apps.companies.mixins import get_request_company

        lines_data = validated_data.pop("lines", [])
        company = get_request_company(self.context["request"])
        validated_data["company"] = company
        validated_data["order_no"] = DeliveryOrder.generate_order_no(
            company.id, validated_data["order_date"]
        )

        order = DeliveryOrder.objects.create(**validated_data)
        for ld in lines_data:
            line = DeliveryLine(order=order, **ld)
            if not line.spec and ld["item"].spec:
                line.spec = ld["item"].spec
            if not line.unit and ld["item"].unit_out:
                line.unit = ld["item"].unit_out
            line.compute(order.vat_type)
            line.save()
        order.recompute_totals()
        return order

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            for ld in lines_data:
                line = DeliveryLine(order=instance, **ld)
                if not line.spec and ld["item"].spec:
                    line.spec = ld["item"].spec
                if not line.unit and ld["item"].unit_out:
                    line.unit = ld["item"].unit_out
                line.compute(instance.vat_type)
                line.save()
        instance.recompute_totals()
        return instance
