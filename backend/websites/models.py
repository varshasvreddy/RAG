import uuid
from django.db import models
from django.contrib.auth.models import User


class WebsiteSource(models.Model):
    """A scraped website used as a knowledge source for RAG."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('scraping', 'Scraping'),
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='websites')
    url = models.URLField(max_length=2048)
    title = models.CharField(max_length=500, blank=True, default='')
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    pages_scraped = models.PositiveIntegerField(default=0)
    num_chunks = models.PositiveIntegerField(default=0)
    max_pages = models.PositiveIntegerField(default=20)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title or self.url} ({self.status})"


class WebsitePage(models.Model):
    """A single scraped page from a website."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    website = models.ForeignKey(WebsiteSource, on_delete=models.CASCADE, related_name='pages')
    url = models.URLField(max_length=2048)
    title = models.CharField(max_length=500, blank=True, default='')
    content = models.TextField()
    word_count = models.PositiveIntegerField(default=0)
    scraped_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['scraped_at']

    def __str__(self):
        return f"{self.title or self.url}"
