from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """사용자. AbstractUser 확장 — Django 표준 권한/그룹/admin 모두 사용 가능."""

    display_name = models.CharField("표시 이름", max_length=60, blank=True)
    default_company = models.ForeignKey(
        "companies.Company",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="default_for_users",
        verbose_name="기본 회사",
    )

    class Meta:
        verbose_name = "사용자"
        verbose_name_plural = "사용자"


class UserCompany(models.Model):
    """사용자-회사 멤버십. 사용자가 접근 가능한 회사 목록."""

    ROLES = [("admin", "관리자"), ("member", "일반")]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="memberships"
    )
    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=ROLES, default="member")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "회사 멤버십"
        verbose_name_plural = "회사 멤버십"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "company"], name="uq_user_company"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} → {self.company.name}"
