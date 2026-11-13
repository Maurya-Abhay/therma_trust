import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react-native';
import { createFacility } from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { SelectField } from '@/src/components/ui/SelectField';
import { PortalHero, Surface } from '@/src/components/ui/kit';
import { useToast } from '@/src/components/ui/Toast';
import { useTheme } from '@/src/theme/ThemeProvider';

const SEGMENTS = [
  { value: 'cold_storage', label: 'Cold storage' },
  { value: 'supermarket_refrigeration', label: 'Supermarket refrigeration' },
  { value: 'other', label: 'Other' },
];

type FacilityForm = {
  name: string;
  segment: string;
  address: string;
  service_area: string;
  contact_name: string;
  contact_phone: string;
};

const EMPTY_FORM: FacilityForm = {
  name: '',
  segment: 'cold_storage',
  address: '',
  service_area: '',
  contact_name: '',
  contact_phone: '',
};

export default function CreateFacilityScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { t } = useTheme();
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FacilityForm, string>>>({});

  const createMutation = useMutation({
    mutationFn: () => createFacility({
      name: form.name.trim(),
      segment: form.segment,
      address: form.address.trim(),
      service_area: form.service_area.trim(),
      contact_name: form.contact_name.trim(),
      contact_phone: form.contact_phone.trim(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['facilities'] });
      show('Facility created successfully.', 'success');
      router.back();
    },
  });

  const update = <K extends keyof FacilityForm>(key: K, value: FacilityForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = () => {
    const nextErrors: Partial<Record<keyof FacilityForm, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Facility name is required.';
    if (!form.address.trim()) nextErrors.address = 'Address is required.';
    if (!form.service_area.trim()) nextErrors.service_area = 'Service area is required.';
    if (form.contact_phone.trim() && !/^[+()\d\s.-]{7,25}$/.test(form.contact_phone.trim())) {
      nextErrors.contact_phone = 'Enter a valid contact phone number.';
    }
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) createMutation.mutate();
  };

  return (
    <ScreenContainer headerTitle="Add facility" headerSubtitle="Register a site you manage">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PortalHero eyebrow="FACILITY SETUP" title="Add a facility" subtitle="Create the site profile before registering equipment or raising jobs." Icon={Building2} />
          <Surface style={{ gap: 14 }}>
            <Input label="Facility name *" value={form.name} onChangeText={(value) => update('name', value)} placeholder="e.g. Main Hospital Building" error={errors.name} autoCapitalize="words" />
            <SelectField label="Segment *" placeholder="Choose a facility segment" value={form.segment} options={SEGMENTS} onChange={(value) => update('segment', value)} />
            <Input label="Address *" value={form.address} onChangeText={(value) => update('address', value)} placeholder="Full site address" error={errors.address} multiline numberOfLines={3} />
            <Input label="Service area *" value={form.service_area} onChangeText={(value) => update('service_area', value)} placeholder="e.g. Downtown, North District" error={errors.service_area} />
            <Input label="Contact name" value={form.contact_name} onChangeText={(value) => update('contact_name', value)} placeholder="Primary site contact" autoCapitalize="words" />
            <Input label="Contact phone" value={form.contact_phone} onChangeText={(value) => update('contact_phone', value)} placeholder="Optional" keyboardType="phone-pad" error={errors.contact_phone} />
            {createMutation.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>{getApiErrorMessage(createMutation.error, 'Could not create facility. Please try again.')}</Text> : null}
            <Button loading={createMutation.isPending} disabled={createMutation.isPending} onPress={submit}>Create facility</Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
