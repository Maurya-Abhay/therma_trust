import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Mail } from 'lucide-react-native';
import { requestPasswordReset } from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { AuthScreenFrame } from '@/src/components/auth/AuthScreenFrame';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useTheme } from '@/src/theme/ThemeProvider';

interface FormData {
  email: string;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ email }: FormData) => requestPasswordReset(email.trim().toLowerCase()),
  });

  return (
    <AuthScreenFrame
      title="Reset your password"
      subtitle="Enter your registered email address and we will send instructions to reset your password."
      eyebrow="ACCOUNT RECOVERY"
      heroIcon={<Mail size={27} color={t.primary} />}
    >
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          rules={{
            required: 'Email is required.',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
          }}
          render={({ field }) => (
            <Input
              label="Work email"
              placeholder="you@company.com"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              leftIcon={<Mail size={18} color={t.sub} />}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              error={errors.email?.message}
              containerStyle={styles.input}
            />
          )}
        />

        <Button
          fullWidth
          loading={mutation.isPending}
          disabled={mutation.isPending}
          onPress={() => { void handleSubmit((values) => mutation.mutate(values))(); }}
          style={styles.submitButton}
        >
          Send reset instructions
        </Button>

        {mutation.isSuccess ? (
          <View style={[styles.result, { backgroundColor: t.okBg }]}>
            <CheckCircle2 size={20} color={t.ok} />
            <Text style={{ flex: 1, color: t.text, fontSize: 12, lineHeight: 18 }}>
              {mutation.data.detail || 'If the account exists, reset instructions have been sent.'}
            </Text>
          </View>
        ) : null}
        {mutation.isError ? (
          <Text style={{ color: t.bad, fontSize: 12, marginTop: 12 }}>
            {getApiErrorMessage(mutation.error, 'Could not submit the reset request. Please try again later.')}
          </Text>
        ) : null}

        <View style={[styles.backSection, { borderTopColor: t.line }]}>
          <TouchableOpacity onPress={() => router.replace('/auth/login')} style={styles.backButton}>
            <Text style={{ color: t.primary, fontSize: 13, fontWeight: '700' }}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthScreenFrame>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%' },
  input: { marginBottom: 17 },
  submitButton: { minHeight: 54, borderRadius: 16 },
  result: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 13, marginTop: 14 },
  backSection: { alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  backButton: { paddingVertical: 5, paddingHorizontal: 10 },
});
