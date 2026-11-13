import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Building2, BriefcaseBusiness, CalendarDays, ClipboardList, Wrench, Snowflake } from 'lucide-react-native';
import { format } from 'date-fns';
import { fetchEquipment, fetchFacilities, fetchJobs } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeProvider';
import { CircularActionTile, Grid, IconBadge, Pill, PortalHero, Row, Section, State, Stat, Surface, toneFor } from '@/src/components/ui/kit';
import { Button } from '@/src/components/ui/Button';

const ACTIVE = ['open', 'assigned', 'in_progress'];

export default function FacilityDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTheme();
  const go = (p: string) => () => router.push(`/app/facility-manager/${p}` as any);
  const fac = useQuery({ queryKey: ['facilities'], queryFn: fetchFacilities, staleTime: 30000 });
  const eq = useQuery({ queryKey: ['equipment'], queryFn: () => fetchEquipment(), staleTime: 30000 });
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: () => fetchJobs(), staleTime: 30000 });
  const active = (jobs.data ?? []).filter((j) => ACTIVE.includes(j.status.toLowerCase()));
  const upcoming = (jobs.data ?? [])
    .filter((job) => {
      if (!job.scheduled_for || !ACTIVE.includes(job.status.toLowerCase())) return false;
      const scheduledTime = new Date(job.scheduled_for).getTime();
      return Number.isFinite(scheduledTime) && scheduledTime >= Date.now();
    })
    .sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime());
  const loading = fac.isLoading || eq.isLoading || jobs.isLoading;
  const hasError = fac.isError || eq.isError || jobs.isError;
  const first = fac.data?.[0];
  const retry = () => { void Promise.all([fac.refetch(), eq.refetch(), jobs.refetch()]); };

  return (
    <ScreenContainer headerTitle={`Hello, ${user?.first_name ?? ''}`} headerSubtitle="Facility operations" contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <PortalHero
          eyebrow="FACILITY PORTAL"
          title={`Welcome, ${user?.first_name || 'back'}`}
          subtitle="Facilities, equipment, and maintenance in one view."
          Icon={Building2}
        />
        {loading ? <State loading /> : hasError ? <State error onRetry={retry} /> : (
          <>
            <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 14 }}>
              <IconBadge Icon={Building2} size={44} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={{ color: t.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>{first ? 'YOUR FACILITY' : 'GET STARTED'}</Text>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '800' }}>{first?.name ?? 'Add your first facility'}</Text>
              </View>
              <Button size="sm" variant="primary" onPress={first ? go(`facilities/${first.id}`) : go('facilities/create')}>{first ? 'View' : 'Add'}</Button>
            </Surface>
            <Section title="Overview" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat Icon={Building2} value={fac.data?.length ?? 0} label="Facilities" />
              <Stat Icon={Wrench} value={eq.data?.length ?? 0} label="Equipment" tone="info" />
              <Stat Icon={BriefcaseBusiness} value={active.length} label="Active jobs" tone="warn" />
            </View>
            <Section title="Upcoming jobs" action="View all" onAction={go('jobs')} />
            <Surface style={{ paddingVertical: 0 }}>
              {upcoming.length === 0 ? <Text style={{ color: t.sub, padding: 16, textAlign: 'center' }}>No upcoming work is scheduled.</Text> :
                upcoming.slice(0, 3).map((j, i, a) => (
                  <Row key={j.id} Icon={BriefcaseBusiness} title={j.equipment_name} sub={`${j.facility_name}${j.scheduled_for ? ' · ' + format(new Date(j.scheduled_for), 'd MMM, h:mm a') : ''}`}
                    right={<Pill text={j.urgency} tone={toneFor(j.urgency)} />} onPress={go(`jobs/${j.id}`)} last={i === a.length - 1} />
                ))}
            </Surface>
            <Section title="Quick actions" />
            <Grid>
              <CircularActionTile Icon={BriefcaseBusiness} label="Create job" onPress={go('jobs/create')} />
              <CircularActionTile Icon={ClipboardList} label="Equipment list" onPress={go('equipment')} />
              <CircularActionTile Icon={Wrench} label="Add equipment" onPress={go('equipment/create')} />
              <CircularActionTile Icon={CalendarDays} label="Calendar" onPress={go('calendar')} />
              <CircularActionTile Icon={Snowflake} label="Refrigerant" onPress={go('refrigerant-dashboard')} />
              <CircularActionTile Icon={Building2} label="Facilities" onPress={go('facilities')} />
            </Grid>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
