import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Activity, Archive, BadgeCheck, Building2, CheckCircle2, CircleAlert, ClipboardList, FileCheck2, History, Settings, ShieldCheck, Users } from 'lucide-react-native';
import { format } from 'date-fns';
import { fetchAdminDashboard } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Pill, PortalHero, Row, Section, State, Stat, Surface } from '@/src/components/ui/kit';

const QUICK_ACTIONS = [
  { label: 'Reviews', Icon: FileCheck2, to: '/app/admin/credentials-review', key: 'pending_credentials' },
  { label: 'Companies', Icon: Building2, to: '/app/admin/contractor-verifications-review', key: 'pending_contractor_verifications' },
  { label: 'Skills', Icon: BadgeCheck, to: '/app/admin/capabilities-review', key: 'pending_capabilities' },
  { label: 'Documents', Icon: Archive, to: '/app/admin/contractor-docs-review', key: 'pending_contractor_documents' },
  { label: 'Audit integrity', Icon: ShieldCheck, to: '/app/admin/audit-verify', key: null },
  { label: 'Settings', Icon: Settings, to: '/app/admin/settings', key: null },
] as const;

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTheme();
  const { data, dataUpdatedAt, isLoading, isError, isFetching, refetch } = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchAdminDashboard, staleTime: 30000 });
  const isHealthChecking = isLoading || isFetching;
  const isHealthUnavailable = isError || (!data && !isHealthChecking);
  const healthTone = isHealthUnavailable ? 'bad' : isHealthChecking ? 'info' : 'ok';
  const healthLabel = isHealthUnavailable ? 'Unavailable' : isHealthChecking ? 'Checking' : 'Online';
  const healthColor = healthTone === 'bad' ? t.bad : healthTone === 'info' ? t.info : t.ok;
  const healthBackground = healthTone === 'bad' ? t.badBg : healthTone === 'info' ? t.infoBg : t.okBg;
  const HealthIcon = healthTone === 'bad' ? CircleAlert : healthTone === 'info' ? Activity : CheckCircle2;

  return (
    <ScreenContainer headerTitle={`Hello, ${user?.first_name ?? 'Admin'}`} headerSubtitle="Here's your overview" contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <PortalHero
          eyebrow="ADMIN PORTAL"
          title={`Hello, ${user?.first_name || 'Admin'}`}
          subtitle="Platform activity, quick tools, and service status."
          Icon={ShieldCheck}
        />
        {isLoading || isError || !data ? <View style={{ marginTop: 18 }}><State loading={isLoading} error={isError} onRetry={refetch} /></View> : (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Stat Icon={Users} value={data.total_technicians} label="Technicians" />
            <Stat Icon={Building2} value={data.total_facilities} label="Facilities" tone="info" />
            <Stat Icon={ClipboardList} value={data.total_jobs} label="Jobs" tone="warn" />
          </View>
        )}
        <Section title="Quick Actions" />
        <Surface style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 }}>
            {QUICK_ACTIONS.map(({ label, Icon, to, key }) => {
              const count = key && data ? data[key] : undefined;
              return (
                <Pressable
                  key={to}
                  accessibilityRole="button"
                  onPress={() => router.push(to as any)}
                  style={{ width: '31%', alignItems: 'center', gap: 7 }}
                >
                  <View style={{ position: 'relative' }}>
                    <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={23} color={t.primary} strokeWidth={2.2} />
                    </View>
                    {count ? (
                      <View style={{ position: 'absolute', top: -3, right: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: t.warn, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{count > 99 ? '99+' : count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Surface>
        {data && !isLoading && !isError ? (
          <>
            <Section title="Recent activity" />
            <Surface style={{ paddingVertical: 0 }}>
              {data.recent_audit_log.length === 0 ? <Text style={{ color: t.sub, padding: 16, textAlign: 'center' }}>No recent activity to show</Text> :
                data.recent_audit_log.slice(0, 5).map((e, i, a) => (
                  <Row
                    key={e.id}
                    Icon={History}
                    title={e.action.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    sub={`${e.actor ?? 'System'} · ${format(new Date(e.created_at), 'd MMM, h:mm a')}`}
                    last={i === a.length - 1}
                  />
                ))}
            </Surface>
          </>
        ) : null}
        <Section title="System health" action={isHealthChecking ? 'Checking' : 'Check now'} onAction={() => { void refetch(); }} />
        <Surface style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ backgroundColor: healthBackground, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
                <HealthIcon size={25} color={healthColor} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={{ color: healthColor, fontSize: 9, fontWeight: '800', letterSpacing: 0.9 }}>SERVICE CONNECTION</Text>
                <Text style={{ color: t.text, fontSize: 15, fontWeight: '800' }}>Admin dashboard API</Text>
                <Text style={{ color: t.sub, fontSize: 12 }}>
                  {isHealthUnavailable ? 'Could not connect to the dashboard service.' : isHealthChecking ? 'Checking the dashboard service…' : 'Dashboard service is responding.'}
                </Text>
              </View>
              <Pill text={healthLabel} tone={healthTone} />
            </View>
          </View>
          <View style={{ minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: t.line }}>
            <Text style={{ color: t.sub, fontSize: 11, fontWeight: '600' }}>Last successful response</Text>
            <Text style={{ color: t.text, fontSize: 11, fontWeight: '700' }}>
              {dataUpdatedAt ? format(new Date(dataUpdatedAt), 'd MMM, h:mm a') : 'Not checked yet'}
            </Text>
          </View>
        </Surface>
      </ScrollView>
    </ScreenContainer>
  );
}
