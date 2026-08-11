import logging
from django.shortcuts import render,redirect
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from tasks.models import Task
from rest_framework import generics
from .serializers import RegisterSerializer
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .google_auth import verify_google_token
from .models import GoogleProfile, OTP
from .serializers import GoogleAuthSerializer, MeSerializer
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.hashers import check_password
from .otp_utils import create_and_send_otp, seconds_until_resend_allowed
from .auth_utils import generate_unique_username, issue_tokens

logger = logging.getLogger(__name__)

# Create your views here.
def home(request):
    return render (request, "accounts/home.html")
@csrf_exempt
def register(request):
    if request.method =="POST": 
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("home")
    else:
        form = UserCreationForm()
    return render(request,"accounts/register.html",{"form":form})

def login_view(request):
    if request.method =="POST":
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user= form.get_user()
            login(request,user)
            return redirect("dashboard")
    else:
        form = AuthenticationForm()
    return render(request,"accounts/login.html",{"form":form})

@login_required
def dashboard(request):
    total_tasks= Task.objects.filter(user = request.user).count()
    pending_tasks= Task.objects.filter(user = request.user,status ="Pending").count()
    complete_tasks =Task.objects.filter(user=request.user , status ="Completed").count()
    total_notes= Task.objects.filter(user=request.user).count()
    context={"total_tasks":total_tasks,"pending_tasks":pending_tasks,"completed_tasks":complete_tasks,"total_nptes":total_notes}
    return render(request,"accounts/dashboard.html",context)

def logout_view(request):
    logout(request)
    return redirect("home")

class RegisterAPIView(generics.CreateAPIView):
    serializer_class=RegisterSerializer
    permission_classes=[AllowAny]




class GoogleLoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["id_token"]

        idinfo = verify_google_token(token)
        if idinfo is None:
            return Response({"error": "Invalid or expired Google token."}, status=status.HTTP_401_UNAUTHORIZED)

        if not idinfo.get("email_verified", False):
            return Response({"error": "Google email is not verified."}, status=status.HTTP_401_UNAUTHORIZED)

        email = idinfo["email"]
        google_id = idinfo["sub"]
        full_name = idinfo.get("name", "")
        picture = idinfo.get("picture", "")

        # 1. Existing Google user -> log in directly
        profile = GoogleProfile.objects.select_related("user").filter(google_id=google_id).first()

        if profile:
            user = profile.user
        else:
            # 2. Existing account with same email (e.g. old password account) -> link it
            user = User.objects.filter(email=email).first()
            if not user:
                # 3. Brand new user -> create with a unique username
                base_username = email.split("@")[0]
                username = base_username
                suffix = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{suffix}"
                    suffix += 1
                user = User.objects.create_user(username=username, email=email)
                if full_name:
                    user.first_name = full_name.split(" ")[0]
                    user.save(update_fields=["first_name"])

            GoogleProfile.objects.update_or_create(
                user=user,
                defaults={"google_id": google_id, "profile_picture": picture, "auth_provider": "google"},
            )

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "username": user.username,
            "email": user.email,
            "profile_picture": profile.profile_picture if profile else picture,
        }, status=status.HTTP_200_OK)


class OTPRequestAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        purpose = request.data.get("purpose")

        if purpose not in ("login", "signup") or not email:
            return Response({"error": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)

        user_exists = User.objects.filter(email=email).exists()
        if purpose == "login" and not user_exists:
            return Response(
                {"error": "No account found with this email. Please sign up."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if purpose == "signup" and user_exists:
            return Response(
                {"error": "An account already exists with this email. Please log in instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        wait = seconds_until_resend_allowed(email, purpose)
        if wait > 0:
            return Response(
                {"error": f"Please wait {wait}s before requesting another code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            create_and_send_otp(email, purpose)
        except Exception:
            logger.exception("Failed to send OTP email to %s", email)
            return Response({"error": "Failed to send email. Please try again."}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"message": "Verification code sent to your email."}, status=status.HTTP_200_OK)


class OTPVerifyAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        code = (request.data.get("code") or "").strip()
        purpose = request.data.get("purpose")

        otp = OTP.objects.filter(email=email, purpose=purpose, is_used=False).order_by("-created_at").first()
        if not otp:
            return Response(
                {"error": "No verification code found. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if otp.expires_at < timezone.now():
            return Response({"error": "Code expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
        if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
            return Response(
                {"error": "Too many incorrect attempts. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not check_password(code, otp.code_hash):
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            remaining = settings.OTP_MAX_ATTEMPTS - otp.attempts
            return Response(
                {"error": f"Incorrect code. {remaining} attempt(s) remaining."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp.is_used = True
        otp.save(update_fields=["is_used"])

        if purpose == "login":
            user = User.objects.filter(email=email).first()
            if not user:
                return Response(
                    {"error": "No account found with this email. Please sign up."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            username = generate_unique_username(email)
            user = User.objects.create_user(username=username, email=email)

        return Response(issue_tokens(user), status=status.HTTP_200_OK)


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"id": request.user.id, "username": request.user.username, "email": request.user.email})

    def patch(self, request):
        serializer = MeSerializer(data=request.data, context={"request": request}, partial=True)
        serializer.is_valid(raise_exception=True)
        request.user.username = serializer.validated_data["username"]
        request.user.save(update_fields=["username"])
        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
            "message": "Username updated successfully.",
        })