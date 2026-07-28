from django.db import models
from django.contrib.auth.models import User
# Create your models here.
class Category(models.Model):
    user = models.ForeignKey(User, on_delete= models.SET_NULL, null =True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name
    
# class Tag(models.Model):
#     user = models.ForeignKey(User, on_delete=models.SET_NULL, null = True)
#     name= models.CharField(max_length=50)

    def __str__(self):
        return self.name
    
class Task(models.Model):
      PRIORITY_CHOICES = [
        ("Low", "Low"),
        ("Medium", "Medium"),
        ("High", "High"),
    ]
      STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("In Progress","In Progress"),
        ("Completed", "Completed"),
    ]
      
      user = models.ForeignKey(User,on_delete=models.CASCADE)
      title = models.CharField(max_length=200)
      description = models.TextField()
      due_date = models.DateField()
      priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES,default="Medium")
      due_time = models.TimeField(null=True, blank=True)          
      deadline_notified = models.BooleanField(default=False) 

      status = models.CharField(
    max_length=20,
    choices=STATUS_CHOICES,
    default="Pending")
      


      category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE
    )

      # tags = models.ManyToManyField(Tag)
      create_at = models.DateTimeField(auto_now_add=True)

      def __str__(self):
          return self.title

class SubTask(models.Model):
    task = models.ForeignKey(Task, related_name="subtasks", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.task.title} - {self.title}"
      
class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True)
    message = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return self.message

class TeamGroup(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_groups")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class GroupMember(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Accepted", "Accepted"),
        ("Rejected", "Rejected"),
    ]
    group = models.ForeignKey(TeamGroup, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="group_invitations")
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='sent_group_invites')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    invited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")

    def __str__(self):
        return f"{self.user.username} - {self.group.name} ({self.status})"

class GroupInvitation(models.Model):
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Accepted', 'Accepted'),
        ('Rejected', 'Rejected'),
    )

    group = models.ForeignKey(TeamGroup, on_delete=models.CASCADE, related_name='invitations')
    invited_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_invitations')
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invitations', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invite to {self.invited_user.username} for {self.group.name}"
    
class GroupTask(models.Model):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("In Progress", "In Progress"),
        ("Completed", "Completed"),
    ]
    group = models.ForeignKey(TeamGroup, on_delete=models.CASCADE, related_name="tasks")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_group_tasks")
    assignees = models.ManyToManyField(User, related_name="assigned_group_tasks")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.group.name} - {self.title}"

# Check karein agar aapke models.py me yeh model missing hai to isko add karein:

class GroupSubTask(models.Model):
    group_task = models.ForeignKey(GroupTask, related_name="subtasks", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    is_completed = models.BooleanField(default=False)
    # Konsa member iss individual subtask par kaam kar raha hai
    assigned_to = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="assigned_subtasks"
    )

    def __str__(self):
        assigned_name = self.assigned_to.username if self.assigned_to else "Unassigned"
        return f"{self.title} ({assigned_name})"