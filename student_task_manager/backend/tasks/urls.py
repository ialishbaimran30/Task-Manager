from django.urls import path,include
from . import views
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet,CategoryViewSet,NotificationViewSet,SubTaskViewSet,TeamGroupViewSet, GroupTaskViewSet, GroupSubTaskViewSet

router = DefaultRouter()
router.register("api", TaskViewSet, basename="tasks")
router.register("subtasks", SubTaskViewSet, basename="subtasks")
router.register("categories",CategoryViewSet)
router.register("notifications",NotificationViewSet, basename="notifications")

router.register("groups", TeamGroupViewSet, basename="groups")
router.register("group-tasks", GroupTaskViewSet, basename="group-tasks")
router.register("group-subtasks", GroupSubTaskViewSet, basename="group-subtasks")
urlpatterns=[
    path("add/",views.add_task,name = "add_task"),
    path("",views.task_list,name="task_list"),
    path("edit/<int:id>/",views.edit_task, name= "edit_task"),
    path ("delete/<int:id>/",views.delete_task,name="delete_task"),
    # path("api/", views.TaskViewSet.as_view({'get':'list','post': 'create','put': 'update','patch': 'partial_update','delete': 'destroy'}),)
    path("", include(router.urls)),
    
    
]