from django.urls import path,include
from . import views
from accounts.views import (
    RegisterAPIView,
    GoogleLoginAPIView,
    OTPRequestAPIView,
    OTPVerifyAPIView,
    MeAPIView,
)
urlpatterns =[
    path("", views.home,name="home"),

    # path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view,name="logout"),
    path("dashboard/",views.dashboard,name="dashboard"),
    path("tasks/", include("tasks.urls")),
    path("register/", RegisterAPIView.as_view(), name="register"),
    path("api/auth/google/", GoogleLoginAPIView.as_view(), name="google_login"),
    path("api/auth/otp/request/", OTPRequestAPIView.as_view(), name="otp_request"),
    path("api/auth/otp/verify/", OTPVerifyAPIView.as_view(), name="otp_verify"),
    path("api/auth/me/", MeAPIView.as_view(), name="me"),

]