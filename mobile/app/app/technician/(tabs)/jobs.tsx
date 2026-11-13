import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Building2, BriefcaseBusiness, CalendarClock, Clock3, Wrench } from 'lucide-react-native';
import { format } from 'date-fns';
import { fetchJobs } from '@/src/api/endpoints';
import { JobRequest } from '@/src/types/api';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { NotificationHeaderAction } from '@/src/components/technician/NotificationHeaderAction';
import { StatusChip, RiskChip } from '@/src/components/ui/Chip';
import { IconBadge, Pill, PortalHero, Section, State, Stat, Surface, toneFor } from '@/src/components/ui/kit';
import { useTheme } from '@/src/theme/ThemeProvider';

type JobFilter = 'all' | 'open' | 'closed';

const FILTERS: { label: string; value: JobFilter }[] = [
  { label: 'All jobs', value: 'all' },
  { label: 'Active', value: 'open' },
  { label: 'Closed', value: 'closed' },
];

export default function TechnicianJobsScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [filter, setFilter] = useState<JobFilter>('all');
  const {
    data: jobs = [],
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['technician-jobs'],
    queryFn: () => fetchJobs({ technician: 'me' }),
    staleTime: 30000,
  });

  const isClosed = (status: string) => /complete|closed|cancel/i.test(status);
  const openCount = jobs.filter((job) => !isClosed(job.status)).length;
  const closedCount = jobs.filter((job) => isClosed(job.status)).length;
  const filtered = jobs.filter((job) => filter === 'all' || (filter === 'closed' ? isClosed(job.status) : !isClosed(job.status)));
  const showLoadError = isError && jobs.length === 0;

  const renderJob = ({ item }: { item: JobRequest }) => (
    <Surface
      onPress={() => router.push(`/app/technician/jobs/${item.id}` as any)}
      style={{ marginHorizontal: 18, marginBottom: 10, padding: 14 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBadge Icon={Wrench} size={42} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{item.equipment_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Building2 size={13} color={t.sub} />
            <Text numberOfLines={1} style={{ flex: 1, color: t.sub, fontSize: 11 }}>{item.facility_name}</Text>
          </View>
        </View>
        <RiskChip risk={item.risk_level} size="sm" />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.line }}>
        <StatusChip status={item.status} size="sm" />
        <Pill text={item.urgency} tone={toneFor(item.urgency)} />
        {item.assignment ? <Pill text="Assigned to you" tone="ok" /> : null}
      </View>
      {item.scheduled_for ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <CalendarClock size={14} color={t.sub} />
          <Text style={{ color: t.sub, fontSize: 11 }}>{format(new Date(item.scheduled_for), 'd MMM yyyy, h:mm a')}</Text>
        </View>
      ) : null}
    </Surface>
  );

  return (
    <ScreenContainer
      headerTitle="Jobs"
      showBack={false}
      showBrand
      headerRightAction={<NotificationHeaderAction />}
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <FlatList
        data={filtered}
        renderItem={renderJob}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            tintColor={t.primary}
            colors={[t.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <PortalHero
              eyebrow="MY WORK"
              title="Jobs"
              subtitle="Track assignments, timing, and service priorities."
              Icon={BriefcaseBusiness}
            />
            {isLoading || showLoadError ? (
              <View style={{ marginTop: 16 }}><State loading={isLoading} error={showLoadError} onRetry={() => { void refetch(); }} /></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                  <Stat Icon={BriefcaseBusiness} value={jobs.length} label="Total" />
                  <Stat Icon={Clock3} value={openCount} label="Active" tone="warn" />
                  <Stat Icon={CalendarClock} value={closedCount} label="Closed" tone="ok" />
                </View>
                <Section title="My assignments" action={`${filtered.length} jobs`} />
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 12 }}>
                  {FILTERS.map((item) => {
                    const active = filter === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setFilter(item.value)}
                        style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? t.primary : t.line, backgroundColor: active ? t.primary : t.card }}
                      >
                        <Text style={{ color: active ? '#FFFFFF' : t.sub, fontSize: 11, fontWeight: '700' }}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !showLoadError ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 38 }}>
              <IconBadge Icon={BriefcaseBusiness} size={54} />
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '800', marginTop: 12 }}>
                {filter === 'all' ? 'No jobs assigned yet' : `No ${filter === 'open' ? 'active' : 'closed'} jobs`}
              </Text>
              <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 5 }}>
                New assignments will appear here.
              </Text>
            </View>
          ) : undefined
        }
      />
    </ScreenContainer>
  );
}
