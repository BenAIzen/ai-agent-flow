from django.urls import path

from .views import ConvertView, DownloadView

urlpatterns = [
    path("convert", ConvertView.as_view(), name="convert"),
    path("convert/download/<str:download_id>", DownloadView.as_view(),
         name="convert-download"),
]
