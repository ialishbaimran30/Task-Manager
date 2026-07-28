from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics,status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework_simplejwt.views import (TokenObtainPairView,)
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (RegisterSerializer,UserSerializer,ChangePasswordSerializer,)
# Create your views here.

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "success": True,
                "message": "User registered successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    def put(self, request):
        serializer = UserSerializer(request.user,data=request.data,partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors,status=status.HTTP_400_BAD_REQUEST)
    
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(
            serializer.validated_data["old_password"]
        ):
            return Response(
                {
                    "error": "Old password is incorrect"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(
            serializer.validated_data["new_password"]
        )
        user.save()
        return Response(
            {
                "message": "Password updated successfully"
            }
        )
    
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {
                    "message": "Logged out successfully"
                }
            )
        except Exception:
            return Response(
                {
                    "error": "Invalid token"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )