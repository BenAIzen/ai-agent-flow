from django.db import models


class Company(models.Model):
    """계열사. 모든 비즈니스 데이터가 이 회사에 종속됩니다."""

    BIZ_TYPES = [("법인", "법인"), ("개인", "개인")]

    name = models.CharField("회사명", max_length=120)
    biz_no = models.CharField("사업자등록번호", max_length=20, blank=True, null=True)
    rep_name = models.CharField("대표자", max_length=60, blank=True, null=True)
    biz_type = models.CharField("구분", max_length=10, choices=BIZ_TYPES, default="법인")
    is_default = models.BooleanField("대표 회사", default=False)
    is_active = models.BooleanField("사용", default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "회사"
        verbose_name_plural = "회사"
        ordering = ["-is_default", "name"]

    def __str__(self) -> str:
        return self.name
