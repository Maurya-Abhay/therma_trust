import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, BadgeCheck, Building2, CalendarDays, Cylinder, FileCheck2, History, Bell, IdCard, ListChecks, LogOut, Moon, Search, ShieldCheck, Snowflake, Sun, Smartphone, Tags, UserRound, Wrench, ClipboardCheck, LucideIcon } from 'lucide-react-native';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { NotificationHeaderAction } from '@/src/components/technician/NotificationHeaderAction';
import { Pill, Row, Section, Surface } from '@/src/components/ui/kit';
import { Button } from '@/src/components/ui/Button';
import { useAuth } from '@/src/auth/AuthContext';
import { ThemeMode, useTheme } from '@/src/theme/ThemeProvider';

type Link = { title: string; sub: string; Icon: LucideIcon; to: string };
const A = '/app/';

const LINKS: Record<string, Link[]> = {
  admin: [
    { title: 'Credential reviews', sub: 'Review technician credentials', Icon: FileCheck2, to: A + 'admin/credentials-review' },
    { title: 'Company verification', sub: 'Review contractor registrations', Icon: Building2, to: A + 'admin/contractor-verifications-review' },
    { title: 'Skills review', sub: 'Submitted technical capabilities', Icon: BadgeCheck, to: A + 'admin/capabilities-review' },
    { title: 'Company documents', sub: 'Licences and compliance evidence', Icon: Archive, to: A + 'admin/contractor-docs-review' },
    { title: 'Audit integrity', sub: 'Verify platform activity history', Icon: ShieldCheck, to: A + 'admin/audit-verify' },
  ],
  facility_manager: [
    { title: 'Facilities', sub: 'Manage your sites and equipment locations', Icon: Building2, to: A + 'facility-manager/facilities' },
    { title: 'Job requests', sub: 'Track maintenance and technician assignments', Icon: ClipboardCheck, to: A + 'facility-manager/jobs' },
    { title: 'Equipment', sub: 'Assets across your facilities', Icon: Wrench, to: A + 'facility-manager/equipment' },
    { title: 'Maintenance calendar', sub: 'Plan upcoming work', Icon: CalendarDays, to: A + 'facility-manager/calendar' },
    { title: 'Refrigerant insights', sub: 'Usage, leaks and compliance', Icon: Snowflake, to: A + 'facility-manager/refrigerant-dashboard' },
    { title: 'Notifications', sub: 'Job updates and account activity', Icon: Bell, to: A + 'shared/notifications' },
  ],
  contractor_manager: [
    { title: 'Team capabilities', sub: 'Review technician skills', Icon: Tags, to: A + 'contractor/capabilities' },
    { title: 'Team calendar', sub: 'Upcoming company jobs', Icon: CalendarDays, to: A + 'contractor/calendar' },
    { title: 'Cylinders', sub: 'Refrigerant cylinder log', Icon: Cylinder, to: A + 'contractor/cylinders' },
    { title: 'Company compliance', sub: 'Verification and evidence status', Icon: ShieldCheck, to: A + 'contractor/compliance' },
  ],
  technician: [
    { title: 'My profile', sub: 'Details and availability', Icon: UserRound, to: A + 'technician/profile' },
    { title: 'Skills', sub: 'Your capabilities', Icon: Tags, to: A + 'technician/capabilities' },
    { title: 'Calendar', sub: 'Upcoming assigned jobs', Icon: CalendarDays, to: A + 'technician/calendar' },
    { title: 'Passport', sub: 'Shareable verified profile', Icon: IdCard, to: A + 'technician/passport' },
    { title: 'Work history', sub: 'Completed jobs', Icon: History, to: A + 'technician/work-history' },
    { title: 'Assessments', sub: 'Knowledge checks', Icon: ListChecks, to: A + 'technician/assessments' },
    { title: 'Notifications', sub: 'Recent alerts', Icon: Bell, to: A + 'technician/notifications' },
  ],
};

const MODES: { id: ThemeMode; label: string; Icon: LucideIcon }[] = [
  { id: 'system', label: 'System', Icon: Smartphone },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

export default function SettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, logout } = useAuth();
  const { t, mode, setMode, isDark } = useTheme();
  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  const emailName = user?.email
    ?.split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const name = fullName || emailName || user?.role?.replace(/_/g, ' ') || 'Account';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const links = LINKS[user?.role ?? ''] ?? [];
  const selectedModeText = isDark ? '#062A28' : '#FFFFFF';

  const signOut = () =>
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { try { await logout(); qc.clear(); } catch { Alert.alert('Error', 'Unable to sign out. Try again.'); } } },
    ]);

  return (
    <ScreenContainer
      headerTitle="Settings"
      headerSubtitle="Account, appearance and more"
      showBack={false}
      showBrand={user?.role === 'technician' ? true : undefined}
      headerRightAction={user?.role === 'technician' || user?.role === 'facility_manager' ? <NotificationHeaderAction /> : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <Surface style={{ minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.primary, fontSize: 17, fontWeight: '800' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{name}</Text>
            <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12 }}>{user?.email || 'Email unavailable'}</Text>
          </View>
          <Pill text={user?.role ?? 'user'} tone="primary" />
        </Surface>

        <Section title="Appearance" />
        <Surface style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
          {MODES.map(({ id, label, Icon }) => {
            const on = mode === id;
            return (
              <Pressable key={id} onPress={() => setMode(id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: on ? t.primary : 'transparent' }}>
                <Icon size={20} color={on ? selectedModeText : t.sub} />
                <Text style={{ color: on ? selectedModeText : t.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            );
          })}
        </Surface>

        {links.length ? (
          <>
            <Section title={user?.role === 'admin' ? 'Admin tools' : 'More'} />
            <Surface style={{ paddingVertical: 0 }}>
              {links.map((l, i) => <Row key={l.to} Icon={l.Icon} title={l.title} sub={l.sub} onPress={() => router.push(l.to as any)} last={i === links.length - 1} />)}
            </Surface>
          </>
        ) : null}

        <Section title="General" />
        <Surface style={{ paddingVertical: 0 }}>
          <Row Icon={Search} title="Search" sub="Find equipment, jobs and people" onPress={() => router.push('/app/shared/search' as any)} last={user?.role === 'admin'} />
          {user?.role !== 'admin' ? (
            <Row Icon={ClipboardCheck} title="Setup checklist" sub="Finish your account setup" onPress={() => router.push('/app/shared/onboarding' as any)} last />
          ) : null}
        </Surface>

        <View style={{ marginTop: 22 }}>
          <Button variant="danger" fullWidth leftIcon={<LogOut size={18} color="#FFFFFF" />} onPress={signOut}>Sign out</Button>
          <Text style={{ color: t.sub, fontSize: 12, textAlign: 'center', marginTop: 14 }}>ThermaTrust v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
