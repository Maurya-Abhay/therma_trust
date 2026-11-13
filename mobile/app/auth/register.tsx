import React, { useState } from 'react';
import { StyleSheet, Text, TextInputProps, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react-native';
import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomePath } from '@/src/auth/roleRoute';
import { AuthScreenFrame } from '@/src/components/auth/AuthScreenFrame';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useToast } from '@/src/components/ui/Toast';
import type { SelfRegisterRole } from '@/src/types/api';

type FormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  role: SelfRegisterRole;
};
type InputField = Exclude<keyof FormData, 'role'>;
type InputOptions = {
  keyboardType?: TextInputProps['keyboardType'];
  secure?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

const roleOptions: { value: SelfRegisterRole; label: string; description: string }[] = [
  { value: 'technician', label: 'Technician', description: 'Manage credentials and field work' },
  { value: 'facility_manager', label: 'Facility Manager', description: 'Manage facilities and service jobs' },
  { value: 'contractor_manager', label: 'Contractor Manager', description: 'Manage your company and team' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useTheme();
  const { show } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    mode: 'onTouched',
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      confirm: '',
      role: 'technician',
    },
  });
  const role = watch('role');

  const mutation = useMutation({
    mutationFn: (values: FormData) => register({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      phone: values.phone.trim() || undefined,
      role: values.role,
    }),
    onSuccess: (user) => {
      show(`Welcome to ThermaTrust, ${user.first_name}!`, 'success');
      router.replace(getRoleHomePath(user.role));
    },
    onError: (error: unknown) => show(getApiErrorMessage(error, 'Registration failed. Check your details and try again.'), 'error'),
  });

  const renderInput = (field: InputField, label: string, placeholder: string, options: InputOptions = {}) => (
    <Controller<FormData, InputField>
      control={control}
      name={field}
      rules={{
        required: field === 'phone' ? false : 'This field is required.',
        ...(field === 'first_name' || field === 'last_name'
          ? { validate: (value) => Boolean(value.trim()) || 'This field is required.' }
          : {}),
        ...(field === 'email'
          ? { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' } }
          : {}),
        ...(field === 'password'
          ? { minLength: { value: 8, message: 'Use at least 8 characters.' } }
          : {}),
        ...(field === 'confirm'
          ? { validate: (value) => value === watch('password') || 'Passwords do not match.' }
          : {}),
      }}
      render={({ field: input }) => (
        <Input
          label={label}
          placeholder={placeholder}
          value={input.value ?? ''}
          onChangeText={input.onChange}
          onBlur={input.onBlur}
          leftIcon={options.icon}
          rightIcon={options.rightIcon}
          secureTextEntry={options.secure}
          keyboardType={options.keyboardType ?? 'default'}
          autoCapitalize={options.autoCapitalize ?? 'words'}
          autoComplete={options.autoComplete}
          error={errors[field]?.message}
          containerStyle={styles.input}
        />
      )}
    />
  );

  const passwordIcon = (visible: boolean, toggle: () => void, label: string) => (
    <TouchableOpacity onPress={toggle} accessibilityRole="button" accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`} style={styles.eyeButton}>
      {visible ? <EyeOff size={18} color={t.sub} /> : <Eye size={18} color={t.sub} />}
    </TouchableOpacity>
  );

  return (
    <AuthScreenFrame
      eyebrow="CREATE ACCOUNT"
      title="Create your account"
      subtitle="Set up your profile to access the right ThermaTrust workspace."
    >
      <>
        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            {renderInput('first_name', 'First name', 'First name', { icon: <UserRound size={17} color={t.sub} /> })}
          </View>
          <View style={styles.nameField}>
            {renderInput('last_name', 'Last name', 'Last name', { icon: <UserRound size={17} color={t.sub} /> })}
          </View>
        </View>

        {renderInput('email', 'Work email', 'you@company.com', {
          keyboardType: 'email-address',
          autoCapitalize: 'none',
          autoComplete: 'email',
          icon: <Mail size={17} color={t.sub} />,
        })}
        {renderInput('phone', 'Phone number (optional)', 'Enter phone number', {
          keyboardType: 'phone-pad',
          autoCapitalize: 'none',
          icon: <Phone size={17} color={t.sub} />,
        })}
        {renderInput('password', 'Password', 'Create a password', {
          secure: !showPassword,
          autoCapitalize: 'none',
          autoComplete: 'new-password',
          icon: <LockKeyhole size={17} color={t.sub} />,
          rightIcon: passwordIcon(showPassword, () => setShowPassword((value) => !value), 'password'),
        })}
        {renderInput('confirm', 'Confirm password', 'Re-enter your password', {
          secure: !showConfirm,
          autoCapitalize: 'none',
          autoComplete: 'new-password',
          icon: <LockKeyhole size={17} color={t.sub} />,
          rightIcon: passwordIcon(showConfirm, () => setShowConfirm((value) => !value), 'password'),
        })}

        <View style={styles.roleSection}>
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>Account type</Text>
          <Text style={{ color: t.sub, fontSize: 12, marginTop: 4, marginBottom: 12 }}>Choose the role that matches your work.</Text>
          <View style={styles.roleList}>
            {roleOptions.map((option) => {
              const selected = role === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setValue('role', option.value, { shouldValidate: true, shouldDirty: true })}
                  style={[
                    styles.roleOption,
                    { backgroundColor: selected ? t.tint : t.field, borderColor: selected ? t.primary : t.line },
                  ]}
                >
                  <View style={[styles.radio, { borderColor: selected ? t.primary : t.sub }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: t.primary }]} /> : null}
                  </View>
                  <View style={styles.roleCopy}>
                    <Text style={{ color: selected ? t.primary : t.text, fontSize: 13, fontWeight: '700' }}>{option.label}</Text>
                    <Text style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>{option.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Button
          fullWidth
          loading={mutation.isPending}
          disabled={mutation.isPending}
          onPress={() => { void handleSubmit((values) => mutation.mutate(values))(); }}
          style={styles.submitButton}
        >
          Create account
        </Button>

        <View style={styles.signInSection}>
          <Text style={{ color: t.sub, fontSize: 12 }}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')} style={styles.signInButton}>
            <Text style={{ color: t.primary, fontSize: 13, fontWeight: '800' }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </>
    </AuthScreenFrame>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', gap: 12 },
  nameField: { flex: 1, minWidth: 0 },
  input: { marginBottom: 13 },
  eyeButton: { padding: 8 },
  roleSection: { marginTop: 8, marginBottom: 18 },
  roleList: { gap: 9 },
  roleOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 13 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  roleCopy: { flex: 1, marginLeft: 12 },
  submitButton: { minHeight: 54, borderRadius: 16 },
  signInSection: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 },
  signInButton: { paddingVertical: 5, paddingHorizontal: 2 },
});
