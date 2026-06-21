from django.urls import path

from .views import CommitView, ConvertView, DownloadView

urlpatterns = [
    path("convert", ConvertView.as_view(), name="convert"),
    path("convert/commit", CommitView.as_view(), name="convert-commit"),
    path("convert/download/<str:download_id>", DownloadView.as_view(),
         name="convert-download"),
]
