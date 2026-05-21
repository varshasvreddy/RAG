from rest_framework import serializers
from .models import Document, DocumentChunk


class DocumentChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentChunk
        fields = ('id', 'content', 'chunk_index', 'page_number', 'metadata')


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = (
            'id', 'title', 'file', 'file_type', 'file_size',
            'num_pages', 'num_chunks', 'is_processed',
            'processing_error', 'uploaded_at', 'processed_at',
        )
        read_only_fields = (
            'id', 'file_type', 'file_size', 'num_pages', 'num_chunks',
            'is_processed', 'processing_error', 'uploaded_at', 'processed_at',
        )


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    title = serializers.CharField(max_length=255, required=False)

    def validate_file(self, value):
        allowed_types = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'text/plain': 'txt',
        }
        # Also check extension as fallback
        ext_map = {'.pdf': 'pdf', '.docx': 'docx', '.txt': 'txt'}
        ext = '.' + value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''

        content_type = value.content_type
        if content_type not in allowed_types and ext not in ext_map:
            raise serializers.ValidationError(
                "Unsupported file type. Please upload PDF, DOCX, or TXT files."
            )
        return value
