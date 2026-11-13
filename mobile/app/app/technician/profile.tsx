import React from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { BadgeCheck, Bell, BriefcaseBusiness, ClipboardCheck, FileBadge, IdCard, MapPin, Settings, ShieldCheck, Tags } from 'lucide-react-native';
import { fetchCapabilities, fetchCredentials, fetchMe, fetchMyTechnicianProfile, fetchOnboarding, updateTechnicianProfile } from '@/src/api/endpoints';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { IconBadge, PortalHero, Row, Section, State, Stat, Surface } from '@/src/components/ui/kit';
import { StatusChip } from '@/src/components/ui/Chip';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { getApiErrorMessage } from '@/src/api/errorMessage';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function TechnicianProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTheme();
  const user = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const profile = useQuery({ queryKey: ['technician-profile'], queryFn: fetchMyTechnicianProfile, enabled: !!user.data });
  const onboarding = useQuery({
    queryKey: ['onboarding', user.data?.id],
    queryFn: fetchOnboarding,
    enabled: !!user.data,
    staleTime: 0,
  });
  const [serviceArea, setServiceArea] = React.useState('');
  const [yearsExperience, setYearsExperience] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [available, setAvailable] = React.useState(true);

  React.useEffect(() => {
    if (!profile.data) return;
    setServiceArea(profile.data.service_area ?? '');
    setYearsExperience(String(profile.data.years_experience ?? 0));
    setBio(profile.data.bio ?? '');
    setAvailable(profile.data.available);
  }, [profile.data]);

  const saveProfile = useMutation({
    mutationFn: () => updateTechnicianProfile(profile.data!.id, {
      service_area: serviceArea.trim(),
      years_experience: Number(yearsExperience),
      available,
      bio: bio.trim(),
    }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['technician-profile'], updated);
      queryClient.setQueryData(['my-technician-profile'], updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['technician-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['my-technician-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['public-verification', updated.public_token] }),
        queryClient.invalidateQueries({ queryKey: ['onboarding', user.data?.id] }),
      ]);
      Alert.alert('Profile saved', 'Your technician profile has been updated.');
    },
  });

  const technicianId = profile.data?.id;
  const credentials = useQuery({
    queryKey: ['credentials', technicianId],
    queryFn: () => fetchCredentials(technicianId!),
    enabled: !!technicianId,
    staleTime: 60000,
  });
  const capabilities = useQuery({
    queryKey: ['capabilities', technicianId],
    queryFn: () => fetchCapabilities(technicianId!),
    enabled: !!technicianId,
    staleTime: 60000,
  });

  const credentialList = credentials.data ?? [];
  const capabilityList = capabilities.data ?? [];
  const verifiedCredentials = credentialList.filter((item) => ['verified', 'platform_verified', 'issuer_confirmed', 'document_verified'].includes(item.effective_status)).length;
  const verifiedCapabilities = capabilityList.filter((item) => item.status === 'verified').length;
  const fullName = profile.data?.full_name || [user.data?.first_name, user.data?.last_name].filter(Boolean).join(' ') || 'Technician';
  const onboardingPercent = onboarding.data?.total
    ? Math.round((onboarding.data.completed / onboarding.data.total) * 100)
    : 0;

  const handleSaveProfile = () => {
    if (!/^\d+$/.test(yearsExperience.trim())) {
      Alert.alert('Check experience', 'Years of experience must be a whole number greater than or equal to zero.');
      return;
    }
    if (Number(yearsExperience) < 0) {
      Alert.alert('Check experience', 'Years of experience cannot be negative.');
      return;
    }
    if (serviceArea.trim().length > 120) {
      Alert.alert('Check service area', 'Service area must be 120 characters or fewer.');
      return;
    }
    saveProfile.mutate();
  };

  return (
    <ScreenContainer headerTitle="Profile" showProfile={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <PortalHero eyebrow="YOUR ACCOUNT" title={fullName} subtitle={profile.data?.contractor_name || user.data?.email || 'Technician profile and qualifications'} Icon={IdCard} />
        {user.isLoading || profile.isLoading ? (
          <View style={{ marginTop: 16 }}><State loading /></View>
        ) : user.isError || profile.isError || !profile.data ? (
          <View style={{ marginTop: 16 }}><State error onRetry={() => { void Promise.all([user.refetch(), profile.refetch()]); }} /></View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 14 }}>
              <Stat Icon={FileBadge} value={verifiedCredentials} label="Credentials" tone="ok" />
              <Stat Icon={Tags} value={verifiedCapabilities} label="Verified skills" tone="info" />
              <Stat Icon={ShieldCheck} value={profile.data.average_rating ? profile.data.average_rating.toFixed(1) : '—'} label="Rating" tone="warn" />
            </View>

            <Section title="Personal information" />
            <Surface style={{ gap: 13 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <IconBadge Icon={IdCard} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{fullName}</Text>
                  <Text style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>{user.data?.email || profile.data.email}</Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: t.line }} />
              <Input
                label="Service area (city/zone)"
                value={serviceArea}
                onChangeText={setServiceArea}
                maxLength={120}
                placeholder="Where you can take jobs"
                leftIcon={<MapPin size={15} color={t.sub} />}
              />
              <Input
                label="Years of experience"
                value={yearsExperience}
                onChangeText={setYearsExperience}
                keyboardType="number-pad"
                placeholder="0"
              />
              <Input
                label="Bio"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Tell clients about your experience"
                fieldStyle={{ minHeight: 100, alignItems: 'flex-start' }}
                inputStyle={{ minHeight: 96 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>Available for new jobs</Text>
                  <Text style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>{available ? 'You can receive new assignments' : 'You will not receive new assignments'}</Text>
                </View>
                <Switch value={available} onValueChange={setAvailable} trackColor={{ false: t.line, true: t.tint }} thumbColor={available ? t.primary : t.sub} />
              </View>
              {saveProfile.isError ? <Text style={{ color: t.bad, fontSize: 12 }}>{getApiErrorMessage(saveProfile.error, 'Could not save your profile. Please try again.')}</Text> : null}
              <Button fullWidth loading={saveProfile.isPending} onPress={handleSaveProfile}>Save profile</Button>
            </Surface>

            <Section title="Getting started" action="View checklist" onAction={() => router.push('/app/shared/onboarding' as any)} />
            <Surface onPress={() => router.push('/app/shared/onboarding' as any)} style={{ gap: 9 }}>
              {onboarding.isLoading ? <State loading /> : onboarding.isError ? (
                <Text style={{ color: t.bad, fontSize: 12 }}>Could not load your setup checklist. Tap to retry.</Text>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: t.text, fontSize: 13, fontWeight: '800' }}>Account setup</Text>
                    <Text style={{ color: t.primary, fontSize: 12, fontWeight: '800' }}>{onboarding.data?.completed ?? 0}/{onboarding.data?.total ?? 0}</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 99, overflow: 'hidden', backgroundColor: t.field }}>
                    <View style={{ width: `${onboardingPercent}%`, height: '100%', backgroundColor: t.primary }} />
                  </View>
                  <Text style={{ color: t.sub, fontSize: 11 }}>Tap to continue your onboarding steps.</Text>
                </>
              )}
            </Surface>

            <Section title="Credentials" action="View all" onAction={() => router.push('/app/technician/credentials' as any)} />
            <Surface style={{ paddingHorizontal: 14, paddingVertical: 0 }}>
              {credentials.isLoading ? <State loading /> : credentials.isError ? <State error onRetry={() => { void credentials.refetch(); }} /> : credentialList.length === 0 ? <State empty="No credentials added yet." /> : credentialList.slice(0, 3).map((item, index, list) => (
                <Row key={item.id} Icon={FileBadge} title={item.name} sub={item.issuer_name} right={<StatusChip status={item.effective_status} size="sm" />} onPress={() => router.push(`/app/technician/credentials/${item.id}` as any)} last={index === list.length - 1} />
              ))}
            </Surface>

            <Section title="Capabilities" action="View all" onAction={() => router.push('/app/technician/capabilities' as any)} />
            <Surface style={{ paddingHorizontal: 14, paddingVertical: 0 }}>
              {capabilities.isLoading ? <State loading /> : capabilities.isError ? <State error onRetry={() => { void capabilities.refetch(); }} /> : capabilityList.length === 0 ? <State empty="No capabilities recorded yet." /> : capabilityList.slice(0, 4).map((item, index, list) => (
                <Row key={item.id} Icon={Tags} title={item.label} sub={item.capability_type} right={<StatusChip status={item.status} size="sm" />} onPress={() => router.push(`/app/technician/capabilities/${item.id}` as any)} last={index === list.length - 1} />
              ))}
            </Surface>

            <Section title="Quick access" />
            <Surface style={{ paddingHorizontal: 14, paddingVertical: 0 }}>
              <Row Icon={BadgeCheck} title="Technician passport" sub="Shareable verification profile" onPress={() => router.push('/app/technician/passport' as any)} />
              <Row Icon={ClipboardCheck} title="Assessments" sub="Skills checks and learning" onPress={() => router.push('/app/technician/assessments' as any)} />
              <Row Icon={BriefcaseBusiness} title="Work history" sub="Completed service records" onPress={() => router.push('/app/technician/work-history' as any)} />
              <Row Icon={Bell} title="Notifications" sub="Updates and assignments" onPress={() => router.push('/app/technician/notifications' as any)} />
              <Row Icon={Settings} title="Settings" sub="Account and preferences" onPress={() => router.push('/app/technician/settings' as any)} last />
            </Surface>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
