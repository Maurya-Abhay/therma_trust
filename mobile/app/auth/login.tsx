
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/src/auth/AuthContext";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { AuthScreenFrame } from "@/src/components/auth/AuthScreenFrame";
import { useToast } from "@/src/components/ui/Toast";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react-native";
import { getApiErrorMessage } from "@/src/api/errorMessage";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getRoleHomePath } from "@/src/auth/roleRoute";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const { show } = useToast();
  const { login } = useAuth();
  const { t } = useTheme();

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [showPassword, setShowPassword] = useState(false);

  const { mutate: loginMutate, isPending } = useMutation({
    mutationFn: (data: LoginForm) =>
      login(data.email.trim().toLowerCase(), data.password),

    onSuccess: (user) => {
      show(`Welcome back, ${user.first_name}!`, "success");
      router.replace(getRoleHomePath(user.role));
    },

    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, "Invalid email or password");

      setError("password", { message });
      show(message, "error");
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutate(data);
  };

  return (
    <AuthScreenFrame
      eyebrow="SIGN IN"
      title="Welcome back"
      subtitle="Sign in to access your ThermaTrust account."
    >
      <>
        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            rules={{
              required: "Email is required",
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email format",
              },
            }}
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                label="Work email"
                placeholder="you@company.com"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                leftIcon={<Mail size={18} color={t.sub} />}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email?.message}
                containerStyle={styles.input}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            rules={{
              required: "Password is required",
            }}
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                label="Password"
                placeholder="Enter your password"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                leftIcon={<LockKeyhole size={18} color={t.sub} />}
                secureTextEntry={!showPassword}
                autoComplete="password"
                error={errors.password?.message}
                rightIcon={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} color={t.sub} />
                    ) : (
                      <Eye size={19} color={t.sub} />
                    )}
                  </TouchableOpacity>
                }
                containerStyle={styles.input}
              />
            )}
          />

          <View style={styles.forgotRow}>
            <TouchableOpacity
              onPress={() => router.push("/auth/forgot-password")}
            >
              <Text style={[styles.forgotText, { color: t.primary }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>

          <Button
            fullWidth
            loading={isPending}
            onPress={() => { void handleSubmit(onSubmit)(); }}
            style={styles.submitButton}
          >
            Sign In
          </Button>
        </View>

        <View style={styles.registerSection}>
          <Text style={[styles.registerPrompt, { color: t.sub }]}>
            New to ThermaTrust?
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/auth/register")}
            style={styles.registerButton}
          >
            <Text style={[styles.registerText, { color: t.primary }]}>
              Create account
            </Text>
          </TouchableOpacity>
        </View>
      </>
    </AuthScreenFrame>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
  },

  input: {
    marginBottom: 15,
  },

  eyeButton: {
    padding: 8,
  },

  forgotRow: {
    alignItems: "flex-end",
    marginTop: -1,
    marginBottom: 17,
  },

  forgotText: {
    color: "#0D817C",
    fontSize: 13,
    fontWeight: "700",
  },

  submitButton: {
    minHeight: 54,
    borderRadius: 16,
  },

  registerSection: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 19,
  },

  registerPrompt: {
    color: "#6A8191",
    fontSize: 13,
  },

  registerButton: {
    paddingVertical: 5,
    paddingHorizontal: 2,
  },

  registerText: {
    color: "#0D817C",
    fontSize: 14,
    fontWeight: "700",
  },
});
