import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench } from 'lucide-react-native';
import { createEquipment, fetchChoices, fetchFacilities, fetchRefrigerantTypes } from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { SelectField } from '@/src/components/ui/SelectField';
import { PortalHero, State, Surface } from '@/src/components/ui/kit';
import { useToast } from '@/src/components/ui/Toast';
import { useTheme } from '@/src/theme/ThemeProvider';

type EquipmentForm = {
  facility: string;
  name: string;
  category: string;
  refrigerant_type: string;
  capacity: string;
  refrigerant_charge_kg: string;
  criticality: string;
  install_date: string;
};

const EMPTY_FORM: EquipmentForm = {
  facility: '',
  name: '',
  category: '',
  refrigerant_type: '',
  capacity: '',
  refrigerant_charge_kg: '',
  criticality: 'medium',
  install_date: '',
};

export default function CreateEquipmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ facility?: string }>();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { t } = useTheme();
  const [form, setForm] = React.useState({ ...EMPTY_FORM, facility: params.facility ?? '' });
  const [formError, setFormError] = React.useState('');

  const facilitiesQuery = useQuery({ queryKey: ['facilities'], queryFn: fetchFacilities, staleTime: 60_000 });
  const choicesQuery = useQuery({ queryKey: ['choices'], queryFn: fetchChoices, staleTime: 300_000 });
  const refrigerantsQuery = useQuery({ queryKey: ['refrigerant-types'], queryFn: fetchRefrigerantTypes, staleTime: 300_000 });

  React.useEffect(() => {
    if (params.facility) setForm((current) => ({ ...current, facility: params.facility! }));
  }, [params.facility]);

  const createMutation = useMutation({
    mutationFn: () => createEquipment({
      facility: Number(form.facility),
      name: form.name.trim(),
      category: form.category,
      refrigerant_type: Number(form.refrigerant_type),
      capacity: form.capacity.trim(),
      refrigerant_charge_kg: form.refrigerant_charge_kg.trim() || null,
      criticality: form.criticality,
      install_date: form.install_date.trim() || null,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['equipment'] }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
      ]);
      show('Equipment registered successfully.', 'success');
      router.back();
    },
  });

  const update = (key: keyof EquipmentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };
  const facilities = facilitiesQuery.data ?? [];
  const choices = choicesQuery.data;
  const refrigerants = refrigerantsQuery.data ?? [];
  const formLoading = facilitiesQuery.isLoading || choicesQuery.isLoading || refrigerantsQuery.isLoading;
  const formErrorLoading = facilitiesQuery.isError || choicesQuery.isError || refrigerantsQuery.isError;

  const submit = () => {
    const charge = form.refrigerant_charge_kg.trim();
    if (!Number(form.facility) || !form.name.trim() || !form.category || !Number(form.refrigerant_type)) {
      setFormError('Choose a facility, name the equipment, and select its category and refrigerant.');
      return;
    }
    if (charge && (!Number.isFinite(Number(charge)) || Number(charge) < 0 || !/^\d+(\.\d{1,2})?$/.test(charge))) {
      setFormError('Refrigerant charge must be a non-negative number with up to 2 decimal places.');
      return;
    }
    if (form.install_date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.install_date.trim())) {
      setFormError('Install date must use YYYY-MM-DD format.');
      return;
    }
    setFormError('');
    createMutation.mutate();
  };

  if (facilitiesQuery.isLoading) return <ScreenContainer headerTitle="Add equipment"><State loading /></ScreenContainer>;
  if (facilitiesQuery.isError) return <ScreenContainer headerTitle="Add equipment"><State error onRetry={() => { void facilitiesQuery.refetch(); }} /></ScreenContainer>;
  if (!facilities.length) {
    return (
      <ScreenContainer headerTitle="Add equipment">
        <Surface style={{ alignItems: 'center', padding: 22, gap: 12 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>Add a facility first</Text>
          <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12, lineHeight: 18 }}>Every equipment unit must be attached to one of your facilities.</Text>
          <Button onPress={() => router.push('/app/facility-manager/facilities/create')}>Create facility</Button>
        </Surface>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer headerTitle="Add equipment" headerSubtitle="Register a unit at one of your facilities">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PortalHero eyebrow="EQUIPMENT SETUP" title="Register equipment" subtitle="Record the unit details used for maintenance, leak tracking and job matching." Icon={Wrench} />
          <Surface style={{ gap: 14 }}>
            <SelectField
              label="Facility *"
              placeholder="Choose a facility"
              value={form.facility}
              options={facilities.map((facility) => ({ value: String(facility.id), label: facility.name }))}
              onChange={(value) => update('facility', value)}
            />
            <Input label="Equipment name *" value={form.name} onChangeText={(value) => update('name', value)} placeholder="e.g. Chiller 1" />
            <SelectField
              label="Category *"
              placeholder="Choose equipment category"
              value={form.category}
              options={choices?.equipment_categories ?? []}
              onChange={(value) => update('category', value)}
              loading={choicesQuery.isLoading}
              error={choicesQuery.isError ? 'Equipment categories could not be loaded.' : undefined}
            />
            <SelectField
              label="Refrigerant *"
              placeholder="Choose refrigerant"
              value={form.refrigerant_type}
              options={refrigerants.map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }))}
              onChange={(value) => update('refrigerant_type', value)}
              loading={refrigerantsQuery.isLoading}
              error={refrigerantsQuery.isError ? 'Refrigerants could not be loaded.' : undefined}
            />
            <Input label="Capacity" value={form.capacity} onChangeText={(value) => update('capacity', value)} placeholder="e.g. 50 TR" />
            <Input
              label="Refrigerant charge (kg)"
              value={form.refrigerant_charge_kg}
              onChangeText={(value) => update('refrigerant_charge_kg', value)}
              placeholder="Optional, e.g. 150.5"
              keyboardType="decimal-pad"
              helperText="Used to estimate leak rate from service history."
            />
            <SelectField
              label="Criticality"
              placeholder="Choose criticality"
              value={form.criticality}
              options={choices?.criticalities ?? []}
              onChange={(value) => update('criticality', value)}
              loading={choicesQuery.isLoading}
              error={choicesQuery.isError ? 'Criticality options could not be loaded.' : undefined}
            />
            <Input label="Install date" value={form.install_date} onChangeText={(value) => update('install_date', value)} placeholder="YYYY-MM-DD (optional)" />
            {formError ? <Text style={{ color: t.bad, fontSize: 12 }}>{formError}</Text> : null}
            {createMutation.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>{getApiErrorMessage(createMutation.error, 'Could not register equipment. Please try again.')}</Text> : null}
            {formErrorLoading && !choicesQuery.isError && !refrigerantsQuery.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>Required form options could not be loaded.</Text> : null}
            <Button loading={createMutation.isPending || formLoading} disabled={createMutation.isPending || formLoading || formErrorLoading} onPress={submit}>Register equipment</Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
