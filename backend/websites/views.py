import threading
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import WebsiteSource
from .serializers import (
    WebsiteSourceSerializer,
    WebsiteSubmitSerializer,
    WebsitePageSerializer,
)
from .scraper import process_website


class WebsiteViewSet(viewsets.ModelViewSet):
    """Manage website sources — submit URLs for scraping, list, delete."""
    serializer_class = WebsiteSourceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WebsiteSource.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Submit a new URL for scraping."""
        serializer = WebsiteSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        url = serializer.validated_data['url']
        max_pages = serializer.validated_data.get('max_pages', 20)

        # Create the website record
        website = WebsiteSource.objects.create(
            user=request.user,
            url=url,
            max_pages=max_pages,
        )

        # Process in background thread
        thread = threading.Thread(
            target=process_website,
            args=(str(website.id),),
            daemon=True,
        )
        thread.start()

        return Response(
            WebsiteSourceSerializer(website).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def rescrape(self, request, pk=None):
        """Re-scrape a website that failed."""
        website = self.get_object()
        website.status = 'pending'
        website.error_message = None
        website.save()

        thread = threading.Thread(
            target=process_website,
            args=(str(website.id),),
            daemon=True,
        )
        thread.start()

        return Response(
            WebsiteSourceSerializer(website).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get'])
    def pages(self, request, pk=None):
        """List all scraped pages for a website."""
        website = self.get_object()
        pages = website.pages.all()
        return Response(
            WebsitePageSerializer(pages, many=True).data,
        )

    def destroy(self, request, *args, **kwargs):
        website = self.get_object()

        # Clean up the vector store
        import shutil
        from pathlib import Path
        from django.conf import settings
        store_path = Path(settings.VECTOR_STORE_DIR) / f"web-{website.id}"
        if store_path.exists():
            shutil.rmtree(store_path, ignore_errors=True)

        return super().destroy(request, *args, **kwargs)
