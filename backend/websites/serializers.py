from rest_framework import serializers
from .models import WebsiteSource, WebsitePage


class WebsitePageSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebsitePage
        fields = ('id', 'url', 'title', 'word_count', 'scraped_at')


class WebsiteSourceSerializer(serializers.ModelSerializer):
    pages_count = serializers.SerializerMethodField()

    class Meta:
        model = WebsiteSource
        fields = (
            'id', 'url', 'title', 'description', 'status',
            'pages_scraped', 'num_chunks', 'max_pages',
            'error_message', 'created_at', 'completed_at',
            'pages_count',
        )
        read_only_fields = (
            'id', 'title', 'description', 'status',
            'pages_scraped', 'num_chunks', 'error_message',
            'created_at', 'completed_at', 'pages_count',
        )

    def get_pages_count(self, obj):
        return obj.pages.count()


class WebsiteSubmitSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=2048)
    max_pages = serializers.IntegerField(min_value=1, max_value=50, default=20, required=False)

    def validate_url(self, value):
        """Ensure URL looks like a valid website."""
        from urllib.parse import urlparse
        parsed = urlparse(value)
        if parsed.scheme not in ('http', 'https'):
            raise serializers.ValidationError("URL must start with http:// or https://")
        if not parsed.netloc:
            raise serializers.ValidationError("Invalid URL: no domain found.")
        return value
