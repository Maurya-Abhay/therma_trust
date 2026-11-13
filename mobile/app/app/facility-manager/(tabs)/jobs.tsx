import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { BriefcaseBusiness, Plus } from 'lucide-react-native';
import { format, isValid } from 'date-fns';
import { fetchChoices, fetchJobs } from '@/src/api/endpoints';
import type { JobRequest } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Chip, RiskChip, StatusChip } from '@/src/components/ui/Chip';
import { IconBadge, PortalHero, Section, State, Surface } from '@/src/components/ui/kit';
import { SelectField } from '@/src/components/ui/SelectField';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function FacilityManagerJobsScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const choicesQuery = useQuery({ queryKey: ['choices'], queryFn: fetchChoices, staleTime: 300_000 });
  const jobsQuery = useQuery({
    queryKey: ['fm-jobs'],
    queryFn: () => fetchJobs(),
    staleTime: 30_000,
  });
  const jobs = jobsQuery.data ?? [];
  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    ...(choicesQuery.data?.job_statuses ?? []),
  ];
  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const searchText = `${job.equipment_name} ${job.facility_name} ${job.description}`.toLowerCase();
    return matchesStatus && searchText.includes(search.trim().toLowerCase());
  });
  const refresh = () => { void jobsQuery.refetch(); };

  const renderJob = (job: JobRequest) => {
    const scheduledDate = job.scheduled_for ? new Date(job.scheduled_for) : null;
    return (
      <Surface key={job.id} onPress={() => router.push(`/app/facility-manager/jobs/${job.id}`)} style={{ marginBottom: 10, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBadge Icon={BriefcaseBusiness} size={42} tone="info" />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{job.equipment_name}</Text>
            <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11 }}>{job.facility_name}</Text>
          </View>
          <RiskChip risk={job.risk_level} size="sm" />
        </View>
        <Text numberOfLines={2} style={{ color: t.sub, fontSize: 12, lineHeight: 17, marginTop: 10 }}>{job.description}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
          <StatusChip status={job.status} size="sm" />
          <Chip size="sm">{job.urgency.replace(/_/g, ' ')}</Chip>
          {scheduledDate && isValid(scheduledDate) ? (
            <Text style={{ color: t.sub, fontSize: 11 }}>{format(scheduledDate, 'MMM d, yyyy · h:mm a')}</Text>
          ) : null}
          {job.assignment ? <Text style={{ color: t.primary, fontSize: 11, fontWeight: '700' }}>{job.assignment.technician_name}</Text> : null}
        </View>
      </Surface>
    );
  };

  if (jobsQuery.isLoading) return <ScreenContainer headerTitle="Jobs"><State loading /></ScreenContainer>;
  if (jobsQuery.isError) return <ScreenContainer headerTitle="Jobs"><State error onRetry={refresh} /></ScreenContainer>;

  return (
    <ScreenContainer headerTitle="Jobs" headerSubtitle={`${jobs.length} maintenance request${jobs.length === 1 ? '' : 's'}`}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={jobsQuery.isRefetching} onRefresh={refresh} tintColor={t.primary} />}
      >
        <PortalHero eyebrow="MAINTENANCE" title="Jobs" subtitle="Review requests, schedules, technician assignments, and service reports." Icon={BriefcaseBusiness} />
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 14 }}>
          <Button
            style={{ flex: 1 }}
            leftIcon={<Plus size={16} color="#FFFFFF" />}
            onPress={() => router.push('/app/facility-manager/jobs/create')}
          >
            Create job
          </Button>
          <Button variant="outline" onPress={() => router.push('/app/facility-manager/calendar')}>Calendar</Button>
        </View>
        <Section title="Filter requests" />
        <Surface style={{ gap: 12 }}>
          <Input label="Search" value={search} onChangeText={setSearch} placeholder="Equipment, facility, or work description" />
          <SelectField
            label="Status"
            placeholder="Choose a status"
            value={statusFilter}
            options={statusOptions}
            onChange={setStatusFilter}
            loading={choicesQuery.isLoading}
            error={choicesQuery.isError ? 'Job status options could not be loaded.' : undefined}
          />
        </Surface>
        <Section title="Maintenance requests" />
        {filteredJobs.length ? filteredJobs.map(renderJob) : (
          <Surface style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
            <State empty={jobs.length ? 'No jobs match these filters.' : 'No jobs yet. Create a request to get started.'} />
            {!jobs.length ? <Button onPress={() => router.push('/app/facility-manager/jobs/create')}>Create first job</Button> : null}
          </Surface>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
