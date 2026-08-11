from rest_framework import serializers
from .models import Task,Category,Notification,SubTask,TeamGroup, GroupMember, GroupTask, GroupSubTask,GroupInvitation
from django.contrib.auth.models import User

class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]

class SubTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubTask
        fields = ["id", "task", "title", "is_completed", "created_at"]
        read_only_fields = ["task"]

class Taskserializer(serializers.ModelSerializer):
    subtasks = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = Task
        fields= ["id", "user", "title", "description", "due_date","due_time","priority", "status", "category", "create_at","subtasks","progress", ]
        read_only_fields=["user","create_at"]

    def get_subtasks(self, obj):
        subtasks_qs = obj.subtasks.all().order_by("id") # Ensures stable, unchanging sequence
        return SubTaskSerializer(subtasks_qs, many=True).data

    def get_progress(self, obj):
        subtasks = obj.subtasks.all()
        if subtasks.exists():
            total = subtasks.count()
            completed = subtasks.filter(is_completed=True).count()
            return round((completed / total) * 100)
        return {"Pending": 0, "In Progress": 50, "Completed": 100}.get(obj.status, 0)

    def create(self, validated_data):
        
        request = self.context.get('request')
        subtasks_data = request.data.get('subtasks', []) if request else []
        
        task = Task.objects.create(**validated_data)
        for st in subtasks_data:
            if isinstance(st, dict) and st.get('title'):
                SubTask.objects.create(task=task, title=st['title'], is_completed=st.get('is_completed', False))
            elif isinstance(st, str) and st.strip():
                SubTask.objects.create(task=task, title=st.strip())
        return task

    def update(self, instance, validated_data):
        request = self.context.get('request')
        subtasks_data = request.data.get('subtasks', None) if request else None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if subtasks_data is not None:
            instance.subtasks.all().delete()
            for st in subtasks_data:
                if isinstance(st, dict) and st.get('title'):
                    SubTask.objects.create(task=instance, title=st['title'], is_completed=st.get('is_completed', False))
        return instance
 
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"
        read_only_fields=["user"]



class GroupSubTaskSerializer(serializers.ModelSerializer):
    assigned_to_details = UserMinimalSerializer(source="assigned_to", read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    class Meta:
        model = GroupSubTask
        fields = ["id", "group_task", "title", "is_completed","assigned_to", "assigned_to_details"]
        read_only_fields = ["group_task"]

class GroupTaskSerializer(serializers.ModelSerializer):
    assignees_details = UserMinimalSerializer(source="assignees", many=True, read_only=True)
    assignees = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), many=True, write_only=True)
    subtasks = GroupSubTaskSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = GroupTask
        fields = ["id", "group", "created_by", "assignees", "assignees_details", "title", "description", "status", "subtasks","progress", "created_at"]
        read_only_fields = ["created_by", "created_at"]

    def get_progress(self, obj):
        subtasks = obj.subtasks.all()
        if subtasks.exists():
            completed = subtasks.filter(is_completed=True).count()
            return round((completed / subtasks.count()) * 100)
        return {"Pending": 0, "In Progress": 50, "Completed": 100}.get(obj.status, 0)

    def create(self, validated_data):
        assignees = validated_data.pop('assignees', [])
        request = self.context.get('request')
        subtasks_data = request.data.get('subtasks', []) if request else []

        group_task = GroupTask.objects.create(**validated_data)
        group_task.assignees.set(assignees)

        for st in subtasks_data:
            if isinstance(st, dict) and st.get('title'):
                assigned_user_id = st.get('assigned_to')
                GroupSubTask.objects.create(group_task=group_task, title=st['title'], is_completed=st.get('is_completed', False),assigned_to_id=assigned_user_id if assigned_user_id else None)
            elif isinstance(st, str) and st.strip():
                GroupSubTask.objects.create(group_task=group_task, title=st.strip())

        return group_task

class GroupMemberSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    invited_by_username = serializers.CharField(source='invited_by.username', read_only=True)
    user_details = UserMinimalSerializer(source="user", read_only=True)

    class Meta:
        model = GroupMember
        fields = ["id", "group",'group_name', "user","user_details", "invited_by", "invited_by_username", "status"]

class TeamGroupSerializer(serializers.ModelSerializer):
    created_by_details = UserMinimalSerializer(source="created_by", read_only=True)
    members = GroupMemberSerializer(many=True, read_only=True)
    tasks = GroupTaskSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = TeamGroup
        fields = ["id", "name", "description", "created_by", "created_by_details", "members", "tasks", "progress", "created_at"]
        read_only_fields = ["created_by", "created_at"]

    def get_progress(self, obj):
        tasks = obj.tasks.all()
        if not tasks.exists():
            return 0
        completed = tasks.filter(status="Completed").count()
        return round((completed / tasks.count()) * 100)


class GroupInviteSerializer(serializers.ModelSerializer):
    invited_by_username = serializers.CharField(source='invited_by.username', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model = GroupInvitation 
        fields = '__all__'
    
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ["user"]

