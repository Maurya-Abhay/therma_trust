from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, permissions, status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .serializers import RegisterSerializer, UserSerializer
from .services import send_password_reset_email


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Accounts created before emails were normalised may be stored with capitals, and
        # people type their address in whatever case their keyboard gives them. Resolve the
        # stored address case-insensitively (preferring an exact-case match) and then let the
        # normal credential check run against it, so a wrong password still fails the same way.
        typed = str(attrs.get(self.username_field, "")).strip()
        password = attrs.get("password", "")
        if typed:
            candidates = User.objects.filter(email__iexact=typed, is_active=True).order_by("id")
            matches = [user for user in candidates if user.check_password(password)]
            if matches:
                matches.sort(key=lambda user: user.email != typed)
                attrs[self.username_field] = matches[0].email

        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]


class PasswordResetRequestView(APIView):
    """Always answers the same way so the endpoint cannot be used to find out
    which emails have accounts."""

    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        email = str(request.data.get("email", "")).strip()
        user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
        if user:
            send_password_reset_email(user)
        return Response({"detail": "If that email has an account, a reset link is on its way."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        uid = str(request.data.get("uid", ""))
        token = str(request.data.get("token", ""))
        password = str(request.data.get("password", ""))

        user = None
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None

        if user is None or not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "This reset link is invalid or has expired. Request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(password, user)
        except ValidationError as exc:
            return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated. You can sign in now."})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
