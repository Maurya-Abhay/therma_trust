import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness } from 'lucide-react-native';
import { createJob, fetchChoices, fetchEquipment, fetchFacilities } from '@/src/api/endpoints';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { SelectField } from '@/src/components/ui/SelectField';
import { PortalHero, State, Surface } from '@/src/components/ui/kit';
import { useToast } from '@/src/components/ui/Toast';
import { useTheme } from '@/src/theme/ThemeProvider';

type JobForm = {
  facility: string;
  equipment: string;
  description: string;
  urgency: string;
  scheduled_for: string;
};

export default function CreateJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ facility?: string; equipment?: string }>();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const { t } = useTheme();
  const [form, setForm] = React.useState<JobForm>({
    facility: params.facility ?? '',
    equipment: params.equipment ?? '',
    description: '',
    urgency: 'scheduled',
    scheduled_for: '',
  });
  const [formError, setFormError] = React.useState('');

  const facilitiesQuery = useQuery({ queryKey: ['facilities'], queryFn: fetchFacilities, staleTime: 60_000 });
  const choicesQuery = useQuery({ queryKey: ['choices'], queryFn: fetchChoices, staleTime: 300_000 });
  React.useEffect(() => {
    if (params.facility) {
      setForm((current) => ({ ...current, facility: params.facility!, equipment: params.equipment ?? '' }));
    }
  }, [params.equipment, params.facility]);

  const equipmentQuery = useQuery({
    queryKey: ['facility-equipment', form.facility],
    queryFn: () => fetchEquipment(Number(form.facility)),
    enabled: Boolean(form.facility),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const scheduledDate = form.scheduled_for.trim() ? new Date(form.scheduled_for.trim()) : null;
      return createJob({
        facility: Number(form.facility),
        equipment: Number(form.equipment),
        description: form.description.trim(),
        urgency: form.urgency,
        scheduled_for: scheduledDate ? scheduledDate.toISOString() : null,
      });
    },
    onSuccess: async (job) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['fm-jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['job-calendar'] }),
      ]);
      show('Job request created.', 'success');
      router.replace({ pathname: '/app/facility-manager/jobs/[id]', params: { id: String(job.id) } });
    },
  });

  const update = (key: keyof JobForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };
  const facilities = facilitiesQuery.data ?? [];
  const equipment = equipmentQuery.data ?? [];
  const urgencyOptions = choicesQuery.data?.urgencies ?? [];

  const submit = () => {
    if (!Number(form.facility) || !Number(form.equipment) || !form.description.trim() || !form.urgency) {
      setFormError('Choose a facility, equipment and urgency, then describe the work needed.');
      return;
    }
    if (form.scheduled_for.trim() && Number.isNaN(new Date(form.scheduled_for.trim()).getTime())) {
      setFormError('Enter a valid planned date and time, such as 2026-11-13T14:30.');
      return;
    }
    setFormError('');
    createMutation.mutate();
  };

  if (facilitiesQuery.isLoading) return <ScreenContainer headerTitle="New job request"><State loading /></ScreenContainer>;
  if (facilitiesQuery.isError) return <ScreenContainer headerTitle="New job request"><State error onRetry={() => { void facilitiesQuery.refetch(); }} /></ScreenContainer>;
  if (!facilities.length) {
    return (
      <ScreenContainer headerTitle="New job request">
        <Surface style={{ alignItems: 'center', padding: 22, gap: 12 }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>Add a facility first</Text>
          <Text style={{ color: t.sub, textAlign: 'center', fontSize: 12 }}>A job request must be linked to equipment at one of your facilities.</Text>
          <Button onPress={() => router.push('/app/facility-manager/facilities/create')}>Create facility</Button>
        </Surface>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer headerTitle="New job request" headerSubtitle="Describe the issue or maintenance needed">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PortalHero eyebrow="MAINTENANCE" title="Request a job" subtitle="The platform assesses risk and finds technicians with matching qualifications." Icon={BriefcaseBusiness} />
          <Surface style={{ gap: 14 }}>
            <SelectField
              label="Facility *"
              placeholder="Choose a facility"
              value={form.facility}
              options={facilities.map((facility) => ({ value: String(facility.id), label: facility.name }))}
              onChange={(value) => setForm((current) => ({ ...current, facility: value, equipment: '' }))}
            />
            <SelectField
              label="Equipment *"
              placeholder={form.facility ? 'Choose equipment' : 'Choose a facility first'}
              value={form.equipment}
              options={equipment.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.category_display}` }))}
              onChange={(value) => update('equipment', value)}
              disabled={!form.facility}
              loading={equipmentQuery.isLoading}
              error={equipmentQuery.isError ? 'Equipment could not be loaded.' : undefined}
            />
            {equipmentQuery.isSuccess && form.facility && equipment.length === 0 ? (
              <Text style={{ color: t.sub, fontSize: 12 }}>No equipment is registered at this facility yet. Add equipment before requesting a job.</Text>
            ) : null}
            <SelectField
              label="Urgency *"
              placeholder="Choose urgency"
              value={form.urgency}
              options={urgencyOptions}
              onChange={(value) => update('urgency', value)}
              loading={choicesQuery.isLoading}
              error={choicesQuery.isError ? 'Urgency options could not be loaded.' : undefined}
            />
            <Input
              label="Description *"
              value={form.description}
              onChangeText={(value) => update('description', value)}
              placeholder="Describe the fault or maintenance required"
              multiline
              numberOfLines={4}
            />
            <Input
              label="Planned date and time"
              value={form.scheduled_for}
              onChangeText={(value) => update('scheduled_for', value)}
              placeholder="YYYY-MM-DDTHH:mm (optional)"
              helperText="Scheduled jobs appear in your calendar."
            />
            {formError ? <Text style={{ color: t.bad, fontSize: 12 }}>{formError}</Text> : null}
            {createMutation.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>{getApiErrorMessage(createMutation.error, 'Could not create the job request. Please try again.')}</Text> : null}
            <Button
              loading={createMutation.isPending || choicesQuery.isLoading}
              disabled={createMutation.isPending || choicesQuery.isLoading || choicesQuery.isError}
              onPress={submit}
            >
              Submit job request
            </Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
