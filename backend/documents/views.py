import threading
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Document
from .serializers import DocumentSerializer, DocumentUploadSerializer
from .processor import process_document


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data['file']

        # Determine file type
        ext_map = {'.pdf': 'pdf', '.docx': 'docx', '.txt': 'txt'}
        ext = '.' + uploaded_file.name.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.name else ''
        file_type = ext_map.get(ext, 'pdf')

        title = serializer.validated_data.get('title') or uploaded_file.name

        # Create document record
        document = Document.objects.create(
            user=request.user,
            title=title,
            file=uploaded_file,
            file_type=file_type,
            file_size=uploaded_file.size,
        )

        # Process document in background thread
        thread = threading.Thread(
            target=process_document,
            args=(str(document.id),),
            daemon=True,
        )
        thread.start()

        return Response(
            DocumentSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        """Re-process a document that failed."""
        document = self.get_object()
        document.is_processed = False
        document.processing_error = None
        document.save()

        thread = threading.Thread(
            target=process_document,
            args=(str(document.id),),
            daemon=True,
        )
        thread.start()

        return Response(
            DocumentSerializer(document).data,
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        # Clean up the file and vector store
        if document.file:
            try:
                document.file.delete(save=False)
            except Exception:
                pass

        import shutil
        from pathlib import Path
        from django.conf import settings
        store_path = Path(settings.VECTOR_STORE_DIR) / str(document.id)
        if store_path.exists():
            shutil.rmtree(store_path, ignore_errors=True)

        return super().destroy(request, *args, **kwargs)
