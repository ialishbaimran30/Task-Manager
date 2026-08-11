from django.shortcuts import render,redirect,get_object_or_404
from django.contrib.auth.decorators import login_required
from django.db import models
from django.contrib.auth.models import User
from .models import Task,Category,Notification,SubTask,TeamGroup, GroupMember, GroupTask, GroupSubTask
from .forms import TaskForm
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import Taskserializer,CategorySerializer,NotificationSerializer,SubTaskSerializer
from rest_framework.viewsets import ModelViewSet
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets
from rest_framework.decorators import action
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from .serializers import TeamGroupSerializer, GroupTaskSerializer, GroupSubTaskSerializer,GroupMemberSerializer
from rest_framework.exceptions import PermissionDenied
from datetime import date
# Create your views here.
@login_required
def add_task(request):
    if  request.method == "POST":
        form = TaskForm(request.POST)
        if form.is_valid():
            task = form.save(commit= False)
            task.user = request.user
            task.save()
            form.save_m2m()
            return redirect("dashboard")
    else:
        form = TaskForm()
        return render(request,"tasks/add_task.html",{"form":form})

    
@login_required
def task_list(request):
     
    search=request.GET.get("search")
    status =request.GET.get("status")
    priority=request.GET.get("priority")
    category = request.GET.get("category")

    tasks= Task.objects.filter(user=request.user)
    if search:
        tasks=tasks.filter(title__icontains=search)
    if status:
        tasks=tasks.filter(status=status)
    if priority:
        tasks = tasks.filter(priority=priority)

    if category:
        tasks = tasks.filter(category_id=category)
    categories= Category.objects.all()
    return render(request,"tasks/task_list.html",{"tasks":tasks,"categories":categories})
    

@login_required
def edit_task(request,id):
    task =get_object_or_404(Task, id=id,user=request.user)
    if request.method== "POST":
        form = TaskForm(request.POST,instance =task)
        if form.is_valid():
            form.save()

            return redirect("task_list")
    
    else:
        form = TaskForm(instance=task)
    return render(request,"tasks/add_task.html",{"form":form})
@login_required
def delete_task(request,id):
    task =get_object_or_404(Task,id=id,user = request.user)
    task.delete()
    return redirect("task_list")

class TaskViewSet(ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = Taskserializer
    permission_classes=[IsAuthenticated]
    
    def get_queryset(self):
        queryset = Task.objects.filter(user=self.request.user).order_by('id')
        filter_type = self.request.query_params.get('filter_type', None)
        selected_date = self.request.query_params.get('due_date', None)

        if filter_type == 'today':
            queryset = queryset.filter(due_date=date.today())
        elif filter_type == 'upcoming':
            queryset = queryset.filter(due_date__gt=date.today())
        elif selected_date:
            queryset = queryset.filter(due_date=selected_date)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SubTaskViewSet(ModelViewSet):
    serializer_class = SubTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SubTask.objects.filter(task__user=self.request.user)

    def perform_create(self, serializer):
        task_id = self.request.data.get('task')
        task = get_object_or_404(Task, id=task_id, user=self.request.user)
        serializer.save(task=task)

    def perform_update(self, serializer):
        subtask = serializer.save()
        parent_task = subtask.task
        all_subtasks = parent_task.subtasks.all().order_by("id")
        if all_subtasks.exists():
            completed_count = all_subtasks.filter(is_completed=True).count()
            total_count = all_subtasks.count()

            if completed_count == total_count:
                parent_task.status = "Completed"
            elif completed_count > 0:
                parent_task.status = "In Progress"
            else:
                parent_task.status = "Pending"
            parent_task.save()

class CategoryViewSet(ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationViewSet(ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({"status": "ok"})

    @action(detail=False, methods=['post'])
    def clear_all(self, request):
        Notification.objects.filter(user=request.user).delete()
        return Response({"message": "All notifications cleared successfully."})


class TeamGroupViewSet(ModelViewSet):
    serializer_class = TeamGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return TeamGroup.objects.filter(
            models.Q(created_by=user) | models.Q(members__user=user, members__status="Accepted")
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def invite_member(self, request, pk=None):
        group = self.get_object()
        if group.created_by != request.user:
            return Response({"error": "Only group owner can send invites."}, status=403)
        
        username = request.data.get("username")
        try:
            invited_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"error": "User does not exist."}, status=404)

        if invited_user == request.user:
            return Response({"error": "You cannot invite yourself."}, status=400)

        member, created = GroupMember.objects.get_or_create(
            group=group, 
            user=invited_user,
            defaults={"invited_by": request.user, "status": "Pending"}
        )
        
        if not created:
            return Response({"error": "Invitation already sent to this user."}, status=400)

       
        member.invited_by = request.user
        member.status = "Pending"
        member.save()

        Notification.objects.create(
            user=invited_user,
            message=f"You have been invited to join group '{group.name}' by {request.user.username}."
        )
        return Response({"message": f"Invitation sent to {username}."})
    
    @action(detail=False, methods=["get"])
    def my_invitations(self, request):
        invites = GroupMember.objects.filter(user=request.user, status="Pending")
        serializer = GroupMemberSerializer(invites, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def respond_invite(self, request):
        invite_id = request.data.get("invite_id")
        action_type = request.data.get("action")  
        
        invite = get_object_or_404(GroupMember, id=invite_id, user=request.user)
        if action_type == "accept":
            invite.status = "Accepted"
            invite.save()
            return Response({"message": "Invitation accepted!"})
        elif action_type == "reject":
            invite.status = "Rejected"
            invite.delete()
            return Response({"message": "Invitation rejected."})
        return Response({"error": "Invalid action."}, status=400)

   
    @action(detail=True, methods=["post"])
    def leave_group(self, request, pk=None):
        group = self.get_object()
        
        if group.created_by == request.user:
            return Response(
                {"error": "Owners cannot leave their own group. Delete the group instead."},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = GroupMember.objects.filter(group=group, user=request.user).first()
        if membership:
            membership.delete()
            return Response({"message": "Successfully left the group."}, status=status.HTTP_200_OK)

        return Response({"error": "You are not an active member of this group."}, status=status.HTTP_400_BAD_REQUEST)


class GroupTaskViewSet(ModelViewSet):
    queryset = GroupTask.objects.all()
    serializer_class = GroupTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return GroupTask.objects.filter(
            models.Q(group__created_by=user) | models.Q(group__members__user=user, group__members__status="Accepted")
        ).distinct().order_by('id')

    def destroy(self, request, *args, **kwargs):
        task = self.get_object()
        if task.group.created_by != request.user:
            return Response({"error": "Only the group owner can delete tasks."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


    def partial_update(self, request, *args, **kwargs):
        task = self.get_object()
        is_owner = task.group.created_by == request.user
        is_assigned = task.assignees.filter(id=request.user.id).exists()

        if not (is_owner or is_assigned):
            return Response({"error": "You don't have permission to update this task status."}, status=status.HTTP_403_FORBIDDEN)

        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        group_id = self.request.data.get("group")
        group = get_object_or_404(TeamGroup, id=group_id)
        
        if group.created_by != self.request.user:
            raise PermissionDenied("Only the group owner can create and assign tasks.")

        serializer.save(created_by=self.request.user, group=group)

from rest_framework.decorators import api_view, permission_classes
from .models import GroupTask, Task
from .serializers import GroupTaskSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_task_to_group(request):
    task_id = request.data.get('task_id')
    group_id = request.data.get('group_id')
    
    group = get_object_or_404(TeamGroup, id=group_id)
    
    if group.created_by != request.user:
        return Response({"error": "Only group owner can import tasks."}, status=status.HTTP_403_FORBIDDEN)
        
    personal_task = get_object_or_404(Task, id=task_id, user=request.user)
    
    group_task = GroupTask.objects.create(
        group=group,
        created_by=request.user,
        title=personal_task.title,
        description=personal_task.description,
        status="Pending"
    )
     
    for st in personal_task.subtasks.all():
        GroupSubTask.objects.create(
            group_task=group_task,
            title=st.title,
            is_completed=False
        )
        
    serializer = GroupTaskSerializer(group_task)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


class GroupSubTaskViewSet(ModelViewSet):
    serializer_class = GroupSubTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return GroupSubTask.objects.all()

    def perform_update(self, serializer):
        subtask = self.get_object()
        group_task = subtask.group_task
        user = self.request.user

        is_subtask_assignee = subtask.assigned_to == user
        is_owner = group_task.group.created_by == user

        if not (is_subtask_assignee or is_owner):
            raise PermissionDenied("Only assign user can checkmark the task.")

        updated_subtask = serializer.save()

        all_subtasks = group_task.subtasks.all()
        if all_subtasks.exists():
            completed_count = all_subtasks.filter(is_completed=True).count()
            total_count = all_subtasks.count()
            
            if completed_count == total_count:
                group_task.status = "Completed"
            elif completed_count > 0:
                group_task.status = "In Progress"
            else:
                group_task.status = "Pending"
            group_task.save()

