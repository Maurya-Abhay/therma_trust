import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bell, BriefcaseBusiness, CalendarDays, ClipboardCheck, FileBadge, IdCard, ListChecks, Plus, Settings, ShieldCheck, Tags, UserRound, Wrench } from 'lucide-react-native';
import { format } from 'date-fns';
import { fetchCredentials, fetchJobs, fetchMyTechnicianProfile, fetchNotifications, fetchOnboarding } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { NotificationHeaderAction } from '@/src/components/technician/NotificationHeaderAction';
import { useTheme } from '@/src/theme/ThemeProvider';
import { IconBadge, Pill, PortalHero, Row, Section, State, Stat, Surface, toneFor } from '@/src/components/ui/kit';

const QUICK_ACTIONS = [
  { label: 'My jobs', Icon: BriefcaseBusiness, path: '/app/technician/jobs' },
  { label: 'Calendar', Icon: CalendarDays, path: '/app/technician/calendar' },
  { label: 'Add credential', Icon: Plus, path: '/app/technician/credentials/create' },
  { label: 'Credentials', Icon: FileBadge, path: '/app/technician/credentials' },
  { label: 'Passport', Icon: IdCard, path: '/app/technician/passport' },
  { label: 'Declare skill', Icon: Plus, path: '/app/technician/capabilities/create' },
  { label: 'Skills', Icon: Tags, path: '/app/technician/capabilities' },
  { label: 'Assessments', Icon: ClipboardCheck, path: '/app/technician/assessments' },
  { label: 'Work history', Icon: Wrench, path: '/app/technician/work-history' },
  { label: 'Setup checklist', Icon: ListChecks, path: '/app/shared/onboarding' },
  { label: 'Notifications', Icon: Bell, path: '/app/technician/notifications' },
  { label: 'My profile', Icon: UserRound, path: '/app/technician/profile' },
  { label: 'Settings', Icon: Settings, path: '/app/technician/settings' },
] as const;

const QUICK_ACTION_ROWS = [
  QUICK_ACTIONS.slice(0, 5),
  QUICK_ACTIONS.slice(5, 10),
  QUICK_ACTIONS.slice(10, 15),
];

export default function TechnicianHome() {
  const router = useRouter();
  const { t } = useTheme();
  const go = (path: string) => () => router.push(path as any);
  const me = useQuery({ queryKey: ['my-technician'], queryFn: fetchMyTechnicianProfile, staleTime: 60000 });
  const jobs = useQuery({ queryKey: ['technician-jobs'], queryFn: () => fetchJobs({ technician: 'me' }), staleTime: 30000 });
  const credentials = useQuery({
    queryKey: ['my-credentials', me.data?.id],
    queryFn: () => fetchCredentials(me.data!.id),
    enabled: !!me.data?.id,
    staleTime: 60000,
  });
  const onboarding = useQuery({
    queryKey: ['onboarding', me.data?.id],
    queryFn: fetchOnboarding,
    enabled: !!me.data?.id,
    staleTime: 60000,
  });
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30000,
  });

  const jobList = jobs.data ?? [];
  const credentialList = credentials.data ?? [];
  const openJobs = jobList.filter((job) => !/complete|closed|cancel/i.test(job.status));
  const verifiedCredentials = credentialList.filter((credential) =>
    ['verified', 'platform_verified', 'issuer_confirmed', 'document_verified'].includes(credential.effective_status) &&
    (!credential.expiry_date || new Date(credential.expiry_date).getTime() >= Date.now())
  ).length;
  const allCredentialsVerified = credentialList.length > 0 && verifiedCredentials === credentialList.length;
  const firstName = me.data?.full_name?.trim().split(/\s+/)[0];
  const onboardingData = onboarding.data;
  const nextStep = onboardingData?.steps.find((step) => !step.done);
  const onboardingPercent = onboardingData && onboardingData.total > 0
    ? Math.round((onboardingData.completed / onboardingData.total) * 100)
    : null;
  const recentActivity = [
    ...jobList.map((job) => ({
      id: `job-${job.id}`,
      title: `Job ${job.status.replace(/_/g, ' ')}`,
      subtitle: `${job.equipment_name} · ${job.facility_name}`,
      date: job.created_at,
      Icon: BriefcaseBusiness,
    })),
    ...credentialList.map((credential) => ({
      id: `credential-${credential.id}`,
      title: `Credential added: ${credential.name}`,
      subtitle: `${credential.issuer_name} · ${credential.effective_status.replace(/_/g, ' ')}`,
      date: credential.created_at,
      Icon: FileBadge,
    })),
    ...(notifications.data?.results ?? []).map((notification) => ({
      id: `notification-${notification.id}`,
      title: notification.title,
      subtitle: notification.body,
      date: notification.created_at,
      Icon: Bell,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <ScreenContainer
      headerTitle="Technician Home"
      headerRightAction={<NotificationHeaderAction />}
      showBrand
      contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
    >
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <PortalHero
          eyebrow="TECHNICIAN PORTAL"
          title={firstName ? `Welcome, ${firstName}` : 'Your dashboard'}
          subtitle={me.data?.contractor_name || 'Jobs, credentials, and your profile at a glance.'}
          Icon={IdCard}
        />
        {onboardingData && onboardingPercent !== null && onboardingPercent < 100 ? (
          <Surface style={{ marginTop: 12, padding: 13 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
                <ListChecks size={21} color={t.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>Profile setup {onboardingPercent}% complete</Text>
                <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>
                  {nextStep ? `Recommended next: ${nextStep.title}` : 'Finish your onboarding to unlock the full portal.'}
                </Text>
              </View>
              <Pressable onPress={go('/app/shared/onboarding')} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: t.primary }}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Continue</Text>
              </Pressable>
            </View>
            <View style={{ height: 5, borderRadius: 4, backgroundColor: t.field, overflow: 'hidden', marginTop: 11 }}>
              <View style={{ width: `${onboardingPercent}%`, height: '100%', backgroundColor: t.primary }} />
            </View>
          </Surface>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Stat Icon={BriefcaseBusiness} value={openJobs.length} label="Open jobs" tone="warn" />
          <Stat Icon={FileBadge} value={`${verifiedCredentials}/${credentialList.length}`} label="Verified" tone="ok" />
          <Stat Icon={ShieldCheck} value={me.data?.average_rating ? me.data.average_rating.toFixed(1) : '—'} label="Rating" tone="info" />
        </View>

        <Section title="Quick actions" />
        <Surface style={{ paddingVertical: 14, paddingHorizontal: 8 }}>
          <View style={{ gap: 12 }}>
            {QUICK_ACTION_ROWS.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {row.map(({ label, Icon, path }) => (
                  <Pressable
                    key={path}
                    accessibilityRole="button"
                    onPress={go(path)}
                    style={({ pressed }) => ({ width: '19%', flexShrink: 0, alignItems: 'center', gap: 4, opacity: pressed ? 0.75 : 1 })}
                  >
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={22} color={t.primary} strokeWidth={2.2} />
                    </View>
                    <Text numberOfLines={2} style={{ width: '100%', minHeight: 26, color: t.text, fontSize: 10.5, fontWeight: '700', lineHeight: 13, textAlign: 'center' }}>{label}</Text>
                  </Pressable>
                ))}
                {Array.from({ length: 5 - row.length }, (_, index) => (
                  <View key={`empty-${rowIndex}-${index}`} style={{ width: '19%' }} />
                ))}
              </View>
            ))}
          </View>
        </Surface>

        <Section title="My jobs" action="View all" onAction={go('jobs')} />
        <Surface style={{ paddingVertical: 0 }}>
          {jobs.isLoading ? <State loading /> : jobs.isError && !jobList.length ? <State error onRetry={() => { void jobs.refetch(); }} /> : openJobs.length === 0 ? <State empty="No active jobs right now." /> :
            openJobs.slice(0, 3).map((job, index, list) => (
              <Row
                key={job.id}
                Icon={BriefcaseBusiness}
                title={job.equipment_name}
                sub={`${job.facility_name}${job.scheduled_for ? ` · ${format(new Date(job.scheduled_for), 'd MMM, h:mm a')}` : ''}`}
                right={<Pill text={job.status} tone={toneFor(job.status)} />}
                onPress={go(`jobs/${job.id}`)}
                last={index === list.length - 1}
              />
            ))}
        </Surface>

        <Section title="Recent activity" />
        <Surface style={{ paddingVertical: 0 }}>
          {jobs.isLoading || credentials.isLoading || notifications.isLoading ? <State loading /> : recentActivity.length === 0 ? <State empty="Your recent job, credential, and notification activity will appear here." /> :
            recentActivity.map((activity, index, list) => (
              <Row
                key={activity.id}
                Icon={activity.Icon}
                title={activity.title}
                sub={`${activity.subtitle} · ${format(new Date(activity.date), 'd MMM, h:mm a')}`}
                last={index === list.length - 1}
              />
            ))}
        </Surface>

        <Section title="Credential status" action="Manage" onAction={go('credentials')} />
        <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBadge Icon={ShieldCheck} tone={allCredentialsVerified ? 'ok' : 'primary'} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 13 }}>
              {allCredentialsVerified ? 'All credentials verified' : credentialList.length ? `${credentialList.length - verifiedCredentials} need attention` : 'Add your first credential'}
            </Text>
            <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>{credentialList.length} credential{credentialList.length === 1 ? '' : 's'} on your profile</Text>
          </View>
          <Pill text={credentialList.length ? `${verifiedCredentials}/${credentialList.length}` : '0'} tone={allCredentialsVerified ? 'ok' : 'warn'} />
        </Surface>

        {me.isError ? <View style={{ marginTop: 12 }}><State error onRetry={() => { void me.refetch(); }} /></View> : null}
        {credentials.isError && credentialList.length === 0 ? <View style={{ marginTop: 12 }}><State error onRetry={() => { void credentials.refetch(); }} /></View> : null}

      </ScrollView>
    </ScreenContainer>
  );
}
