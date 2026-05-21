from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    ConversationListSerializer,
    MessageSerializer,
    ChatQuerySerializer,
)
from .rag_engine import generate_answer


class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return ConversationListSerializer
        return ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        title = request.data.get('title', 'New Conversation')
        document_ids = request.data.get('document_ids', [])
        website_ids = request.data.get('website_ids', [])

        conversation = Conversation.objects.create(
            user=request.user,
            title=title,
        )

        if document_ids:
            from documents.models import Document
            docs = Document.objects.filter(
                id__in=document_ids,
                user=request.user,
                is_processed=True,
            )
            conversation.documents.set(docs)

        if website_ids:
            from websites.models import WebsiteSource
            sites = WebsiteSource.objects.filter(
                id__in=website_ids,
                user=request.user,
                status='ready',
            )
            conversation.websites.set(sites)

        return Response(
            ConversationSerializer(conversation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def ask(self, request, pk=None):
        """Send a message and get an AI response."""
        conversation = self.get_object()
        serializer = ChatQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_message = serializer.validated_data['message']
        extra_doc_ids = serializer.validated_data.get('document_ids', [])
        extra_web_ids = serializer.validated_data.get('website_ids', [])

        # Combine conversation docs with any extra doc IDs
        doc_ids = list(conversation.documents.values_list('id', flat=True))
        for did in extra_doc_ids:
            if did not in doc_ids:
                doc_ids.append(did)

        web_ids = list(conversation.websites.values_list('id', flat=True))
        for wid in extra_web_ids:
            if wid not in web_ids:
                web_ids.append(wid)

        if not doc_ids and not web_ids:
            return Response(
                {'error': 'No documents or websites associated with this conversation. Please add sources first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save user message
        user_msg = Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_message,
        )

        # Get chat history
        history = list(
            conversation.messages
            .order_by('created_at')
            .values('role', 'content')
        )

        # Generate answer via RAG
        source_ids = [str(d) for d in doc_ids] + [f"web-{w}" for w in web_ids]

        try:
            result = generate_answer(
                query=user_message,
                document_ids=source_ids,
                chat_history=history[:-1],  # Exclude the message we just added
            )
        except ValueError as e:
            # API key not configured
            return Response(
                {'error': str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to generate answer: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Save assistant message
        assistant_msg = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=result['answer'],
            sources=result['sources'],
        )

        # Auto-title conversation from first question
        if conversation.title == 'New Conversation':
            conversation.title = user_message[:80]
            conversation.save()

        return Response({
            'user_message': MessageSerializer(user_msg).data,
            'assistant_message': MessageSerializer(assistant_msg).data,
        })
