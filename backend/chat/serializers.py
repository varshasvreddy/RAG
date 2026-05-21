from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ('id', 'role', 'content', 'sources', 'created_at')
        read_only_fields = ('id', 'created_at')


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    document_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )
    website_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Conversation
        fields = ('id', 'title', 'documents', 'websites', 'document_ids', 'website_ids', 'messages', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    document_titles = serializers.SerializerMethodField()
    website_titles = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ('id', 'title', 'message_count', 'document_titles', 'website_titles', 'created_at', 'updated_at')

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_document_titles(self, obj):
        return list(obj.documents.values_list('title', flat=True))

    def get_website_titles(self, obj):
        return list(obj.websites.values_list('title', flat=True))


class ChatQuerySerializer(serializers.Serializer):
    message = serializers.CharField(max_length=5000)
    document_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )
    website_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )
